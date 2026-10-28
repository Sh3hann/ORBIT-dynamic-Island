Set WshShell = CreateObject("WScript.Shell")
Set Fso = CreateObject("Scripting.FileSystemObject")
Root = Fso.GetParentFolderName(Fso.GetParentFolderName(WScript.ScriptFullName))
WshShell.CurrentDirectory = Root
' Developer launcher: starts ORBIT from source with no console window
WshShell.Run """" & Root & "\node_modules\electron\dist\electron.exe"" """ & Root & """", 0, False
