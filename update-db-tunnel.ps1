# update-db-tunnel.ps1
# Reads the current PostgREST ngrok tunnel URL and updates Vercel SUPABASE_URL.
# Run once after PC restart (ngrok must already be running).

$ngrokApi = "http://localhost:4040/api/tunnels"
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

$pgTunnel = $tunnels.tunnels | Where-Object { $_.config.addr -match "3001" } | Select-Object -First 1
if (-not $pgTunnel) {
    Write-Host "ERROR: PostgREST tunnel (port 3001) not found in ngrok." -ForegroundColor Red
    Write-Host "Active tunnels:" $tunnels.tunnels.name
    exit 1
}

$pgUrl = $pgTunnel.public_url
Write-Host "PostgREST tunnel URL: $pgUrl" -ForegroundColor Cyan

Set-Location $vercelDir

Write-Host "Updating Vercel SUPABASE_URL..."
npx vercel env rm SUPABASE_URL production --yes 2>$null
$pgUrl | npx vercel env add SUPABASE_URL production

Write-Host "Redeploying Vercel..."
npx vercel --prod --yes

Write-Host "Done! RAG database is now connected." -ForegroundColor Green
