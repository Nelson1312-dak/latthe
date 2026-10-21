# watchdog-proxy.ps1
# Restarts local-proxy.js if it has died. Meant to be run on a schedule by
# Task Scheduler (see register-watchdog.ps1 to install it).
#
# NOTE: ASCII-only on purpose. Windows PowerShell 5.1 reads .ps1 files as ANSI
# when there is no BOM, so non-ASCII comments get mangled into parse errors.
#
# SCOPE - read before expecting too much:
#   CAN FIX:    local-proxy.js (node, :11435) crashed or was killed, so nothing
#               is listening on the port. This is the failure seen 2026-08-17.
#   CAN FIX:    the ngrok tunnel died while the agent still looks alive. Seen
#               2026-10-20 after the tunnel had been up 13 days: the agent still
#               reported its public_url and :11435 was still listening, but calls
#               from the outside failed TLS. /api/health went 503 and the price
#               board 502 - it looked exactly like a bad deploy. Checking only the
#               local port can never see this, so the check below goes out to the
#               PUBLIC url and back.
#   CANNOT FIX: WSL2 / Docker Desktop hang (failure seen 2026-09-03). In that
#               case the proxy is still alive and still listening - it is the
#               upstream (Ollama container) that is wedged. Recovery needs
#               Administrator (Restart-Service LxssManager + wsl --shutdown),
#               so it cannot be automated here. That failure mode is caught by
#               the "Giam sat ha tang AI" GitHub Actions workflow, which emails
#               the repo owner.
#
# DELIBERATELY CONSERVATIVE: only starts the proxy when nothing is listening on
# :11435. It never kills a process that holds the port - if the proxy were merely
# slow, killing and restarting would have two instances fighting over the port.

$ErrorActionPreference = 'Stop'
$script:lastDownWhy = $null

$scriptDir = $PSScriptRoot
$proxyPath = Join-Path $scriptDir 'local-proxy.js'
$logPath   = Join-Path $scriptDir 'watchdog-proxy.log'
# Heartbeat. The log only gets a line when something is WRONG, which is right for a log but
# leaves one question unanswerable: did the watchdog run at all? On 2026-10-20 the tunnel was
# down for several minutes and there was no way to tell "the watchdog checked and saw nothing"
# apart from "the watchdog never ran" - Task Scheduler's Operational log is disabled on this
# machine, so there is no run history either. Every run now stamps this file; if it is stale,
# the watchdog itself is the thing that died.
$beatPath  = Join-Path $scriptDir 'watchdog-proxy.beat'

# Which tunnel is in use is read from tunnel.json, not hard-coded here. It was hard-coded until
# 2026-10-21, and that morning the ngrok account hit its monthly bandwidth cap (ERR_NGROK_725),
# which no restart can fix; switching to another tunnel then meant editing this script. One file
# that both a human and this script read is less error-prone - though note the SAME url must also
# be set on Vercel (SUPABASE_URL / PRICE_FEED_URL / DNSE_BASE_URL) or the two disagree.
$cfgPath = Join-Path $scriptDir 'tunnel.json'
if (-not (Test-Path $cfgPath)) { Write-Host "Missing $cfgPath"; exit 1 }
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json

# Public probe. /postgrest/ with no token must answer 401 "Missing token" - that exact answer
# proves the WHOLE chain is up: tunnel edge -> agent -> local-proxy -> PostgREST. A dead tunnel
# gives a connection/TLS error or the provider's own error page, never 401.
$publicUrl   = ($cfg.publicUrl.TrimEnd('/')) + $cfg.probePath
$expectCode  = [int]$cfg.expectStatus
$proxyPort   = [int]$cfg.localPort
$autoHeal    = [bool]$cfg.autoHeal
$ngrokTunnel = $cfg.ngrokTunnelName
$stampPath   = Join-Path $scriptDir '.ngrok-restart.stamp'
$coolDownMin = 15                # never restart the tunnel more often than this

function Write-Log($message) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
    Add-Content -Path $logPath -Value $line -Encoding utf8
}

# Keep the log from growing forever: over 512KB, trim to the last 200 lines.
if (Test-Path $logPath) {
    $sizeKb = (Get-Item $logPath).Length / 1KB
    if ($sizeKb -gt 512) {
        $tail = Get-Content $logPath -Tail 200
        Set-Content -Path $logPath -Value $tail -Encoding utf8
    }
}

# TcpClient.Connect() has no timeout and can block for a long time, so use
# ConnectAsync + Wait to give up after 3 seconds.
function Test-Port($port) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $tcp.ConnectAsync('127.0.0.1', $port)
        if ($task.Wait(3000)) { return $tcp.Connected }
        return $false
    } catch {
        return $false
    } finally {
        $tcp.Dispose()
    }
}

