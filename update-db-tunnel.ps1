# update-db-tunnel.ps1
# Reads ngrok tunnel URLs and updates Vercel OLLAMA_BASE_URL + SUPABASE_URL.
# Supports single-proxy mode (port 11435) and separate-tunnel mode.
# Run once after PC restart (ngrok + local-proxy must already be running).

$ngrokApi  = "http://localhost:4040/api/tunnels"
$vercelDir = $PSScriptRoot

Write-Host "Waiting for ngrok tunnels..."
$maxWait = 20
$waited  = 0
do {
    Start-Sleep -Seconds 2
    $waited += 2
    try { $tunnels = Invoke-RestMethod $ngrokApi -ErrorAction Stop; break } catch {}
} while ($waited -lt $maxWait)

if (-not $tunnels) {
    Write-Host "ERROR: ngrok not responding after ${maxWait}s. Make sure ngrok is running." -ForegroundColor Red
    exit 1
}

# --- Detect tunnel mode ---
# Prefer single-proxy tunnel (11435) -> serves both Ollama + PostgREST via local-proxy.js
$proxyTunnel  = $tunnels.tunnels | Where-Object { $_.config.addr -match "11435" } | Select-Object -First 1
$ollamaTunnel = $tunnels.tunnels | Where-Object { $_.config.addr -match "11434" } | Select-Object -First 1
$pgTunnel     = $tunnels.tunnels | Where-Object { $_.config.addr -match "3001"  } | Select-Object -First 1

if ($proxyTunnel) {
    $ollamaUrl   = $proxyTunnel.public_url
    $supabaseUrl = "$($proxyTunnel.public_url)/postgrest"
    Write-Host "Mode: single proxy (port 11435)" -ForegroundColor Cyan
    Write-Host "  Ollama    -> $ollamaUrl" -ForegroundColor Cyan
    Write-Host "  PostgREST -> $supabaseUrl" -ForegroundColor Cyan
} elseif ($ollamaTunnel -and $pgTunnel) {
    $ollamaUrl   = $ollamaTunnel.public_url
    $supabaseUrl = $pgTunnel.public_url
    Write-Host "Mode: separate tunnels" -ForegroundColor Cyan
    Write-Host "  Ollama    -> $ollamaUrl" -ForegroundColor Cyan
    Write-Host "  PostgREST -> $supabaseUrl" -ForegroundColor Cyan
} elseif ($pgTunnel) {
    # Legacy: only PostgREST tunnel found (no Ollama tunnel yet)
    $ollamaUrl   = $null
    $supabaseUrl = $pgTunnel.public_url
    Write-Host "Mode: PostgREST only (no Ollama tunnel found)" -ForegroundColor Yellow
    Write-Host "  PostgREST -> $supabaseUrl" -ForegroundColor Cyan
} else {
    Write-Host "ERROR: No usable tunnels found." -ForegroundColor Red
    Write-Host "Active tunnels:" ($tunnels.tunnels | ForEach-Object { "  $($_.name) -> $($_.config.addr)" })
    exit 1
}

Set-Location $vercelDir

if ($ollamaUrl) {
    Write-Host "Updating Vercel OLLAMA_BASE_URL..."
    npx vercel env rm OLLAMA_BASE_URL production --yes 2>$null
    $ollamaUrl | npx vercel env add OLLAMA_BASE_URL production
}

Write-Host "Updating Vercel SUPABASE_URL..."
npx vercel env rm SUPABASE_URL production --yes 2>$null
$supabaseUrl | npx vercel env add SUPABASE_URL production

Write-Host "Redeploying Vercel..."
npx vercel --prod --yes

# Warm cache "Lá Bài Hôm Nay" ngay khi tunnel + deploy vừa sẵn sàng. Đây là thời điểm
# DUY NHẤT chắc chắn Ollama + PostgREST đều sống (tunnel vừa được xác nhận ở trên), nên
# là chỗ tốt nhất để sinh sẵn lời luận cho user đầu tiên trong ngày. Idempotent: lá đã
# có cache thì endpoint trả cache-exact, không sinh AI lần nữa. Cache dùng chung
# (PostgREST) nên không cần chờ alias production trỏ sang deployment mới.
# Secret đọc từ $env:CRON_SECRET — KHÔNG hardcode vào file commit.
if ($ollamaUrl -and $env:CRON_SECRET) {
    Write-Host "Pre-warming Lá Bài Hôm Nay cache..." -ForegroundColor Yellow
    try {
        $warm = Invoke-RestMethod "https://latbai.vn/api/prewarm-daily?key=$($env:CRON_SECRET)" -TimeoutSec 120 -ErrorAction Stop
        Write-Host "      $($warm | ConvertTo-Json -Depth 4 -Compress)" -ForegroundColor Cyan
    } catch {
        # Không để pre-warm fail chặn script — user đầu tiên vẫn tự ghi cache như thường.
        Write-Host "      Pre-warm skipped (non-fatal): $_" -ForegroundColor Gray
    }
} elseif ($ollamaUrl) {
    Write-Host "Pre-warm skipped: set `$env:CRON_SECRET to enable." -ForegroundColor Gray
}

if ($ollamaUrl) {
    Write-Host "Done! qwen3.5:2b (local) is now primary AI. DeepSeek is fallback." -ForegroundColor Green
} else {
    Write-Host "Done! RAG database connected. Run start-services.ps1 to connect Ollama." -ForegroundColor Yellow
}
