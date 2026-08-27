# ===================================================================
# Arrive Alive Tour - capture a crash from a tablet (Windows)
#
# When the app closes on its own, Android writes down why. This gets
# that out of the tablet and into a file you can send on.
#
# You need: the tablet, a USB cable, and Developer options turned on
# (Settings > About tablet > tap "Build number" seven times, then
# Settings > System > Developer options > USB debugging).
#
# Run it:
#
#   cd C:\ArriveAlive
#   .\desktop\get-crash.ps1
#
# Or double-click desktop\get-crash.bat.
#
# It clears the tablet's log, waits while you make the app crash, then
# saves everything to desktop\logs\tablet-crash.txt.
# ===================================================================

[CmdletBinding()]
param(
  # Skip the "reproduce it now" pause and just dump what's already there.
  # Useful if the crash already happened and the tablet hasn't been rebooted.
  [switch]$NoWait
)

$ErrorActionPreference = "Stop"

$Root    = Split-Path -Parent $PSScriptRoot
$LogDir  = Join-Path $PSScriptRoot "logs"
$OutFile = Join-Path $LogDir "tablet-crash.txt"
$Tools   = Join-Path $Root "tools\platform-tools"

function Write-Step($text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }
function Write-Good($text) { Write-Host "   $text" -ForegroundColor Green }
function Write-Bad($text)  { Write-Host "   $text" -ForegroundColor Red }
function Write-Note($text) { Write-Host "   $text" -ForegroundColor DarkGray }

# adb writes ordinary chatter to stderr, which $ErrorActionPreference = "Stop"
# turns into a terminating error. Exit codes are the only reliable signal.
function Invoke-Native {
  param([string]$Exe, [string[]]$Arguments)

  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $Exe @Arguments 2>&1 | Out-String
    return [pscustomobject]@{ Output = $output.Trim(); ExitCode = $LASTEXITCODE }
  }
  finally { $ErrorActionPreference = $previous }
}

# -------------------------------------------------------------------
# 1 - find adb, or fetch it
# -------------------------------------------------------------------
Write-Step "1/4  Finding the Android tools"

$adb = $null

if (Get-Command adb -ErrorAction SilentlyContinue) {
  $adb = "adb"
  Write-Good "Already installed."
}
elseif (Test-Path (Join-Path $Tools "adb.exe")) {
  $adb = Join-Path $Tools "adb.exe"
  Write-Good "Using the copy in tools\platform-tools."
}
else {
  Write-Note "Not installed - downloading Google's copy (about 15 MB, one time)..."
  try {
    $zip = Join-Path $env:TEMP "platform-tools.zip"
    $dest = Join-Path $Root "tools"

    # TLS 1.2 is not the default on Windows PowerShell 5.1 and the download
    # fails without it.
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    Invoke-WebRequest `
      -Uri "https://dl.google.com/android/repository/platform-tools-latest-windows.zip" `
      -OutFile $zip -UseBasicParsing

    if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
    Expand-Archive -Path $zip -DestinationPath $dest -Force
    Remove-Item $zip -ErrorAction SilentlyContinue

    $adb = Join-Path $Tools "adb.exe"
    if (-not (Test-Path $adb)) { throw "The download unpacked but adb.exe isn't where expected." }
    Write-Good "Downloaded to tools\platform-tools."
  }
  catch {
    Write-Bad "Could not download the Android tools: $($_.Exception.Message)"
    Write-Bad "Download platform-tools yourself from developer.android.com/tools/releases/platform-tools"
    Write-Bad "and unzip it into $Root\tools, then run this again."
    exit 1
  }
}

# -------------------------------------------------------------------
# 2 - find the tablet
# -------------------------------------------------------------------
Write-Step "2/4  Looking for the tablet"

Invoke-Native $adb @("start-server") | Out-Null
$devices = Invoke-Native $adb @("devices")

