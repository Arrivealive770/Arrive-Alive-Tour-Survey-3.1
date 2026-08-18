# =====================================================================
# Arrive Alive Tour - desktop auto-start installer (Windows)
#
# Run ONCE, in PowerShell, as Administrator:
#   cd C:\ArriveAlive
#   powershell -ExecutionPolicy Bypass -File desktop\install-autostart.ps1
#
# Creates two scheduled tasks:
#   ArriveAliveServer - starts the survey server at boot
#   ArriveAliveBackup - backs up the survey database nightly
#
# Re-running is safe: existing tasks with these names are replaced.
# =====================================================================

$ErrorActionPreference = "Stop"

# --- Must be admin, or task registration fails halfway with a vague error
$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host "ERROR: right-click PowerShell and choose 'Run as Administrator', then try again." -ForegroundColor Red
  exit 1
}

# --- Resolve paths from this script's location, not the current directory,
# --- so it works no matter where you run it from.
$DesktopDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $DesktopDir
$StartBat   = Join-Path $DesktopDir "start-server.bat"
$BackupTs   = Join-Path $DesktopDir "backup-database.ts"
$EnvFile    = Join-Path $RepoRoot  "backend\.env"

Write-Host "Repo root: $RepoRoot"

foreach ($f in @($StartBat, $BackupTs)) {
  if (-not (Test-Path $f)) { Write-Host "ERROR: missing $f" -ForegroundColor Red; exit 1 }
}

if (-not (Test-Path $EnvFile)) {
  Write-Host "ERROR: backend\.env not found. Complete step 4 in desktop\README.md first." -ForegroundColor Red
  exit 1
}

# --- OneDrive check. A SQLite database inside a synced folder gets copied
# --- mid-write and restores corrupt. This is the single most likely way to
# --- lose a season of survey data, so refuse rather than warn.
if ($RepoRoot -match "OneDrive|Dropbox|Google Drive|iCloudDrive") {
  Write-Host ""
  Write-Host "ERROR: this folder is inside a cloud-synced directory:" -ForegroundColor Red
  Write-Host "  $RepoRoot" -ForegroundColor Red
  Write-Host ""
  Write-Host "Cloud sync corrupts live databases. Move the project to a plain" -ForegroundColor Yellow
  Write-Host "folder such as C:\ArriveAlive and run this again." -ForegroundColor Yellow
  exit 1
}

# --- Locate bun.exe now and bake the full path into the tasks, so boot-time
# --- runs do not depend on PATH being set up for a logged-in user.
$Bun = $null
$BunCandidate = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
if (Test-Path $BunCandidate) {
  $Bun = $BunCandidate
} else {
  $found = Get-Command bun.exe -ErrorAction SilentlyContinue
  if ($found) { $Bun = $found.Source }
}

if (-not $Bun) {
  Write-Host "ERROR: bun.exe not found. Install Bun first (step 2 in README), then re-run." -ForegroundColor Red
  exit 1
}
Write-Host "Found Bun: $Bun"

# --- S4U runs the task as you, at boot, without storing your password and
# --- without needing you to be logged in. That combination is what makes the
# --- server come back by itself after a Windows Update reboot.
$Principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType S4U `
  -RunLevel Highest

# StartWhenAvailable catches the case where the machine was off at the
# scheduled backup time. IgnoreNew stops a second server starting on top of
# a running one and both fighting over the same database file.
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

# ---------------------------------------------------------------- server
Write-Host ""
Write-Host "Registering ArriveAliveServer (starts at boot)..."

$ServerAction = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument "/c `"$StartBat`"" `
  -WorkingDirectory $DesktopDir

Register-ScheduledTask `
  -TaskName "ArriveAliveServer" `
  -Action $ServerAction `
  -Trigger (New-ScheduledTaskTrigger -AtStartup) `
  -Principal $Principal `
  -Settings $Settings `
  -Description "Arrive Alive Tour survey server. Starts automatically at boot." `
  -Force | Out-Null

Write-Host "  done" -ForegroundColor Green

# ---------------------------------------------------------------- backup
# 2:37am rather than 2:00 or 3:00 - off the hour, so it does not collide
# with Windows Update and every other scheduled job on the machine.
Write-Host "Registering ArriveAliveBackup (nightly at 2:37am)..."

$BackupAction = New-ScheduledTaskAction `
  -Execute $Bun `
  -Argument "--env-file=backend\.env desktop\backup-database.ts" `
  -WorkingDirectory $RepoRoot