# ---- 1. the tunnel, seen from outside ----
# Runs first: the proxy can be perfectly healthy while the tunnel is dead, which is the
# whole point of this check.
function Test-PublicTunnel {
    try {
        $r = Invoke-WebRequest $publicUrl -TimeoutSec 15 -UseBasicParsing -Headers @{ 'ngrok-skip-browser-warning' = '1' }
        return $r.StatusCode -eq $expectCode
    } catch {
        $resp = $_.Exception.Response
        # The expected answer is a 4xx, and PowerShell raises those as exceptions.
        if ($resp -and [int]$resp.StatusCode -eq $expectCode) { return $true }
        # Record WHY it is down. On 2026-10-21 the tunnel answered 403 ERR_NGROK_725 for hours
        # while the agent looked perfectly healthy; without the provider's own error code in the
        # log the only visible symptom was "down", and the real cause (monthly bandwidth cap,
        # unfixable by restarting) took a manual investigation to find.
        if ($resp) {
            $maLoi = $null
            try { $maLoi = $resp.Headers['Ngrok-Error-Code'] } catch { }
            $script:lastDownWhy = 'HTTP {0}{1}' -f [int]$resp.StatusCode, $(if ($maLoi) { " $maLoi" } else { '' })
        } else {
            $script:lastDownWhy = $_.Exception.Message
        }
        return $false
    }
}

function Restart-Ngrok {
    # Some tunnels cannot be healed by restarting, and pretending otherwise is worse than doing
    # nothing: a cloudflare QUICK tunnel gets a brand new hostname every start, so the restart
    # succeeds while Vercel still points at the old one and the site stays down - with a reassuring
    # "OK - tunnel came back" in the log. Say plainly that a human is needed instead.
    if (-not $autoHeal) {
        Write-Log ("tunnel is DOWN ({0}) and autoHeal is off for kind '{1}' - a human must fix it. {2}" -f `
            $(if ($script:lastDownWhy) { $script:lastDownWhy } else { 'no response' }), $cfg.kind, 'See tunnel.json.')
        return
    }
    # Cool-down so a tunnel that keeps failing does not get hammered every run.
    if (Test-Path $stampPath) {
        $last = (Get-Item $stampPath).LastWriteTime
        if ((Get-Date) - $last -lt [TimeSpan]::FromMinutes($coolDownMin)) {
            Write-Log "tunnel still down, but ngrok was restarted $([int]((Get-Date) - $last).TotalMinutes)m ago - waiting."
            return
        }
    }
    Write-Log ("public tunnel is DOWN ({0}) - restarting ngrok." -f $(if ($script:lastDownWhy) { $script:lastDownWhy } else { 'no response' }))
    Get-Process ngrok -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.Id -Force } catch { } }
    Start-Sleep -Seconds 3
    # MUST be the named tunnel: "ngrok http 11435" comes up on a random domain and would
    # strand production, because Vercel points at the reserved hostname.
    try { Start-Process 'ngrok' -ArgumentList "start $ngrokTunnel" -WindowStyle Minimized }
    catch { Write-Log "ERROR starting ngrok: $($_.Exception.Message)"; return }
    Set-Content -Path $stampPath -Value (Get-Date -Format 'o') -Encoding utf8
    $waited = 0
    while ($waited -lt 30) {
        Start-Sleep -Seconds 3; $waited += 3
        if (Test-PublicTunnel) { Write-Log "OK - tunnel came back after $($waited)s."; return }
    }
    Write-Log "FAILED - tunnel still down after $($waited)s. Needs a human."
}

# Parentheses around each call are REQUIRED: `Test-Port $proxyPort -and ...` would pass `-and`
# as an argument to the function instead of being a logical operator, so the condition would
# always be true. (Kept ASCII on purpose - see the note at the top of this file.)
# Stamp the heartbeat FIRST, before any check that could throw: the question it answers is
# "did this script run", not "did it finish happily".
try { Set-Content -Path $beatPath -Value (Get-Date -Format 'o') -Encoding ascii } catch { }

if ((Test-Port $proxyPort) -and -not (Test-PublicTunnel)) { Restart-Ngrok }

# ---- 2. local-proxy ----
if (Test-Port $proxyPort) {
    # Healthy - stay silent so the log does not fill up (runs every 5 minutes).
    exit 0
}

Write-Log "local-proxy is NOT listening on :$proxyPort - restarting it."

if (-not (Test-Path $proxyPath)) {
    Write-Log "ERROR: $proxyPath not found - giving up."
    exit 1
}

try {
    Start-Process -FilePath 'node' -ArgumentList "`"$proxyPath`"" -WindowStyle Minimized
} catch {
    Write-Log "ERROR starting node: $($_.Exception.Message)"
    exit 1
}

# Wait up to 20s for the proxy to bind the port.
$waited = 0
while ($waited -lt 20) {
    Start-Sleep -Seconds 2
    $waited += 2
    if (Test-Port $proxyPort) {
        Write-Log "OK - proxy came back after $($waited)s."
        exit 0
    }
}

Write-Log "FAILED - proxy still not listening on :$proxyPort after $($waited)s."
exit 1
