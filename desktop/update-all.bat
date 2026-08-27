@echo off
REM ===================================================================
REM Arrive Alive Tour - update everything (double-click this)
REM
REM Runs desktop\update-all.ps1, which pulls the latest code, restarts
REM the server, and publishes the tablet app over the air.
REM
REM Why a .bat wrapper exists at all: double-clicking a .ps1 file opens
REM it in Notepad rather than running it, and running one from a normal
REM PowerShell window is blocked by the default execution policy. Both
REM problems disappear if a .bat launches it with -ExecutionPolicy Bypass,
REM which applies to this one run only and changes nothing on the machine.
REM
REM The pause at the end is deliberate - unlike start-server.bat, nobody
REM runs this at boot, and without it the window vanishes before you can
REM read whether the update worked.
REM ===================================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-all.ps1" %*

echo.
pause
