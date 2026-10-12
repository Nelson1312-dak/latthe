# deploy/push-env.ps1
# Pushes the environment variables latbai.vn needs to Vercel (Production), reading secrets from .env.local.
# Values are piped to the Vercel CLI; they are never printed or written anywhere else.
#
# Before running:  vercel login      (once; opens a browser)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File deploy\push-env.ps1 -Owner <your latbai.vn username>
#   ... -IncludeDnse            also push DNSE_API_KEY / DNSE_API_SECRET (needed for the broker desk and client portal)
#   ... -EnableRealTrading      also set DNSE_REAL_TRADING=1 (sends REAL orders to DNSE; leave off until you tested)
#   ... -IncludeGoogle          also push GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (must exist in .env.local)
#   ... -DryRun                 show which variables would be set, without touching Vercel
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 reads .ps1 files as ANSI without a BOM).

param(
    [string]$Owner = '',
    [string]$SupabaseUrl = 'https://stiffness-glade-coliseum.ngrok-free.dev/postgrest',
    [string]$Environment = 'production',
    [switch]$IncludeDnse, [switch]$EnableRealTrading, [switch]$IncludeGoogle, [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Read .env.local
$env_ = @{}
Get-Content (Join-Path $root '.env.local') | ForEach-Object {
    if ($_ -match '^([A-Z0-9_]+)=(.*)$') { $env_[$Matches[1]] = $Matches[2].Trim('"') }
}

$vars = [ordered]@{}
foreach ($k in 'DB_JWT_SECRET', 'SESSION_SECRET') {
    if (-not $env_[$k]) { throw "Missing $k in .env.local" }
    $vars[$k] = $env_[$k]
}
# On Vercel the database is reached through the ngrok tunnel, NOT the local 127.0.0.1 address from .env.local
$vars['SUPABASE_URL'] = $SupabaseUrl
if ($Owner) { $vars['BROKER_OWNER_USERNAME'] = $Owner.ToLower() }
if ($IncludeDnse) {
    foreach ($k in 'DNSE_API_KEY', 'DNSE_API_SECRET') { if (-not $env_[$k]) { throw "Missing $k in .env.local" }; $vars[$k] = $env_[$k] }
}
if ($IncludeGoogle) {
    foreach ($k in 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET') { if (-not $env_[$k]) { throw "Missing $k in .env.local (create the OAuth client first, see docs/DEPLOY.md)" }; $vars[$k] = $env_[$k] }
}
if ($EnableRealTrading) {
    if (-not $IncludeDnse) { throw '-EnableRealTrading needs -IncludeDnse' }
    if (-not $Owner) { throw '-EnableRealTrading needs -Owner' }
    $vars['DNSE_REAL_TRADING'] = '1'
}

Write-Host "Variables to set on Vercel ($Environment):"
$vars.Keys | ForEach-Object { Write-Host ("  {0,-24} {1}" -f $_, $(if ($_ -eq 'SUPABASE_URL' -or $_ -eq 'BROKER_OWNER_USERNAME' -or $_ -eq 'DNSE_REAL_TRADING') { $vars[$_] } else { '(hidden)' })) }
if ($vars.Contains('DNSE_REAL_TRADING')) { Write-Host 'WARNING: real order placement will be ENABLED on the public site.' -ForegroundColor Yellow }
if ($DryRun) { Write-Host 'Dry run: nothing was changed.'; exit 0 }

$who = (& vercel whoami 2>&1 | Select-Object -Last 1)
if ($LASTEXITCODE -ne 0 -or "$who" -match 'device|login|Waiting') { throw 'Not logged in to Vercel. Run: vercel login   then run this script again.' }
Write-Host "Vercel account: $who"

foreach ($k in $vars.Keys) {
    # Replace an existing value (ignore "not found")
    & vercel env rm $k $Environment --yes 2>&1 | Out-Null
    $vars[$k] | & vercel env add $k $Environment 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not set $k" }
    Write-Host "  set $k"
}
Write-Host ''
Write-Host 'Done. Environment variables only apply to NEW deployments. Redeploy:  vercel --prod   (or push a commit)'
Write-Host 'Then check:  https://latbai.vn/api/health'
