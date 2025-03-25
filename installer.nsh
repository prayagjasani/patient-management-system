!macro customInit
  ; Aggressively kill any existing instance
  ExecWait 'taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /t'
  ExecWait '"$LOCALAPPDATA\${APP_EXECUTABLE_FILENAME}" --force-quit'
  Sleep 1000
!macroend

!macro customUnInit
  ; Aggressively kill any existing instance before uninstall
  ExecWait 'taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /t'
  ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --force-quit'
  Sleep 1000
!macroend

!macro customInstall
  ; Add custom installation code here
!macroend

!macro customUnInstall
  ; Add custom uninstallation code here
!macroend 