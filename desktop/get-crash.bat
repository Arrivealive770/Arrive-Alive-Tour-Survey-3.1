@echo off
REM Capture a crash from a tablet over USB.
REM Double-click this, or run desktop\get-crash.ps1 from PowerShell.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get-crash.ps1" %*
pause
