# start-services.ps1
# One-click startup: Ollama + local-proxy + ngrok tunnel -> updates Vercel env vars.
# Run this after every PC restart to reconnect latthe.vn to local qwen3.5:2b.

param(
    [switch]$SkipVercel  # Pass -SkipVercel to start services without redeploying
)

$scriptDir = $PSScriptRoot
$proxyPort = 11435

function Test-Port($port) {
    # ConnectAsync + Wait, not Connect(): Connect() has no timeout and can block
    # for a long time when the machine is in a bad state - which is exactly when
    # this script gets run.
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $tcp.ConnectAsync("127.0.0.1", $port)
        if ($task.Wait(3000)) { return $tcp.Connected }
        return $false
    } catch {
        return $false
    } finally {
        $tcp.Dispose()
    }
}

# Runs "docker ..." with a hard timeout. Needed because when WSL2 / Docker
# Desktop wedges (seen 2026-09-03), docker commands hang forever instead of
# failing - so a plain call would leave this script stuck with no explanation.
function Invoke-Docker($dockerArgs, $timeoutSec = 25) {
    $job = Start-Job -ScriptBlock { param($a) (& docker @a 2>&1) -join "`n" } -ArgumentList (, $dockerArgs)
    if (Wait-Job $job -Timeout $timeoutSec) {
        $out = Receive-Job $job
        Remove-Job $job -Force
        return @{ TimedOut = $false; Output = [string]$out }
    }
    Stop-Job $job
    Remove-Job $job -Force
    return @{ TimedOut = $true; Output = "" }
}

# ---- 1. Ollama ----
# IMPORTANT: Ollama runs as a DOCKER CONTAINER named "ollama", not as a Windows
# service and not as a binary on PATH. There is no ollama.exe here, so the old
# "ollama serve" / "ollama pull" calls could never have worked.
Write-Host "[1/4] Checking Ollama on :11434..." -ForegroundColor Yellow

if (-not (Test-Port 11434)) {
    Write-Host "      Port closed - checking the Docker container..." -ForegroundColor Yellow
    $ps = Invoke-Docker @('ps', '-a', '--filter', 'name=^ollama$', '--format', '{{.Names}} {{.State}}')

    if ($ps.TimedOut) {
        Write-Host "      DOCKER IS NOT RESPONDING - WSL2/Docker Desktop is likely wedged." -ForegroundColor Red
        Write-Host "      Fix needs an ADMIN PowerShell:" -ForegroundColor Red
        Write-Host "          Restart-Service LxssManager -Force; wsl --shutdown" -ForegroundColor Red
        Write-Host "      then quit Docker Desktop completely and start it again." -ForegroundColor Red
    } elseif (-not $ps.Output) {
        Write-Host "      No container named 'ollama' exists. Is Docker Desktop running?" -ForegroundColor Red
    } else {
        Write-Host "      Starting container 'ollama'..." -ForegroundColor Yellow
        $start = Invoke-Docker @('start', 'ollama')
        if ($start.TimedOut) {
            Write-Host "      'docker start ollama' hung - see the WSL2 fix above." -ForegroundColor Red
        } else {
            $waited = 0
            do { Start-Sleep -Seconds 2; $waited += 2 } while (-not (Test-Port 11434) -and $waited -lt 30)
            if (Test-Port 11434) {
                Write-Host "      Container started" -ForegroundColor Green
            } else {
                Write-Host "      WARNING: container did not open :11434 in time." -ForegroundColor Red
            }
        }
    }
}

