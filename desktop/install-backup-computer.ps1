# ===================================================================
# Arrive Alive Tour - set up THIS computer as the backup (Windows)
#
# Run ONCE on the backup computer, in PowerShell, as Administrator:
#   cd C:\ArriveAlive
#   powershell -ExecutionPolicy Bypass -File desktop\install-backup-computer.ps1
#
# Before running it you need:
#   - Tailscale installed and signed in, with this computer named
#     "arrivealive-backup" in the Tailscale admin page
#   - the project in C:\ArriveAlive and Bun installed (guide steps 1-2)
#   - ArriveAlive-backup-settings.env on this Desktop, made on the main
#     desktop by prepare-backup-computer.bat
#
# It puts the settings in place, runs the normal auto-start installer,
# publishes the server on Tailscale, starts it, and checks that it can see
# the main server. Re-running is safe.
# ===================================================================

$ErrorActionPreference = "Stop"

$DesktopDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $DesktopDir
$EnvFile = Join-Path $Root "backend\.env"

function Write-Step($text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }
function Write-Bad($text)  { Write-Host "   $text" -ForegroundColor Red }
function Write-Good($text) { Write-Host "   $text" -ForegroundColor Green }
function Write-Note($text) { Write-Host "   $text" -ForegroundColor DarkGray }

$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Bad "Right-click PowerShell and choose 'Run as Administrator', then try again."
  exit 1
}

# ------------------------------------------------------------ settings file
Write-Step "1/4  Settings"

$candidates = @(
  (Join-Path ([Environment]::GetFolderPath("Desktop")) "ArriveAlive-backup-settings.env"),
  (Join-Path $env:USERPROFILE "Downloads\ArriveAlive-backup-settings.env"),
  (Join-Path $Root "ArriveAlive-backup-settings.env")
)
$settings = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($settings) {
  $text = Get-Content $settings -Raw
  if ($text -notmatch '(?m)^\s*SERVER_ROLE\s*=\s*"?backup"?') {
    Write-Bad "$settings is not a backup settings file. Make it again with prepare-backup-computer.bat on the main desktop."
    exit 1
  }
  # Never turn the MAIN desktop into a backup by accident.
  if (Test-Path $EnvFile) {
    $current = Get-Content $EnvFile -Raw
    if ($current -notmatch '(?m)^\s*SERVER_ROLE\s*=\s*"?backup"?') {
      Write-Bad "This computer already has a backend\.env that is NOT a backup's."
      Write-Bad "If this is the main desktop, stop - run this on the backup computer instead."
      Write-Bad "If it really is the backup computer, delete backend\.env and run this again."
      exit 1
    }
  }
  Copy-Item $settings $EnvFile -Force
  Write-Good "Settings copied from $settings"
}
elseif (Test-Path $EnvFile) {
  Write-Note "No new settings file found; keeping the existing backend\.env."
}
else {
  Write-Bad "Could not find ArriveAlive-backup-settings.env on this Desktop or in Downloads."
  Write-Bad "Make it on the main desktop with prepare-backup-computer.bat and copy it here."
  exit 1
}

$envText = Get-Content $EnvFile -Raw
function Get-Setting([string]$name) {
  if ($envText -match "(?m)^\s*$name\s*=\s*""?([^""\r\n]*)""?") { return $Matches[1].Trim() }
  return $null
}
$backupUrl = (Get-Setting "BACKEND_URL").TrimEnd("/")
$mainUrl = (Get-Setting "MAIN_SERVER_URL").TrimEnd("/")
$expectedName = ([Uri]$backupUrl).Host.Split(".")[0]
Write-Note "This computer will be:  $backupUrl"
Write-Note "Watching the main one:  $mainUrl"

# --------------------------------------------------------------- tailscale
Write-Step "2/4  Tailscale"

$tailscale = $null
$found = Get-Command tailscale.exe -ErrorAction SilentlyContinue
if ($found) { $tailscale = $found.Source }
elseif (Test-Path "C:\Program Files\Tailscale\tailscale.exe") { $tailscale = "C:\Program Files\Tailscale\tailscale.exe" }

