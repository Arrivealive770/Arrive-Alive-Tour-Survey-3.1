@echo off
REM ===================================================================
REM Arrive Alive Tour - prepare the BACKUP computer's settings
REM
REM Double-click this on the MAIN desktop. Runs prepare-backup-computer.ps1,
REM which writes the backup computer's settings file to your Desktop and
REM restarts this server. See "Backup computer" in desktop\README.md.
REM ===================================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0prepare-backup-computer.ps1" %*

echo.
pause
