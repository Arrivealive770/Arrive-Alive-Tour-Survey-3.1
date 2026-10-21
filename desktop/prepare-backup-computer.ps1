# ===================================================================
# Arrive Alive Tour - prepare the BACKUP computer's settings (Windows)
#
# Run this on the MAIN desktop (C:\ArriveAlive), once. Double-click
# desktop\prepare-backup-computer.bat, which runs this.
#
# It does three things:
#   1. Makes up a secret key the two computers use to prove who they are
#      (FAILOVER_KEY), and adds it plus the backup's address to this
#      computer's backend\.env.
#   2. Writes the backup computer's whole settings file to this computer's
#      Desktop as ArriveAlive-backup-settings.env. Copy that file to the
#      backup computer (USB stick) and run install-backup-computer.bat there.
#   3. Restarts this server so it starts accepting the backup's copies.
#
# Running it again is safe: the existing key is kept, so a backup computer
# that is already set up keeps working.
# ===================================================================

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root "backend\.env"

function Write-Bad($text)  { Write-Host "   $text" -ForegroundColor Red }
function Write-Good($text) { Write-Host "   $text" -ForegroundColor Green }
function Write-Note($text) { Write-Host "   $text" -ForegroundColor DarkGray }

if (-not (Test-Path $EnvFile)) {
  Write-Bad "backend\.env not found. This must be run on the main desktop, in C:\ArriveAlive."
  exit 1
}

$lines = @(Get-Content $EnvFile)

function Get-Setting([string]$name) {
  $line = $lines | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^\s*$name\s*=\s*", "").Trim().Trim('"')
}

if ((Get-Setting "SERVER_ROLE") -eq "backup") {
  Write-Bad "This computer is set up as the BACKUP. Run this on the main desktop instead."
  exit 1
}

$mainUrl = Get-Setting "BACKEND_URL"
if (-not $mainUrl -or $mainUrl -match "localhost|127\.0\.0\.1") {
  Write-Bad "BACKEND_URL in backend\.env is not this computer's Tailscale address yet ($mainUrl)."
  Write-Bad "Finish step 6 of desktop\README.md first."
  exit 1
}
$mainUrl = $mainUrl.TrimEnd("/")

# The tablets look for the backup at the same name with "-backup" added:
# arrivealive.tail04a318.ts.net -> arrivealive-backup.tail04a318.ts.net.
# That name is compiled into the app (mobile\src\lib\api\backend-url.ts), so
# it has to be exactly this.
$uri = [Uri]$mainUrl
$labels = $uri.Host.Split(".")
$labels[0] = "$($labels[0])-backup"
$backupHost = $labels -join "."
$backupUrl = "https://$backupHost"
$backupMachineName = $labels[0]

$key = Get-Setting "FAILOVER_KEY"
if (-not $key) {
  $key = -join ((1..24) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
  Write-Note "Made a new failover key."
}
else {
  Write-Note "Keeping the existing failover key."
}

# ---------------------------------------------------- this computer's .env
$kept = @($lines | Where-Object { $_ -notmatch '^\s*(FAILOVER_KEY|BACKUP_SERVER_URL)\s*=' })
$kept + "BACKUP_SERVER_URL=`"$backupUrl`"" + "FAILOVER_KEY=`"$key`"" |
  Set-Content -Path $EnvFile -Encoding ascii
Write-Good "Added the backup settings to this computer's backend\.env"

# ------------------------------------------------ the backup's settings file
$authSecret = Get-Setting "BETTER_AUTH_SECRET"
$resendKey = Get-Setting "RESEND_API_KEY"

$backupEnv = @(
  "# Settings for the Arrive Alive BACKUP computer."
  "# Made on the main desktop by desktop\prepare-backup-computer.ps1."
  "# Goes in C:\ArriveAlive\backend\.env on the backup computer."
  "DATABASE_URL=`"file:./prod.db`""
  "BETTER_AUTH_SECRET=`"$authSecret`""
  "BACKEND_URL=`"$backupUrl`""
  "NODE_ENV=`"production`""
  "RESEND_API_KEY=`"$resendKey`""
  "SERVER_ROLE=`"backup`""
  "MAIN_SERVER_URL=`"$mainUrl`""
  "FAILOVER_KEY=`"$key`""
)

$desktopFolder = [Environment]::GetFolderPath("Desktop")
$settingsFile = Join-Path $desktopFolder "ArriveAlive-backup-settings.env"
$backupEnv | Set-Content -Path $settingsFile -Encoding ascii
Write-Good "Wrote the backup computer's settings to:"
Write-Host "     $settingsFile" -ForegroundColor Yellow

# ------------------------------------------------------- restart the server
Write-Host ""
Write-Note "Restarting this server so it picks up the new settings..."
& (Join-Path $PSScriptRoot "update-all.ps1") -SkipTablets

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host " Next, on the BACKUP computer" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  1. Install Tailscale, sign in to the same account, and in the Tailscale"
Write-Host "     admin page name that computer exactly:  $backupMachineName" -ForegroundColor Yellow
Write-Host "  2. Put the project in C:\ArriveAlive and install Bun (steps 1-2 of the guide)."
Write-Host "  3. Copy ArriveAlive-backup-settings.env from this Desktop onto its Desktop."
Write-Host "  4. Right-click PowerShell > Run as Administrator, then:"
Write-Host "       cd C:\ArriveAlive"
Write-Host "       powershell -ExecutionPolicy Bypass -File desktop\install-backup-computer.ps1"
Write-Host ""
Write-Host "The settings file holds your email key. Delete it from this Desktop" -ForegroundColor DarkGray
Write-Host "once the backup computer is running." -ForegroundColor DarkGray
