# register-watchdog.ps1
# Installs (or re-installs) the Scheduled Task that keeps local-proxy.js alive.
# Run once. No Administrator rights needed - this registers a task for the
# CURRENT USER only, which is correct: the proxy only matters while you are
# logged in and the PC is on.
#
# ASCII-only on purpose (see note in watchdog-proxy.ps1).
#
# Uninstall:  Unregister-ScheduledTask -TaskName 'Latthe local-proxy watchdog' -Confirm:$false
# Inspect:    Get-ScheduledTask -TaskName 'Latthe local-proxy watchdog' | Get-ScheduledTaskInfo
# Log:        watchdog-proxy.log next to this script (only written when it acts)

$ErrorActionPreference = 'Stop'

$taskName  = 'Latthe local-proxy watchdog'
$scriptDir = $PSScriptRoot
$vbsPath   = Join-Path $scriptDir 'watchdog-hidden.vbs'

if (-not (Test-Path $vbsPath)) {
    throw "Not found: $vbsPath"
}

# wscript.exe runs the shim, which starts PowerShell with no visible window.
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbsPath`""

# Repeat forever, every 10 minutes. Start 1 minute from now so the first run is
# soon but not racing this registration.
# NOTE: do NOT pass -RepetitionDuration ([TimeSpan]::MaxValue) - it serialises to
# P99999999DT23H59M59S and Task Scheduler rejects it ("value ... out of range").
# Omitting -RepetitionDuration means "repeat indefinitely", which is what we want.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 10)

# StartWhenAvailable: catch up if the PC was asleep at the scheduled moment.
# ExecutionTimeLimit 5m: the script waits at most ~20s, so anything longer is
# stuck - let Task Scheduler kill it rather than pile up instances.
# MultipleInstances IgnoreNew: never run two watchdogs at once.
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -MultipleInstances IgnoreNew

# Re-register cleanly if it already exists.
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Task already exists - replacing it."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings `
    -Description 'Restarts local-proxy.js (:11435) if it dies, so latbai.vn keeps using local Ollama instead of silently falling back to DeepSeek.' | Out-Null

# Verify rather than trust: Register-ScheduledTask surfaces some failures as
# non-terminating CIM errors, so without this check the script would happily
# print "Registered" after having registered nothing.
$created = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $created) {
    throw "Registration FAILED - task '$taskName' does not exist afterwards."
}

Write-Host "Registered '$taskName' - runs every 10 minutes, hidden."
Write-Host "First run: about 1 minute from now."
