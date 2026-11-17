# Đăng ký hai việc chạy tự động cho app cờ vua:
#   - "LatCo-Server": bật server + tunnel mỗi khi đăng nhập Windows
#   - "LatCo-Backup": sao lưu database mỗi đêm 2 giờ sáng
#
# CHẠY TAY, không tự chạy: đây là thay đổi trên máy bạn nên bạn tự quyết.
#   Bật:  powershell -ExecutionPolicy Bypass -File scripts\setup-autostart.ps1
#   Tắt:  powershell -ExecutionPolicy Bypass -File scripts\setup-autostart.ps1 -Remove
#   Xem:  Get-ScheduledTask -TaskName LatCo-*
#
# Không đụng tới việc đã có sẵn trên máy (dịch vụ cloudflared, tunnel Ollama).

param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$goc = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$ten = @('LatCo-Server', 'LatCo-Backup')

if ($Remove) {
  foreach ($t in $ten) {
    if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $t -Confirm:$false
      Write-Output "Da go $t"
    } else {
      Write-Output "$t chua dang ky"
    }
  }
  return
}

foreach ($t in $ten) {
  if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $t -Confirm:$false
  }
}

# --- Server + tunnel, chay khi dang nhap ---
# -WindowStyle Hidden de khong hien cua so den moi lan dang nhap.
$aServer = New-ScheduledTaskAction -Execute $node -Argument 'scripts\public.mjs' -WorkingDirectory $goc
$tServer = New-ScheduledTaskTrigger -AtLogOn
$sServer = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartInterval (New-TimeSpan -Minutes 2) -RestartCount 5 -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'LatCo-Server' -Action $aServer -Trigger $tServer -Settings $sServer -Description 'Lat Co: server + tunnel' | Out-Null
Write-Output 'Da dang ky LatCo-Server (chay khi dang nhap Windows)'

# --- Sao luu hang dem ---
$aBackup = New-ScheduledTaskAction -Execute $node -Argument 'scripts\backup.mjs' -WorkingDirectory $goc
$tBackup = New-ScheduledTaskTrigger -Daily -At 2am
$sBackup = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'LatCo-Backup' -Action $aBackup -Trigger $tBackup -Settings $sBackup -Description 'Lat Co: sao luu database' | Out-Null
Write-Output 'Da dang ky LatCo-Backup (2 gio sang moi ngay)'

Write-Output ''
Write-Output 'Luu y: LatCo-Server chay `npm run public` ma KHONG dung lai dist.'
Write-Output 'Sau moi lan sua code, chay `npm run build` roi khoi dong lai task.'
