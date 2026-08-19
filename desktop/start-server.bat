@echo off
REM ===================================================================
REM Arrive Alive Tour - desktop server launcher (Windows)
REM
REM Started automatically at boot by the Task Scheduler entry that
REM desktop\install-autostart.ps1 creates. Safe to double-click by hand
REM too, but run it from a Command Prompt window if you want to watch it
REM - there is deliberately no "pause" anywhere, because a pause inside a
REM scheduled task waits for a keypress that never comes and the server
REM would never start.
REM
REM Everything is appended to desktop\logs\server.log instead, which is
REM the only record you get when this runs at boot with no one watching.
REM ===================================================================
setlocal enabledelayedexpansion

set "ROOT=%~dp0.."
set "LOGDIR=%~dp0logs"
set "LOG=%LOGDIR%\server.log"

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

echo. >> "%LOG%"
echo ================================================== >> "%LOG%"
echo Starting at %DATE% %TIME% >> "%LOG%"
echo ================================================== >> "%LOG%"

REM Locate bun.exe explicitly. Bun installs per-user, so when this runs
REM at boot (before anyone logs in) the PATH may not include it yet. An
REM unqualified "bun" would fail with a confusing "not recognized" error.
set "BUN="
if exist "%USERPROFILE%\.bun\bin\bun.exe" set "BUN=%USERPROFILE%\.bun\bin\bun.exe"
if not defined BUN (
  for /f "delims=" %%i in ('where bun.exe 2^>nul') do if not defined BUN set "BUN=%%i"
)
if not defined BUN (
  echo ERROR: could not find bun.exe. Install Bun, then re-run desktop\install-autostart.ps1. >> "%LOG%"
  exit /b 1
)
echo Using bun: !BUN! >> "%LOG%"

cd /d "%ROOT%\backend" || (
  echo ERROR: could not enter "%ROOT%\backend". >> "%LOG%"
  exit /b 1
)

REM Notepad appends .txt unless "All Files" is picked when saving, and Windows
REM hides known extensions, so backend\.env.txt looks identical to backend\.env
REM in Explorer. install-autostart.ps1 repairs this at install time; do the same
REM here, because this is what actually runs at boot with nobody watching.
if not exist ".env" (
  if exist ".env.txt" (
    echo Found .env.txt instead of .env - renaming it. >> "%LOG%"
    ren ".env.txt" ".env" >> "%LOG%" 2>&1
  )
)

if not exist ".env" (
  echo ERROR: backend\.env is missing - see desktop\README.md step 4. >> "%LOG%"
  exit /b 1
)

REM A failed install is only fatal on a machine that has never installed. This
REM runs at boot in venues with flaky or absent Wi-Fi, and a transient npm
REM tarball error must not be the reason a working kiosk refuses to start.
echo Installing dependencies... >> "%LOG%"
call "!BUN!" install >> "%LOG%" 2>&1
if errorlevel 1 (
  if exist "node_modules\@prisma\client\package.json" (
    echo WARNING: bun install failed - continuing with the packages already installed. >> "%LOG%"
    echo WARNING: if the app misbehaves, run "bun install" by hand with internet access. >> "%LOG%"
  ) else (
    echo ERROR: bun install failed and node_modules is not usable yet. >> "%LOG%"
    echo ERROR: connect this computer to the internet and try again. >> "%LOG%"
    exit /b 1
  )
)

REM "!BUN!" is a full path to bun.exe, so "!BUN!x" spelled bun.exex and cmd
REM reported it as "not recognized". `bun x` is the same thing as `bunx` and
REM needs no second executable on disk.
echo Preparing database... >> "%LOG%"
call "!BUN!" x prisma generate >> "%LOG%" 2>&1 || (
  echo ERROR: prisma generate failed. >> "%LOG%"
  exit /b 1
)

REM No --accept-data-loss here on purpose. This runs unattended against
REM the real survey database, so a schema change that would drop a column
REM must stop and be looked at rather than silently destroy event data.
call "!BUN!" x prisma db push --skip-generate >> "%LOG%" 2>&1 || (
  echo ERROR: prisma db push failed - schema change may need review. >> "%LOG%"
  exit /b 1
)

echo Starting server... >> "%LOG%"
"!BUN!" run src/index.ts >> "%LOG%" 2>&1

echo Server exited at %DATE% %TIME% >> "%LOG%"
