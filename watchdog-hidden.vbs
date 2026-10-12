' Launches watchdog-proxy.ps1 with NO visible window.
' Task Scheduler running powershell.exe directly flashes a console every run;
' at a 10-minute interval that is annoying enough that the watchdog would just
' get disabled. WScript.Shell.Run with intWindowStyle=0 is genuinely hidden.
' Arg 3 (bWaitOnReturn) = False so this shim exits immediately.
Dim shell, here
Set shell = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File """ & here & "\watchdog-proxy.ps1""", 0, False
