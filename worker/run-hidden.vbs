' worker/run-hidden.vbs
' Launches worker\supervise.ps1 with NO visible window (Task Scheduler running powershell directly flashes a console).
' Usage: wscript.exe run-hidden.vbs market    (or: broker)
Dim shell, here, name
Set shell = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
If WScript.Arguments.Count < 1 Then WScript.Quit 2
name = WScript.Arguments(0)
shell.Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File """ & here & "\supervise.ps1"" -Name " & name, 0, False