if (Test-Port 11434) {
    try {
        $models = Invoke-RestMethod "http://localhost:11434/api/tags" -TimeoutSec 10 -ErrorAction Stop
        foreach ($want in @('qwen3.5', 'nomic-embed-text')) {
            $has = $models.models | Where-Object { $_.name -like "$want*" }
            if ($has) {
                Write-Host "      OK - $want present" -ForegroundColor Green
            } else {
                Write-Host "      $want missing. Pulling (inside the container)..." -ForegroundColor Yellow
                $pull = Invoke-Docker @('exec', 'ollama', 'ollama', 'pull', $want) 600
                if ($pull.TimedOut) { Write-Host "      Pull timed out." -ForegroundColor Red }
            }
        }

        # /api/tags answering 200 is NOT proof Ollama works: on 2026-09-03 it
        # returned 200 while generate/embeddings hung forever. Probe for real.
        Write-Host "      Probing real inference (embeddings)..." -ForegroundColor Yellow
        $body = @{ model = 'nomic-embed-text'; prompt = 'healthcheck' } | ConvertTo-Json
        try {
            Invoke-RestMethod "http://localhost:11434/api/embeddings" -Method Post -Body $body `
                -ContentType 'application/json' -TimeoutSec 30 -ErrorAction Stop | Out-Null
            Write-Host "      OK - inference responds" -ForegroundColor Green
        } catch {
            Write-Host "      WARNING: /api/tags works but inference does NOT." -ForegroundColor Red
            Write-Host "      Ollama is wedged. Try: docker restart ollama" -ForegroundColor Red
        }
    } catch {
        Write-Host "      Port open but API not responding: $_" -ForegroundColor Red
    }
}

# ---- 2. local-proxy ----
Write-Host "[2/4] Starting local-proxy on :$proxyPort..." -ForegroundColor Yellow
if (Test-Port $proxyPort) {
    Write-Host "      Already running" -ForegroundColor Green
} else {
    $proxy = Start-Process "node" -ArgumentList "`"$scriptDir\local-proxy.js`"" -WindowStyle Minimized -PassThru
    Start-Sleep -Seconds 2
    if (Test-Port $proxyPort) {
        Write-Host "      Started (PID $($proxy.Id))" -ForegroundColor Green
    } else {
        Write-Host "      WARNING: proxy did not bind to :$proxyPort" -ForegroundColor Red
    }
}

# ---- 3. ngrok ----
Write-Host "[3/4] Checking ngrok tunnel for :$proxyPort..." -ForegroundColor Yellow
$ngrokRunning = $false
try {
    $tunnels = Invoke-RestMethod "http://localhost:4040/api/tunnels" -ErrorAction Stop
    $existing = $tunnels.tunnels | Where-Object { $_.config.addr -match $proxyPort }
    if ($existing) {
        Write-Host "      Already tunnelled -> $($existing.public_url)" -ForegroundColor Green
        $ngrokRunning = $true
    }
} catch {}

if (-not $ngrokRunning) {
    # "ngrok start latthe" (named tunnel from ngrok.yml), NOT "ngrok http 11435":
    # the named tunnel carries the reserved hostname
    # stiffness-glade-coliseum.ngrok-free.dev, which is what OLLAMA_BASE_URL and
    # SUPABASE_URL on Vercel point at. "ngrok http" would come up on a random
    # domain, silently stranding production until the env vars were rewritten.
    Write-Host "      Starting ngrok tunnel 'latthe' (static domain)..." -ForegroundColor Yellow
    Start-Process "ngrok" -ArgumentList "start latthe" -WindowStyle Minimized
    $waited = 0
    do {
        Start-Sleep -Seconds 2; $waited += 2
        try {
            $t = Invoke-RestMethod "http://localhost:4040/api/tunnels" -ErrorAction Stop
            if ($t.tunnels | Where-Object { $_.config.addr -match $proxyPort }) { break }
        } catch {}
    } while ($waited -lt 20)
    Write-Host "      ngrok started" -ForegroundColor Green
}

# ---- 4. Update Vercel ----
if (-not $SkipVercel) {
    Write-Host "[4/4] Updating Vercel env vars + redeploying..." -ForegroundColor Yellow
    & "$scriptDir\update-db-tunnel.ps1"
} else {
    Write-Host "[4/4] Skipped Vercel update (-SkipVercel flag set)" -ForegroundColor Gray
    Write-Host "      Run update-db-tunnel.ps1 manually when ready." -ForegroundColor Gray
}

Write-Host ""
Write-Host "latthe.vn is now using local qwen3.5:2b as primary AI." -ForegroundColor Green
Write-Host "Fallback: DeepSeek (if Ollama unreachable from Vercel)" -ForegroundColor Gray
