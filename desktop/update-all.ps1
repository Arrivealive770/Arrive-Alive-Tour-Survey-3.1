# ===================================================================
# Arrive Alive Tour - update everything, in one go (Windows)
#
# Three things can be out of date, and they were three separate jobs:
#
#   1. the project files on this desktop      (git)
#   2. the server + admin website             (restart the scheduled task)
#   3. the tablet app                         (publish over the air)
#
# All three start from the same pulled code, so doing them separately is
# just an opportunity to do two and forget the third. This does all three
# in order and tells you plainly which ones worked.
#
# Run it from PowerShell:
#
#   cd C:\ArriveAlive
#   .\desktop\update-all.ps1
#
# Or double-click desktop\update-all.bat, which is the same thing without
# the execution-policy argument to remember.
#
# Useful switches:
#   -SkipTablets     server only, don't publish to the tablets
#   -SkipServer      tablets only, leave the server running as it is
#   -Message "..."   note attached to the tablet update (default: the commit)
#   -Branch preview  publish target; matches the profile the APKs were built
#                    with. Don't change this unless the APKs changed too.
#
# Nothing here touches backend\.env, the survey database, or the backups.
# ===================================================================

[CmdletBinding()]
param(
  [switch]$SkipServer,
  [switch]$SkipTablets,
  [string]$Message = "",
  [string]$Branch = "preview"
)

$ErrorActionPreference = "Stop"

# Everything is relative to the folder above this script, so the script
# works whether you run it from C:\ArriveAlive or from inside desktop\.
$Root = Split-Path -Parent $PSScriptRoot
$TaskName = "ArriveAliveServer"

# Each step records its own outcome instead of throwing, so one failure
# doesn't hide the results of the others. The summary at the end is the
# part worth reading.
$results = [ordered]@{}

function Write-Step($text) {
  Write-Host ""
  Write-Host "== $text" -ForegroundColor Cyan
}

function Write-Good($text) { Write-Host "   $text" -ForegroundColor Green }
function Write-Bad($text)  { Write-Host "   $text" -ForegroundColor Red }
function Write-Note($text) { Write-Host "   $text" -ForegroundColor DarkGray }

# Run git/eas and hand back their output and exit code.
#
# This exists because of one PowerShell trap: git writes ordinary progress
# ("Fetching origin...") to stderr, and with $ErrorActionPreference = "Stop"
# a redirected stderr line is treated as a terminating error. The script
# would die on the very first fetch, on a completely healthy machine, with
# a NativeCommandError that says nothing useful. Exit codes are the only
# reliable success signal for these tools, so that's what we check.
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
# Step 1 - get the latest code
# -------------------------------------------------------------------
Write-Step "1/3  Getting the latest code"

$commit = "unknown"
try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is not installed on this computer. See desktop\README.md, section B."
  }

  Push-Location $Root
  try {
    $fetch = Invoke-Native git @("fetch", "origin")
    if ($fetch.ExitCode -ne 0) { throw "Could not reach GitHub: $($fetch.Output)" }

    # checkout -B rather than pull: a desktop sitting on 'master' gets a pull
    # that succeeds, prints something reassuring and changes nothing at all.
    # This moves onto main and matches GitHub whatever branch you were on.
    $checkout = Invoke-Native git @("checkout", "-B", "main", "origin/main")
    if ($checkout.ExitCode -ne 0) {
      # Bun rewrites the lockfile on install, which blocks the checkout. It
      # holds nothing of yours, so throw it away and try once more.
      if ($checkout.Output -match "bun.lock") {
        Write-Note "Discarding a locally-modified bun.lock and retrying."
        Invoke-Native git @("checkout", "--", "backend/bun.lock") | Out-Null
        Invoke-Native git @("checkout", "--", "mobile/bun.lock") | Out-Null
        $checkout = Invoke-Native git @("checkout", "-B", "main", "origin/main")
      }
      if ($checkout.ExitCode -ne 0) { throw "git checkout failed: $($checkout.Output)" }
    }

    $commit = (Invoke-Native git @("rev-parse", "--short", "HEAD")).Output
    $subject = (Invoke-Native git @("log", "-1", "--pretty=%s")).Output
  }
  finally { Pop-Location }

  Write-Good "Now on commit $commit"
  Write-Note $subject
  $results["Code"] = "updated to $commit"
}
catch {
  Write-Bad $_.Exception.Message
  $results["Code"] = "FAILED - $($_.Exception.Message)"

  # Everything downstream would publish stale code, which is worse than
  # publishing nothing, because it looks like it worked.
  Write-Host ""
  Write-Bad "Stopping here. Nothing was published, and the server was left alone."
  exit 1
}

if (-not $Message) { $Message = "$commit - $subject" }