Register-ScheduledTask `
  -TaskName "ArriveAliveBackup" `
  -Action $BackupAction `
  -Trigger (New-ScheduledTaskTrigger -Daily -At "2:37AM") `
  -Principal $Principal `
  -Settings $Settings `
  -Description "Nightly backup of the Arrive Alive survey database." `
  -Force | Out-Null

Write-Host "  done" -ForegroundColor Green

# --------------------------------------------------------------- firewall
# The server listens on 0.0.0.0:3000, so it is already willing to serve
# other machines on the LAN. Windows Firewall blocks it by default though,
# and the usual "allow this app?" popup never appears here because the
# server starts at boot with nobody logged in to click it.
#
# Private and Domain profiles only. Deliberately NOT Public: if this
# machine ever joins an untrusted network, the survey database should not
# be reachable from it. The Cloudflare Tunnel in step 6 is how the outside
# world gets in, and that needs no inbound rule at all.
Write-Host ""
Write-Host "Allowing other computers on your network to reach the server..."

Get-NetFirewallRule -DisplayName "Arrive Alive Survey Server" -ErrorAction SilentlyContinue |
  Remove-NetFirewallRule -ErrorAction SilentlyContinue

New-NetFirewallRule `
  -DisplayName "Arrive Alive Survey Server" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 3000 `
  -Action Allow `
  -Profile Private,Domain `
  -Description "Lets other computers and tablets on the local network reach the Arrive Alive survey server." | Out-Null

Write-Host "  done" -ForegroundColor Green

# ------------------------------------------------------------------ power
# A sleeping desktop cannot receive syncs from the field. Disable sleep and
# hibernate on AC power; the screen is still free to switch off.
Write-Host ""
Write-Host "Stopping the desktop from sleeping while plugged in..."
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
Write-Host "  done" -ForegroundColor Green

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Setup complete" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# --- The firewall rule above only applies on Private/Domain networks. If
# --- Windows has this machine's network marked Public, the rule is inert
# --- and other computers get a silent timeout, which is a miserable thing
# --- to debug. Say so now rather than let them find out.
$publicNets = Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq "Public" }
if ($publicNets) {
  Write-Host ""
  Write-Host "NOTE: Windows treats your network as 'Public', so other computers" -ForegroundColor Yellow
  Write-Host "cannot reach the server yet. To change it:" -ForegroundColor Yellow
  Write-Host "  Settings > Network & Internet > (your connection) > Private network" -ForegroundColor Yellow
}

# --- Print the LAN address so they do not have to go hunting through
# --- ipconfig output to find it.
$lanIp = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
  Select-Object -First 1 -ExpandProperty IPAddress

Write-Host ""
Write-Host "On this desktop:      http://localhost:3000/admin"
if ($lanIp) {
  Write-Host "From other computers: http://${lanIp}:3000/admin"
  Write-Host "  (that address can change when the desktop reconnects to the network)"
}

Write-Host ""
Write-Host "Start the server now without rebooting:"
Write-Host "  Start-ScheduledTask -TaskName ArriveAliveServer"
Write-Host ""
Write-Host "Check it is running:"
Write-Host "  curl http://localhost:3000/health"
Write-Host ""
Write-Host "Watch the log:"
Write-Host "  Get-Content desktop\logs\server.log -Tail 30 -Wait"
Write-Host ""
Write-Host "Test the backup right now (do not wait for tonight):"
Write-Host "  Start-ScheduledTask -TaskName ArriveAliveBackup"
Write-Host ""
Write-Host "Next: set up the Cloudflare Tunnel - step 6 in desktop\README.md."
Write-Host "Until then the server is reachable only from this desktop."
