# infra/compact-docker.ps1
# Shrinks the Docker Desktop virtual disk (docker_data.vhdx). The file only ever grows: after years of use it can be
# hundreds of GB while Docker's real data (images, volumes) is a few GB. Compacting returns that space to Windows.
# NO Docker data is deleted: images, volumes and containers are kept exactly as they are.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File infra\compact-docker.ps1 -DryRun    (check only, changes nothing, no admin needed)
#   powershell -ExecutionPolicy Bypass -File infra\compact-docker.ps1 -Yes       (do it; asks Windows for Administrator via UAC)
#   add -DisableHibernate to also turn hibernation off (frees the hiberfil.sys file, about the size of your RAM)
#
# What it does, in order (any failure BEFORE step 4 aborts without touching Docker):
#   1. pre-flight checks    2. database backup (aborts if it fails)    3. remember which containers run, stop the databases cleanly
#   4. quit Docker Desktop + WSL    5. compact the .vhdx with diskpart    6. start Docker Desktop, bring every container back
#   7. verify the database answers.
# Downtime: all Docker services stop for roughly 5-20 minutes (more if the disk is huge).
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 reads .ps1 files as ANSI without a BOM).

param([switch]$Yes, [switch]$DryRun, [switch]$DisableHibernate, [switch]$Elevated)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$vhdx = Join-Path $env:LOCALAPPDATA 'Docker\wsl\disk\docker_data.vhdx'
$dockerExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
$log = Join-Path $PSScriptRoot 'compact-docker.log'
$state = Join-Path $PSScriptRoot 'compact-docker.containers.txt'

function Log($m) { $l = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $l; Add-Content -Path $log -Value $l -Encoding ascii }
function GB($b) { '{0:N1} GB' -f ($b / 1GB) }
function IsAdmin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Finish($code) { if ($Elevated) { Read-Host 'Press Enter to close this window' | Out-Null }; exit $code }

try {
    # ---------- 1. pre-flight ----------
    if (-not (Test-Path $vhdx)) { throw "Cannot find $vhdx" }
    $before = (Get-Item $vhdx).Length
    $freeC = (Get-PSDrive C).Free
    Log "Docker disk file : $(GB $before)"
    Log "Free space on C: : $(GB $freeC)"
    if ($freeC -lt 2GB) { throw 'Less than 2 GB free on C: - free a little space first (compaction needs working room).' }
    $running = @(docker ps --format '{{.Names}}' 2>$null)
    if ($LASTEXITCODE -ne 0) { throw 'Docker is not responding. Start Docker Desktop first.' }
    $ds = docker system df --format '{{.Type}}={{.Size}}' 2>$null
    Log ("Docker real data : " + ($ds -join ' | '))
    Log ("Running containers (" + $running.Count + "): " + ($running -join ', '))
    if ($running -notcontains 'postgres_latthe') { Log 'WARNING: postgres_latthe is not running.' }

    if ($DryRun) {
        Log 'DRY RUN: nothing was changed. A real run would: back up the DB, stop the databases, quit Docker Desktop + WSL, compact the disk, restart everything.'
        Log "Expected result: the disk file shrinks from $(GB $before) to roughly the size of Docker's real data (see line above) plus overhead."
        Finish 0
    }
    if (-not $Yes) { throw 'Add -Yes to confirm (this stops all Docker services for several minutes), or -DryRun to only check.' }

    # ---------- elevate ----------
    if (-not (IsAdmin)) {
        Log 'Asking Windows for Administrator rights (UAC prompt)...'
        $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Yes', '-Elevated')
        if ($DisableHibernate) { $a += '-DisableHibernate' }
        Start-Process powershell -Verb RunAs -ArgumentList $a
        exit 0
    }

    # ---------- 2. backup ----------
    Log 'Step 2/7: database backup'
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'db\backup.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Database backup FAILED - aborting before touching Docker.' }

    # ---------- 3. remember + stop databases cleanly ----------
    Log 'Step 3/7: remember running containers, stop the databases cleanly'
    Set-Content -Path $state -Value $running -Encoding ascii
    $dbs = @('postgrest_trade', 'postgrest_latthe', 'postgres_latthe') | Where-Object { $running -contains $_ }
    if ($dbs) { docker stop -t 60 @dbs | Out-Null }

    # ---------- 4. quit Docker Desktop + WSL ----------
    Log 'Step 4/7: quitting Docker Desktop and WSL'
    docker desktop stop 2>$null | Out-Null
    Start-Sleep -Seconds 15
    foreach ($n in 'Docker Desktop', 'com.docker.backend', 'com.docker.proxy', 'com.docker.build') { Get-Process -Name $n -ErrorAction SilentlyContinue | Stop-Process -Force }
    wsl --shutdown
    for ($i = 0; $i -lt 30; $i++) {
        try { $fs = [IO.File]::Open($vhdx, 'Open', 'ReadWrite', 'None'); $fs.Close(); break } catch { Start-Sleep -Seconds 2 }
        if ($i -eq 29) { throw 'The disk file is still locked by another process.' }
    }

    # ---------- 5. compact ----------
    Log 'Step 5/7: compacting (this can take several minutes, do not close the window)'
    $dp = Join-Path $env:TEMP 'compact-docker-diskpart.txt'
    Set-Content -Path $dp -Encoding ascii -Value @("select vdisk file=`"$vhdx`"", 'attach vdisk readonly', 'compact vdisk', 'detach vdisk', 'exit')
    $out = & diskpart /s $dp 2>&1
    $out | ForEach-Object { Add-Content -Path $log -Value $_ -Encoding ascii }
    Remove-Item $dp -Force -ErrorAction SilentlyContinue
    $after = (Get-Item $vhdx).Length
    Log "Disk file after compaction: $(GB $after) (was $(GB $before), freed $(GB ($before - $after)))"
    if ($after -ge $before) { Log 'WARNING: the file did not shrink. diskpart output is in the log.' }

    # ---------- 6. start Docker again ----------
    Log 'Step 6/7: starting Docker Desktop and bringing containers back'
    Start-Process $dockerExe
    $ok = $false
    for ($i = 0; $i -lt 90; $i++) { Start-Sleep -Seconds 5; docker info 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { $ok = $true; break } }
    if (-not $ok) { throw 'Docker did not come back within 7 minutes. Open Docker Desktop manually, then run: docker start <names> (list in compact-docker.containers.txt).' }
    Start-Sleep -Seconds 10
    $want = Get-Content $state
    $order = @('postgres_latthe') + ($want | Where-Object { $_ -ne 'postgres_latthe' })
    foreach ($n in $order) {
        $st = docker inspect -f '{{.State.Running}}' $n 2>$null
        if ($st -ne 'true') { docker start $n | Out-Null; Log "  started $n" }
    }

    # ---------- 7. verify ----------
    Log 'Step 7/7: verification'
    Start-Sleep -Seconds 8
    $pg = docker exec postgres_latthe pg_isready -U postgres 2>&1
    Log "  postgres: $pg"
    $now = @(docker ps --format '{{.Names}}')
    $missing = $want | Where-Object { $now -notcontains $_ }
    Log ("  containers running: {0}/{1}" -f $now.Count, @($want).Count)
    if ($missing) { Log ("  NOT running: " + ($missing -join ', ')) }
    Log "  free space on C: now $(GB (Get-PSDrive C).Free)"
    if ($DisableHibernate) { powercfg -h off; Log "  hibernation turned off (free space on C: now $(GB (Get-PSDrive C).Free))" }
    Log 'DONE.'
    Finish 0
} catch {
    Log ("ERROR: " + $_.Exception.Message)
    Finish 1
}
