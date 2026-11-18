# Dang ky viec chay tu dong cho Lat Co (latbai.vn):
#   - "LatCo-Server": bat server + tunnel ngrok va GIU cho no song
#       * khi dang nhap Windows
#       * va cu 15 phut mot lan: neu nguoi canh (scripts\public.mjs) da chet vi
#         ly do gi do thi bat lai; con dang chay thi lan nay tu thoat ngay
#   - "LatCo-Backup": sao luu database moi dem 2 gio sang
#
#   Bat:  powershell -ExecutionPolicy Bypass -File scripts\setup-autostart.ps1
#   Tat:  powershell -ExecutionPolicy Bypass -File scripts\setup-autostart.ps1 -Remove
#   Xem:  Get-ScheduledTask -TaskName LatCo-*
#   Nhat ky: data\logs\public.log
#
# Khong dung toi viec da co san tren may (dich vu cloudflared, tunnel Ollama).
# Chi tao/xoa dung hai task co ten LatCo-*.

param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$goc = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$ten = @('LatCo-Server', 'LatCo-Backup')

foreach ($t in $ten) {
  if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $t -Confirm:$false
    if ($Remove) { Write-Output "Da go $t" }
  } elseif ($Remove) {
    Write-Output "$t chua dang ky"
  }
}
if ($Remove) { return }

# --- Server + tunnel ---
$aServer = New-ScheduledTaskAction -Execute $node `
  -Argument 'scripts\public.mjs --tunnel=ngrok --log=data\logs\public.log' `
  -WorkingDirectory $goc
$tLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
# Lap lai moi 15 phut, tu gio tro di, khong het han
$tRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15)
# IgnoreNew: dang co mot ban chay thi lan lap khong bat them ban thu hai.
# Chet bat thuong (ma loi khac 0) thi Windows thu bat lai moi phut.
$sServer = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew -StartWhenAvailable `
  -RestartInterval (New-TimeSpan -Minutes 1) -RestartCount 999 `
  -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'LatCo-Server' -Action $aServer -Trigger @($tLogon, $tRepeat) `
  -Settings $sServer -Description 'Lat Co (latbai.vn): server + tunnel ngrok, tu dung lai khi chet' | Out-Null
Write-Output 'Da dang ky LatCo-Server (khi dang nhap + kiem moi 15 phut)'

# --- Sao luu hang dem ---
$aBackup = New-ScheduledTaskAction -Execute $node -Argument 'scripts\backup.mjs' -WorkingDirectory $goc
$tBackup = New-ScheduledTaskTrigger -Daily -At 2am
$sBackup = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'LatCo-Backup' -Action $aBackup -Trigger $tBackup -Settings $sBackup `
  -Description 'Lat Co: sao luu database' | Out-Null
Write-Output 'Da dang ky LatCo-Backup (2 gio sang moi ngay; may tat luc do thi chay khi bat lai)'
