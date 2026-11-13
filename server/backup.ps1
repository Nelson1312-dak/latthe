# server/backup.ps1
# Backup of the online-mode database (docker container postgres_latbai_online) to a folder OUTSIDE the repo.
# Usage: powershell -ExecutionPolicy Bypass -File server\backup.ps1
#        powershell -ExecutionPolicy Bypass -File server\backup.ps1 -Register          (daily 03:30 task)
#        powershell -ExecutionPolicy Bypass -File server\backup.ps1 -Register -Remove
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 reads .ps1 files as ANSI without a BOM).
#
# Separate from db\backup.ps1 on purpose: that one guards the trading database and refuses dumps under
# 10 KB, which a young game database always is. Each dump is verified with pg_restore -l before it is
# kept; the newest 30 are kept, older ones are deleted (the data is small, 30 days is plenty).

param([switch]$Register, [switch]$Remove,
      [string]$Dir = 'D:\Claude projects\Project\latbai-online-backup',
      [string]$Container = 'postgres_latbai_online', [string]$Db = 'latbai_online', [int]$Keep = 30)
$ErrorActionPreference = 'Stop'
$task = 'Latbai online db backup'

if ($Register) {
    if ($Remove) {
        if (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $task -Confirm:$false; Write-Host "Removed task: $task" }
        else { Write-Host "No such task: $task" }
        exit 0
    }
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ("-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"" + $MyInvocation.MyCommand.Path + "`"")
    $trigger = New-ScheduledTaskTrigger -Daily -At 3:30am
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Daily pg_dump of the Lat Bai online-mode database' | Out-Null
    Write-Host "Registered task: $task (daily 03:30)"
    exit 0
}

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$log = Join-Path $Dir 'backup.log'
function Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) -Encoding ascii }

$file = Join-Path $Dir ("online-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmm'))
try {
    # The dump goes through cmd.exe so the binary stream is not re-encoded by PowerShell.
    cmd.exe /c "docker exec $Container pg_dump -U postgres -d $Db -Fc > `"$file`""
    if ($LASTEXITCODE -ne 0) { throw "pg_dump exit code $LASTEXITCODE" }
    $size = (Get-Item $file).Length
    if ($size -lt 1KB) { throw "dump too small ($size bytes)" }
    $toc = cmd.exe /c "docker exec -i $Container pg_restore -l < `"$file`""
    if ($LASTEXITCODE -ne 0 -or -not ($toc | Select-String 'TABLE DATA public players')) { throw 'verification failed: archive has no players data' }
    Log ("OK {0} ({1:N0} KB)" -f (Split-Path $file -Leaf), ($size / 1KB))
    Get-ChildItem $Dir -Filter 'online-*.dump' | Sort-Object Name -Descending | Select-Object -Skip $Keep | Remove-Item -Force
    Write-Host "Backup OK: $file"
} catch {
    Remove-Item $file -Force -ErrorAction SilentlyContinue
    Log ("FAILED: {0}" -f $_.Exception.Message)
    Write-Host "Backup FAILED: $($_.Exception.Message)"
    exit 1
}
