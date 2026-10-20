# infra/setup-stack.ps1
# Builds the Lat Bai backend from scratch: Postgres + PostgREST in Docker, empty database, all migrations applied.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File infra\setup-stack.ps1            (create or update the stack; safe to re-run)
#   add -Restore <file.dump> to load data from a backup made by db\backup.ps1 (only into an EMPTY database)
#
# What it does:
#   1. creates ..\latthe-secrets\stack.env once (strong random DB passwords; JWT secret = DB_JWT_SECRET from .env.local).
#      The file is readable only by your Windows user. Passwords are never printed or put in the repo.
#   2. creates the data folder D:\Claude projects\Project\latthe-pgdata (outside Docker)
#   3. docker compose up (Postgres first, then PostgREST), both bound to 127.0.0.1 only
#   4. on a fresh database: applies db\001, 004..016 in order (002/003 only clean up the old RAG tables, not needed here)
#   5. checks PostgREST with deploy\check-local-db.mjs (no token = 401, forged token = 401, valid token = 200, old tables not exposed)
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 reads .ps1 files as ANSI without a BOM).

param([string]$Restore = '')
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $repo
$secretsDir = Join-Path $root 'latthe-secrets'
$stackEnv = Join-Path $secretsDir 'stack.env'
$dataDir = Join-Path $root 'latthe-pgdata'
$compose = Join-Path $PSScriptRoot 'docker-compose.yml'
$envLocal = Join-Path $repo '.env.local'

function Say($m) { Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }
function EnvValue($file, $name) {
    $l = Get-Content $file | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if (-not $l) { return $null }
    return $l.Substring($name.Length + 1).Trim()
}
function RandomHex($bytes) {
    $b = New-Object byte[] $bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    return (($b | ForEach-Object { $_.ToString('x2') }) -join '')
}

try {
    cmd.exe /c "docker info >nul 2>&1"
    if ($LASTEXITCODE -ne 0) { throw 'Docker is not responding. Start Docker Desktop first.' }

    # ---------- 1. secrets ----------
    New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null
    if (-not (Test-Path $stackEnv)) {
        $jwt = EnvValue $envLocal 'DB_JWT_SECRET'
        if (-not $jwt -or $jwt.Length -lt 32) { throw 'DB_JWT_SECRET missing or too short in .env.local' }
        $lines = @(
            'POSTGRES_USER=postgres',
            'POSTGRES_DB=latthe',
            ('POSTGRES_PASSWORD=' + (RandomHex 24)),
            'POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256'
        )
        $auth = RandomHex 24
        $lines += ('AUTHENTICATOR_PASSWORD=' + $auth)
        $lines += ('PGRST_DB_URI=postgres://authenticator:' + $auth + '@postgres:5432/latthe')
        $lines += 'PGRST_DB_SCHEMAS=trade'
        $lines += 'PGRST_DB_ANON_ROLE=web_anon'
        $lines += ('PGRST_JWT_SECRET=' + $jwt)
        $lines += 'PGRST_DB_MAX_ROWS=500'
        $lines += 'PGRST_OPENAPI_MODE=disabled'
        Set-Content -Path $stackEnv -Value $lines -Encoding ascii
        # only the current Windows user may read it
        $me = "$env:USERDOMAIN\$env:USERNAME"
        & icacls $stackEnv /inheritance:r /grant:r "${me}:(R,W)" | Out-Null
        Say "Created $stackEnv (random passwords, readable only by $me)"
    } else { Say "Using existing $stackEnv" }

    # ---------- 2. data folder ----------
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

    # ---------- 3. start ----------
    Say 'Starting Postgres and PostgREST...'
    cmd.exe /c "docker compose -f `"$compose`" up -d --wait --wait-timeout 240 postgres 2>&1"
    if ($LASTEXITCODE -ne 0) { throw 'Postgres did not become healthy. See: docker logs postgres_latthe' }

    # ---------- 4. migrations (fresh database only) ----------
    $authpw = EnvValue $stackEnv 'AUTHENTICATOR_PASSWORD'
    $has = (cmd.exe /c "docker exec postgres_latthe psql -U postgres -d latthe -tAc `"select to_regnamespace('trade') is not null`" 2>nul" | Out-String).Trim()
    if ($has -ne 't') {
        Say 'Fresh database: applying migrations'
        foreach ($f in '001-trade-schema', '004-trade-functions', '005-dnse', '006-auth-google', '007-broker-links', '008-order-tickets', '009-client-portal', '010-market', '011-dnse-login', '012-advisory', '013-advisory-ai', '014-knowledge', '015-tape', '016-ticket-unknown', '017-quan-ly-lien-ket') {
            $path = Join-Path $repo "db\$f.sql"
            if (-not (Test-Path $path)) { throw "Missing migration $path" }
            # cmd.exe redirect keeps the file bytes (UTF-8) intact
            cmd.exe /c "docker exec -i postgres_latthe psql -U postgres -d latthe -v ON_ERROR_STOP=1 -q -v authpw=$authpw < `"$path`" > nul"
            if ($LASTEXITCODE -ne 0) { throw "Migration $f failed" }
            Say "  applied $f"
        }
        if ($Restore) {
            if (-not (Test-Path $Restore)) { throw "Backup file not found: $Restore" }
            Say "Restoring data from $Restore"
            cmd.exe /c "docker exec -i postgres_latthe pg_restore -U postgres -d latthe --data-only --disable-triggers --no-owner --schema=trade < `"$Restore`""
            if ($LASTEXITCODE -ne 0) { throw 'pg_restore reported errors (the schema stays; check the output above).' }
        }
    } else {
        Say 'Database already has the trade schema: migrations skipped'
        if ($Restore) { Say 'NOTE: -Restore ignored because the database is not empty.' }
    }

    cmd.exe /c "docker compose -f `"$compose`" up -d --wait --wait-timeout 120 postgrest 2>&1"
    if ($LASTEXITCODE -ne 0) { throw 'PostgREST did not become healthy. See: docker logs postgrest_trade' }

    # ---------- 5. checks ----------
    Say 'Checking the API...'
    Push-Location $repo
    node --env-file=.env.local deploy\check-local-db.mjs
    $rc = $LASTEXITCODE
    Pop-Location
    if ($rc -ne 0) { throw 'API checks failed' }
    Say 'DONE. Postgres 127.0.0.1:5432, PostgREST 127.0.0.1:3002 (schema trade only).'
    exit 0
} catch {
    Say ("ERROR: " + $_.Exception.Message)
    exit 1
}
