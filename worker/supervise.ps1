# worker/supervise.ps1
# Keeps one DNSE worker running: starts it, waits, restarts it if it exits.
# Usage: powershell -File supervise.ps1 -Name market    (or: -Name broker, -Name advisory)
#
# NOTE: ASCII-only on purpose. Windows PowerShell 5.1 reads .ps1 files as ANSI without a BOM.
#
# - Only ONE supervisor per worker: a named mutex stops a second copy (Task Scheduler re-launches it
#   every few minutes as a safety net, the extra copies exit immediately).
# - Secrets stay in .env.local (node reads it via --env-file). Nothing secret is printed or logged here.
# - Log: worker\logs\<name>.log, trimmed when it grows past 1 MB.

param([Parameter(Mandatory = $true)][ValidateSet('market', 'broker', 'advisory')][string]$Name)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$script = @{ market = 'worker\market-stream.mjs'; broker = 'worker\broker-stream.mjs'; advisory = 'worker\advisory-worker.mjs' }[$Name]
$logDir = Join-Path $PSScriptRoot 'logs'
$log = Join-Path $logDir ("$Name.log")
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$mutex = New-Object System.Threading.Mutex($false, "Global\latbai-worker-$Name")
if (-not $mutex.WaitOne(0)) { exit 0 }   # another supervisor already owns this worker

function Write-Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) -Encoding utf8 }
function Trim-Log {
    if ((Test-Path $log) -and ((Get-Item $log).Length -gt 1MB)) {
        $tail = Get-Content $log -Tail 500
        Set-Content -Path $log -Value $tail -Encoding utf8
    }
}

$node = (Get-Command node -ErrorAction Stop).Source
Set-Location $root
Write-Log "supervisor start ($Name), node=$node"

$fails = 0
while ($true) {
    Trim-Log
    $started = Get-Date
    Write-Log "starting $script"
    # Merge stdout+stderr into the log. Child process inherits no console window.
    $p = Start-Process -FilePath $node -ArgumentList @('--env-file=.env.local', $script) -WorkingDirectory $root `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir "$Name.out") -RedirectStandardError (Join-Path $logDir "$Name.err")
    $p.WaitForExit()
    $ran = [int]((Get-Date) - $started).TotalSeconds
    foreach ($f in @("$Name.out", "$Name.err")) {
        $fp = Join-Path $logDir $f
        if (Test-Path $fp) { Get-Content $fp -Tail 40 -Encoding UTF8 | ForEach-Object { Add-Content -Path $log -Value $_ -Encoding utf8 }; Remove-Item $fp -Force }
    }
    Write-Log ("worker exited code={0} after {1}s" -f $p.ExitCode, $ran)
    # Back off when it dies quickly (bad config, DNSE rejecting auth) so we never hammer DNSE.
    if ($ran -lt 30) { $fails++ } else { $fails = 0 }
    $wait = [Math]::Min(5 * [Math]::Pow(2, [Math]::Min($fails, 6)), 300)
    Write-Log ("restart in {0}s" -f $wait)
    Start-Sleep -Seconds $wait
}
