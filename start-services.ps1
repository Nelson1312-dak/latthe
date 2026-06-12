# start-services.ps1
# One-click startup: Ollama + local-proxy + ngrok tunnel -> updates Vercel env vars.
# Run this after every PC restart to reconnect latthe.vn to local qwen3.5:2b.

param(
    [switch]$SkipVercel  # Pass -SkipVercel to start services without redeploying
)

$scriptDir = $PSScriptRoot
$proxyPort = 11435

function Test-Port($port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", $port)
        $tcp.Close()
        return $true
    } catch { return $false }
}

# ---- 1. Ollama ----
Write-Host "[1/4] Checking Ollama on :11434..." -ForegroundColor Yellow
if (Test-Port 11434) {
    try {
        $models = Invoke-RestMethod "http://localhost:11434/api/tags" -ErrorAction Stop
        $hasModel = $models.models | Where-Object { $_.name -like "qwen3.5*" }
        if ($hasModel) {
            Write-Host "      OK - qwen3.5:2b ready" -ForegroundColor Green
        } else {
            Write-Host "      Ollama running but qwen3.5:2b not found. Pulling..." -ForegroundColor Yellow
            Start-Process "ollama" -ArgumentList "pull qwen3.5:2b" -Wait -NoNewWindow
        }
    } catch {
        Write-Host "      Ollama port open but API not responding: $_" -ForegroundColor Red
    }
} else {
    Write-Host "      Ollama not running. Starting..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Minimized
    $waited = 0
    do { Start-Sleep -Seconds 2; $waited += 2 } while (-not (Test-Port 11434) -and $waited -lt 20)
    if (Test-Port 11434) {
        Write-Host "      Ollama started" -ForegroundColor Green
    } else {
        Write-Host "      WARNING: Ollama did not start in time." -ForegroundColor Red
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
    Write-Host "      Starting ngrok for port $proxyPort..." -ForegroundColor Yellow
    Start-Process "ngrok" -ArgumentList "http $proxyPort" -WindowStyle Minimized
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
