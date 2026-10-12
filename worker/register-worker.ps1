# worker/register-worker.ps1
# Registers a Task Scheduler task that keeps a DNSE worker running for the current user.
# Usage:  powershell -ExecutionPolicy Bypass -File worker\register-worker.ps1 -Name market
#         powershell -ExecutionPolicy Bypass -File worker\register-worker.ps1 -Name market -Remove
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 reads .ps1 as ANSI without a BOM).
#
# Runs at logon and is re-launched every 10 minutes as a safety net. supervise.ps1 holds a mutex, so extra
# launches exit at once. Runs only while this user is logged on, so no password is stored anywhere.

param(
    [Parameter(Mandatory = $true)][ValidateSet('market', 'broker', 'advisory')][string]$Name,
    [switch]$Remove
)
$ErrorActionPreference = 'Stop'
$task = "Latbai worker $Name"

if ($Remove) {
    if (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $task -Confirm:$false
        Write-Host "Removed task: $task"
    } else { Write-Host "No such task: $task" }
    exit 0
}

$vbs = Join-Path $PSScriptRoot 'run-hidden.vbs'
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ("`"$vbs`" $Name")
$logon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $task -Action $action -Trigger @($logon, $repeat) -Settings $settings -Principal $principal `
    -Description "Keeps the Lat Bai DNSE $Name worker running (supervise.ps1). Remove: register-worker.ps1 -Name $Name -Remove" -Force | Out-Null
Write-Host "Registered task: $task"
Get-ScheduledTask -TaskName $task | Select-Object TaskName, State | Format-Table -AutoSize | Out-String | Write-Host
