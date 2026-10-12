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

$file = Join-Path $Dir ("latthe-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmm'))
try {
    $null = docker ps --filter "name=^$Container$" --format '{{.Names}}'
    cmd.exe /c "docker exec $Container pg_dump -U postgres -d $Db -Fc > `"$file`""
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
} catch {
    if (Test-Path $file) { Remove-Item $file -Force }   # never leave a bad file that looks like a backup
    Log ("FAILED: " + $_.Exception.Message)
    Write-Host ("Backup FAILED: " + $_.Exception.Message)
    exit 1
}
