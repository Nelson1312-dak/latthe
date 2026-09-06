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

$scriptDir = $PSScriptRoot
$proxyPort = 11435
$proxyPath = Join-Path $scriptDir 'local-proxy.js'
$logPath   = Join-Path $scriptDir 'watchdog-proxy.log'

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