# -------------------------------------------------------------------
# Step 2 - restart the server so the desktop runs the new code
# -------------------------------------------------------------------
if ($SkipServer) {
  Write-Step "2/3  Server restart - skipped (-SkipServer)"
  $results["Server"] = "skipped"
}
else {
  Write-Step "2/3  Restarting the server"

  try {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    # Stop-ScheduledTask only kills the cmd.exe wrapper; the bun.exe under it
    # survives and keeps holding port 3000. The replacement server then can't
    # bind, gives up, and the machine carries on serving the OLD code while
    # every restart reports success.
    Get-Process bun -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3

    Start-ScheduledTask -TaskName $TaskName
    Write-Note "Started. Waiting for it to answer (up to 2 minutes)..."

    # First boot after a schema change runs prisma, which is slow. Poll rather
    # than sleeping a fixed time and hoping.
    $health = $null
    $deadline = (Get-Date).AddMinutes(2)
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Seconds 5
      try {
        $health = Invoke-RestMethod http://localhost:3000/health -TimeoutSec 5
        break
      }
      catch { $health = $null }
    }

    if (-not $health) {
      throw "The server never answered. Check desktop\logs\server.log for the reason."
    }

    # /health reports the commit it is actually running. It is the only
    # honest answer to "did my update land?" - a restart that silently
    # failed to take will happily report the previous commit here.
    $serverCommit = "$($health.commit)"
    if (-not $serverCommit) {
      # No commit field at all means the running server predates /health
      # reporting it — so the restart did not take, however healthy it looks.
      Write-Bad "The server answered but didn't report a commit, so it's running old code."
      Write-Bad "Check desktop\logs\server.log, then run this script again."
      $results["Server"] = "WRONG VERSION - no commit reported, restart did not take"
    }
    elseif ($serverCommit -ne "unknown" -and $serverCommit -notlike "$commit*" -and $commit -notlike "$serverCommit*") {
      Write-Bad "The server is answering, but on commit $serverCommit instead of $commit."
      Write-Bad "The old server is probably still holding the port. Run this script again."
      $results["Server"] = "WRONG VERSION - running $serverCommit, expected $commit"
    }
    else {
      Write-Good "Server is up, running commit $serverCommit"
      $results["Server"] = "restarted on $serverCommit"
    }
  }
  catch {
    Write-Bad $_.Exception.Message
    $results["Server"] = "FAILED - $($_.Exception.Message)"
  }
}

# -------------------------------------------------------------------
# Step 3 - publish the tablet app over the air
# -------------------------------------------------------------------
if ($SkipTablets) {
  Write-Step "3/3  Tablet update - skipped (-SkipTablets)"
  $results["Tablets"] = "skipped"
}
else {
  Write-Step "3/3  Publishing the tablet app to '$Branch'"

  try {
    # eas may be installed globally or not at all. npx fetches it on demand,
    # which is slower but always works and needs nothing installed first.
    if (Get-Command eas -ErrorAction SilentlyContinue) {
      $easExe = "eas"; $easArgs = @()
    }
    else {
      Write-Note "eas is not installed - using npx (slower, downloads it each time)."
      $easExe = "npx"; $easArgs = @("--yes", "eas-cli@latest")
    }

    Push-Location (Join-Path $Root "mobile")
    try {
      $publishArgs = $easArgs + @(
        "update",
        "--branch", $Branch,
        "--message", $Message,
        "--non-interactive",
        "--json"
      )

      Write-Note "This takes about a minute..."
      $publish = Invoke-Native $easExe $publishArgs
    }
    finally { Pop-Location }

    $text = $publish.Output

    if ($publish.ExitCode -ne 0) {
      if ($text -match "not logged in|Log in|authentication") {
        throw "Not signed in to Expo. Run 'eas login' once in this window, then run this script again."
      }
      throw "eas update failed:`n$text"
    }

    # --json prints one entry per platform. The id is what the tablets show
    # at the bottom of their menu screen, so pull it out and print the same
    # short form - that's how you check a tablet actually took the update.
    # Written for Windows PowerShell 5.1, which is what ships with Windows -
    # no ?? operator, no ternary.
    $stamp = $null
    try {
      # eas prints progress lines before the JSON, so start at the first
      # bracket rather than handing the whole lot to ConvertFrom-Json.
      $starts = @($text.IndexOf("["), $text.IndexOf("{")) | Where-Object { $_ -ge 0 }
      if ($starts.Count -gt 0) {
        $parsed = $text.Substring(($starts | Measure-Object -Minimum).Minimum) | ConvertFrom-Json

        $entry = $parsed
        if ($parsed -is [array]) {
          $entry = $parsed | Where-Object { $_.platform -eq "android" } | Select-Object -First 1
          if (-not $entry) { $entry = $parsed[0] }
        }

        if ($entry -and $entry.id -and $entry.id.Length -ge 7) {
          $stamp = ($entry.id -replace '-', '').Substring(0, 7)
        }
      }
    }
    catch {
      # The publish worked; only the pretty confirmation code is missing.
      $stamp = $null
    }

    Write-Good "Published to '$Branch'."
    if ($stamp) {
      Write-Host ""
      Write-Host "   Tablets should show this code:  $stamp" -ForegroundColor Yellow
      Write-Note "It's the small grey line at the bottom of the tablet's menu screen."
      $results["Tablets"] = "published - tablets should show $stamp"
    }
    else {
      $results["Tablets"] = "published to $Branch"
    }
  }
  catch {
    Write-Bad $_.Exception.Message
    $results["Tablets"] = "FAILED - $($_.Exception.Message)"
  }
}

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------
Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host " Done" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

foreach ($key in $results.Keys) {
  $value = $results[$key]
  $colour = if ($value -like "FAILED*" -or $value -like "WRONG*") { "Red" }
            elseif ($value -eq "skipped") { "DarkGray" }
            else { "Green" }
  Write-Host ("  {0,-9} {1}" -f $key, $value) -ForegroundColor $colour
}

Write-Host ""
Write-Host "On each tablet: close the app fully and open it again." -ForegroundColor White
Write-Host "It now installs the update while starting, so one reopen is enough." -ForegroundColor DarkGray
Write-Host ""

$failed = @($results.Values | Where-Object { $_ -like "FAILED*" -or $_ -like "WRONG*" })
if ($failed.Count -gt 0) { exit 1 }