# "List of devices attached" then one line per device. Only "<serial>\tdevice"
# is usable - "unauthorized" means the tablet is waiting for someone to tap
# "Allow" on its screen, and "offline" means the cable or hub is flaky.
$lines = @($devices.Output -split "`r?`n" | Select-Object -Skip 1 | Where-Object { $_.Trim() })
$ready = @($lines | Where-Object { $_ -match "\sdevice$" })
$unauth = @($lines | Where-Object { $_ -match "unauthorized" })

if ($unauth.Count -gt 0) {
  Write-Bad "The tablet is connected but hasn't been trusted yet."
  Write-Bad "Look at the tablet: tap 'Allow USB debugging', tick 'Always allow', then run this again."
  exit 1
}

if ($ready.Count -eq 0) {
  Write-Bad "No tablet found."
  Write-Note "Check all of these:"
  Write-Note "  - the USB cable is a data cable, not a charge-only one"
  Write-Note "  - the tablet is unlocked and awake"
  Write-Note "  - Developer options > USB debugging is ON"
  Write-Note "  - the tablet's USB notification says 'File transfer', not 'Charging'"
  exit 1
}

if ($ready.Count -gt 1) {
  Write-Bad "More than one device is plugged in. Unplug all but the one you're testing."
  exit 1
}

Write-Good "Found it."

# -------------------------------------------------------------------
# 3 - clear the log, let them reproduce it
# -------------------------------------------------------------------
Write-Step "3/4  Recording"

if ($NoWait) {
  Write-Note "Skipping the wait (-NoWait) - dumping whatever is already in the log."
}
else {
  Invoke-Native $adb @("logcat", "-c") | Out-Null
  Write-Good "Log cleared."
  Write-Host ""
  Write-Host "   Now on the tablet: open the app and run right through a survey" -ForegroundColor Yellow
  Write-Host "   until it crashes. Leave the cable plugged in the whole time." -ForegroundColor Yellow
  Write-Host ""
  Read-Host "   When it has crashed, come back here and press Enter"
}

# -------------------------------------------------------------------
# 4 - save it
# -------------------------------------------------------------------
Write-Step "4/4  Saving the log"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

$dump = Invoke-Native $adb @("logcat", "-d", "-v", "time")
$dump.Output | Out-File -FilePath $OutFile -Encoding utf8

# Crash reports also survive a reboot in the dropbox, which is worth having
# when the tablet was restarted before anyone thought to plug it in.
$crashes = Invoke-Native $adb @("shell", "dumpsys", "dropbox", "--print")
if ($crashes.ExitCode -eq 0 -and $crashes.Output) {
  "`n`n===== Saved crash reports (dropbox) =====`n" | Out-File -FilePath $OutFile -Append -Encoding utf8
  $crashes.Output | Out-File -FilePath $OutFile -Append -Encoding utf8
}

$size = [math]::Round((Get-Item $OutFile).Length / 1KB, 1)
Write-Good "Saved $size KB to $OutFile"

# Show the lines that actually say something, so there's an answer on screen
# even before the file gets sent anywhere.
$interesting = @(
  Select-String -Path $OutFile -Pattern "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|CrashGuard|Fatal signal|beginning of crash|com\.arrivealive" `
    -ErrorAction SilentlyContinue | Select-Object -Last 40
)

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
if ($interesting.Count -gt 0) {
  Write-Host " What the tablet said" -ForegroundColor Cyan
  Write-Host "===================================================" -ForegroundColor Cyan
  foreach ($line in $interesting) { Write-Host $line.Line -ForegroundColor Gray }
}
else {
  Write-Host " Nothing obviously crash-shaped in the log" -ForegroundColor Cyan
  Write-Host "===================================================" -ForegroundColor Cyan
  Write-Note "The full log is still saved - send it on and it can be read properly."
}

Write-Host ""
Write-Host "Send this file on:" -ForegroundColor White
Write-Host "  $OutFile" -ForegroundColor Yellow
Write-Host ""
