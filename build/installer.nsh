; ORBIT installer hooks
!macro customUnInstall
  ; Remove the "Start with Windows" entry so nothing is left behind after uninstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ORBIT"
!macroend
