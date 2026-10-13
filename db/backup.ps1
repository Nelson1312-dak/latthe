# db/backup.ps1
# Daily backup of the Postgres database (docker container postgres_latthe) to a folder OUTSIDE the repo.
# Usage: powershell -ExecutionPolicy Bypass -File db\backup.ps1            (run one backup now)
#        powershell -ExecutionPolicy Bypass -File db\backup.ps1 -Register  (create the daily 03:00 task)
#        powershell -ExecutionPolicy Bypass -File db\backup.ps1 -Register -Remove
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 reads .ps1 files as ANSI without a BOM).
#
# The dump is written through cmd.exe so the binary pg_dump stream is not re-encoded by PowerShell.
# Each backup is verified with pg_restore -l before it is kept; a failed one is removed so it never
# looks like a good backup. Old backups are NOT deleted here (about 1-2 MB per day): prune by hand if needed.
#
# TWO KINDS OF BACKUP, on purpose:
#   1. latthe-<when>.dump  - the whole database EXCEPT the tape history data. Small, written every night.
#   2. tape-<YYYYMMDD>.dump - one trading day of trade.tape + trade.depth_log, written ONCE and never again.
# The tape tables grow without bound, so putting them in the nightly full dump would make backup N
# contain all N days of history. Measured at 150 symbols that is about 16 MB per session compressed:
# nightly full dumps would reach ~500 GB in the first year, while one file per day totals ~4 GB.
# Any day whose file is missing is picked up on a later run, so a day the PC was off is not lost.

param([switch]$Register, [switch]$Remove,
      [string]$Dir = 'D:\Claude projects\Project\latthe-db-backup',
      [string]$Container = 'postgres_latthe', [string]$Db = 'latthe')
$ErrorActionPreference = 'Stop'
$task = 'Latbai db backup'

if ($Register) {
    if ($Remove) {
        if (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $task -Confirm:$false; Write-Host "Removed task: $task" }
        else { Write-Host "No such task: $task" }
        exit 0
    }
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ("-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"" + $PSCommandPath + "`"")
    $trigger = New-ScheduledTaskTrigger -Daily -At 3:00am
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Daily pg_dump of the Lat Bai database' -Force | Out-Null
    Write-Host "Registered task: $task (daily 03:00, runs at next start if the PC was off)"
    exit 0
}

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$log = Join-Path $Dir 'backup.log'
function Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) -Encoding ascii }

# Tape history is archived per day instead of riding along in every nightly dump (see header).
$excl = "--exclude-table-data=trade.tape* --exclude-table-data=trade.depth_log*"

$file = Join-Path $Dir ("latthe-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmm'))
try {
    $null = docker ps --filter "name=^$Container$" --format '{{.Names}}'
    cmd.exe /c "docker exec $Container pg_dump -U postgres -d $Db -Fc $excl > `"$file`""
    if ($LASTEXITCODE -ne 0) { throw "pg_dump exit code $LASTEXITCODE" }
    $size = (Get-Item $file).Length
    if ($size -lt 10KB) { throw "dump too small ($size bytes)" }
    # Verify the archive can be read back and contains table data
    $toc = cmd.exe /c "docker exec -i $Container pg_restore -l < `"$file`""
    if ($LASTEXITCODE -ne 0 -or -not ($toc | Select-String 'TABLE DATA')) { throw 'verification failed: archive has no table data' }
    $tables = @($toc | Select-String 'TABLE DATA').Count
    Log ("OK {0} ({1:N0} KB, {2} tables)" -f (Split-Path $file -Leaf), ($size / 1KB), $tables)
    Set-Content -Path (Join-Path $Dir 'LATEST.txt') -Value $file -Encoding ascii
    Write-Host ("Backup OK: {0} ({1:N0} KB, {2} tables)" -f $file, ($size / 1KB), $tables)

    # ---- Tape history: archive every finished day that has no file yet ----
    # Today is skipped because the session may still be running. A day already archived is never
    # rewritten, which is what keeps the total at one copy per day instead of growing quadratically.
    $tapeDir = Join-Path $Dir 'tape'
    New-Item -ItemType Directory -Force -Path $tapeDir | Out-Null
    $today = (Get-Date).ToUniversalTime().ToString('yyyyMMdd')
    # Plain LIKE, no regex: this string goes through PowerShell and then cmd.exe, and a '$' anchor
    # does not survive that trip intact. The date is validated in PowerShell instead.
    $q = "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace " +
         "where n.nspname='trade' and c.relkind='r' and c.relname like 'tape_2%' order by 1"
    $days = (cmd.exe /c "docker exec $Container psql -U postgres -d $Db -t -A -c `"$q`"") |
            ForEach-Object { ($_ -replace '^tape_', '').Trim() } |
            Where-Object { $_ -match '^\d{8}$' -and $_ -lt $today }
    foreach ($d in $days) {
        $tf = Join-Path $tapeDir "tape-$d.dump"
        if (Test-Path $tf) { continue }
        $tmp = "$tf.part"
        cmd.exe /c "docker exec $Container pg_dump -U postgres -d $Db -Fc -Z9 -t trade.tape_$d -t trade.depth_log_$d > `"$tmp`""
        if ($LASTEXITCODE -ne 0) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue; Log "tape $d FAILED: pg_dump exit $LASTEXITCODE"; continue }
        $toc2 = cmd.exe /c "docker exec -i $Container pg_restore -l < `"$tmp`""
        if ($LASTEXITCODE -ne 0 -or -not ($toc2 | Select-String 'TABLE DATA')) {
            Remove-Item $tmp -Force -ErrorAction SilentlyContinue; Log "tape $d FAILED: verification"; continue
        }
        # Only now give it the real name: a half-written file must never look like a finished archive
        Move-Item $tmp $tf -Force
        Log ("tape {0} OK ({1:N1} MB)" -f $d, ((Get-Item $tf).Length / 1MB))
        Write-Host ("Tape archived: {0} ({1:N1} MB)" -f $tf, ((Get-Item $tf).Length / 1MB))
    }
} catch {
    if (Test-Path $file) { Remove-Item $file -Force }   # never leave a bad file that looks like a backup
    Log ("FAILED: " + $_.Exception.Message)
    Write-Host ("Backup FAILED: " + $_.Exception.Message)
    exit 1
}