if (-not $tailscale) {
  Write-Bad "Tailscale is not installed. Install it from tailscale.com, sign in with the same account as the main desktop, then run this again."
  exit 1
}

$nameOk = $false
try {
  $status = & $tailscale status --json 2>$null | Out-String | ConvertFrom-Json
  $dnsName = "$($status.Self.DNSName)".TrimEnd(".")
  if ($dnsName -eq ([Uri]$backupUrl).Host) {
    $nameOk = $true
    Write-Good "Tailscale name is right: $dnsName"
  }
  else {
    Write-Bad "This computer's Tailscale name is '$dnsName', but the tablets will look for '$(([Uri]$backupUrl).Host)'."
    Write-Bad "Open https://login.tailscale.com/admin/machines, click the ... next to this computer,"
    Write-Bad "choose 'Edit machine name', and set it to exactly:  $expectedName"
    Write-Bad "Also choose 'Disable key expiry' there. Then run this again."
  }
}
catch {
  Write-Bad "Could not read Tailscale's status. Is it signed in? Then run this again."
}
if (-not $nameOk) { exit 1 }

& $tailscale serve --bg 3000 | Out-Null
Write-Good "Server published on Tailscale (https://$(([Uri]$backupUrl).Host))"
Write-Note "In the Tailscale admin page, make sure 'Disable key expiry' is set for this computer."

# --------------------------------------------------------------- auto-start
Write-Step "3/4  Auto-start (the same installer the main desktop used)"
& powershell -ExecutionPolicy Bypass -File (Join-Path $DesktopDir "install-autostart.ps1")
if ($LASTEXITCODE -ne 0) {
  Write-Bad "The auto-start installer stopped - see the message above."
  exit 1
}

# ----------------------------------------------------------------- start it
Write-Step "4/4  Starting the backup server and checking it can see the main one"

Stop-ScheduledTask -TaskName ArriveAliveServer -ErrorAction SilentlyContinue
Get-Process bun -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName ArriveAliveServer
Write-Note "The first start installs everything - give it a few minutes..."

$state = $null
$deadline = (Get-Date).AddMinutes(6)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 10
  try {
    $state = (Invoke-RestMethod "http://localhost:3000/api/failover/status" -TimeoutSec 5).data
    if ($state.lastCopyAt -or $state.lastCopyError) { break }
  }
  catch { }
}

Write-Host ""
if (-not $state) {
  Write-Bad "The server did not start. Look at the end of desktop\logs\server.log for the reason:"
  Write-Host "   Get-Content $DesktopDir\logs\server.log -Tail 30"
  exit 1
}
if ($state.role -ne "backup") {
  Write-Bad "The server started, but not as the backup. Check SERVER_ROLE in backend\.env."
  exit 1
}
if ($state.lastCopyError) {
  Write-Bad "The backup server is running, but it cannot copy the main server yet:"
  Write-Bad "  $($state.lastCopyError)"
  exit 1
}
if (-not $state.lastCopyAt) {
  Write-Bad "The backup server is running, but has not copied the main server yet."
  Write-Bad "Check the main desktop is on, then open http://localhost:3000/admin here in a few minutes."
  exit 1
}

Write-Good "Backup computer is ready. It copied the main server and is on standby."
Write-Host ""
Write-Host "  On the main desktop's admin site you should now see:" -ForegroundColor White
Write-Host "    'Backup computer: ready. Last copied this server ... seconds ago.'" -ForegroundColor Green
Write-Host ""
Write-Host "  Leave this computer switched on. If the main desktop stops answering for"
Write-Host "  3 minutes, this one takes over by itself, and hands everything back when"
Write-Host "  the main desktop returns."
Write-Host ""
Write-Host "  Delete ArriveAlive-backup-settings.env from the Desktop - it holds your email key." -ForegroundColor DarkGray
