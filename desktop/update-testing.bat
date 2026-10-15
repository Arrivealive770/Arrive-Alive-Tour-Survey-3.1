@echo off
REM ===================================================================
REM Arrive Alive Tour - update the TEST copy only (double-click this)
REM
REM Run this from the test copy in C:\ArriveAliveTest, never from the live
REM folder - update-all.ps1 checks and refuses if you get that wrong.
REM
REM It pulls the latest code, restarts the test server, and publishes the
REM app to the test tablet only. The live server and the field tablets are
REM not touched. Once it looks right on the test tablet, run
REM update-all.bat in C:\ArriveAlive to send the same code to the field.
REM ===================================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-all.ps1" -Testing %*

echo.
pause
