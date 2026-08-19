# Running the Survey Server on Your Desktop

This replaces Railway. Your desktop becomes the server that the tablets and
phones sync to, and the admin website runs on it too.

Work through the steps in order. Steps 1–5 get the server running on your
desktop. Step 6 makes it reachable from the field. Step 7 points the tablets
at it.

---

## Step 1 — Put the project in the right folder

**Do not use OneDrive, Desktop, or Documents.** OneDrive syncing a live
database corrupts it, and you can lose survey data with no error message.

Use a plain folder: `C:\ArriveAlive`

If you have Git installed, open PowerShell and run:

```powershell
cd C:\
git clone https://github.com/Arrivealive770/Arrive-Alive-Tour-Survey-3.1.git ArriveAlive
```

No Git? Download the ZIP from the GitHub page (green **Code** button →
**Download ZIP**), then extract it to `C:\ArriveAlive`.

The installer in step 5 refuses to run if it detects OneDrive, so you can't
get this wrong silently.

---

## Step 2 — Install Bun

Bun is what runs the server. In PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Close and reopen PowerShell afterwards, then check it worked:

```powershell
bun --version
```

You should see a version number.

---

## Step 3 — Decide about your existing data

Your survey database starts empty on the desktop. You'll create your teams
and events in the admin website once it's running.

If you want to carry over what's already in Vibecode, tell me and I'll export
it for you. Otherwise skip this step.

---

## Step 4 — Create the settings file

**Easiest way — paste this into PowerShell.** It writes the file correctly
and asks for your Resend key:

```powershell
$key = Read-Host "Paste your Resend API key (starts with re_)"
@"
DATABASE_URL="file:./prod.db"
BETTER_AUTH_SECRET="5e3f5c20969ea59bd52195d9722fe5cf252c4d93d49c9694d7517904eadf2f9a"
BACKEND_URL="http://localhost:3000"
NODE_ENV="production"
RESEND_API_KEY="$key"
"@ | Set-Content -Path C:\ArriveAlive\backend\.env -Encoding ascii -NoNewline:$false
Get-Content C:\ArriveAlive\backend\.env
```

It prints the file back so you can see it worked. Skip to step 5.

---

**Doing it by hand instead?** Create `C:\ArriveAlive\backend\.env` with these
five lines.

In Notepad, when saving, you **must** change **Save as type** to
**All Files**. Otherwise Notepad silently saves `.env.txt`, and because
Windows hides file extensions it still looks like `.env` in Explorer. That
one catches nearly everybody.

```
DATABASE_URL="file:./prod.db"
BETTER_AUTH_SECRET="5e3f5c20969ea59bd52195d9722fe5cf252c4d93d49c9694d7517904eadf2f9a"
BACKEND_URL="http://localhost:3000"
NODE_ENV="production"
RESEND_API_KEY="your-resend-key-here"
```

Replace the Resend key with yours — that's what sends the pledge emails.
Without it the server still runs, but no emails go out.

**Already saved it as `.env.txt`?** Don't recreate it — just rename it. In
PowerShell:

```powershell
cd C:\ArriveAlive\backend
Get-ChildItem -Force -Filter ".env*" | Select-Object Name
Rename-Item .env.txt .env
Get-ChildItem -Force -Filter ".env*" | Select-Object Name
```

The first listing shows what you actually have; the second should show `.env`
and nothing else. If the first listing shows **both** `.env` and `.env.txt`,
open each with `Get-Content .\.env.txt` to see which one has your real
settings, delete the empty one, then rename.

To stop Windows hiding extensions from you in future: in File Explorer, open
the **View** menu → **Show** → tick **File name extensions**.

`BACKEND_URL` becomes your real address in step 6, once you've picked a
domain. `localhost` is fine until then.

Do **not** add an email from-address here. Pledge emails already default to
`Arrive Alive Tour <noreply@arrivealivetour.com>`, and that stays correct no
matter which domain the survey server ends up on.

This file is never uploaded to GitHub.

---

## Step 5 — Turn on auto-start after boot

Right-click PowerShell → **Run as Administrator**, then:

```powershell
cd C:\ArriveAlive
powershell -ExecutionPolicy Bypass -File desktop\install-autostart.ps1
```

This sets up three things:

| What | Effect |
|---|---|
| `ArriveAliveServer` task | Starts the server at boot, before you log in |
| `ArriveAliveBackup` task | Backs up the survey database nightly at 2:37am |
| Firewall rule | Lets other computers on your network reach the admin site |
| Power settings | Stops the desktop sleeping while plugged in |

It survives Windows Update reboots — that's the whole point of using a
scheduled task rather than a startup shortcut.

**Start it now without rebooting:**

```powershell
Start-ScheduledTask -TaskName ArriveAliveServer
```

**Check it's alive** (wait ~30 seconds the first time — it installs
dependencies):

```powershell
curl http://localhost:3000/health
```

You want `{"status":"ok"}`.

Your admin website is now at **http://localhost:3000/admin**

### Using it from another computer in the office

The installer prints an address like `http://192.168.1.42:3000/admin` when it
finishes. Type that into a browser on any other computer, laptop, or phone on
the same wifi and you get the same admin site.

Two things to know:

- **That number can change** when the desktop reconnects to the network. If
  the address stops working, run `ipconfig` on the desktop and look for
  "IPv4 Address". (Ask your router to reserve a fixed address for the desktop
  if you'll be doing this a lot.)
- **Same network only.** From home, a coffee shop, or a venue, this address
  does nothing. That's step 6.

If other computers can't reach it, Windows probably has your network marked
as "Public". Go to **Settings → Network & Internet →** your connection **→**
set it to **Private**, then try again.

**If something's wrong,** the log tells you why:

```powershell
Get-Content C:\ArriveAlive\desktop\logs\server.log -Tail 30
```

---

## Step 6 — Make it reachable from the field

Right now the server only works on the desktop itself. Tablets at venues
need a real internet address, and Android refuses plain `http://`
connections — so you need `https`.

There are two ways to do this. Both are reliable. Pick one.

### First: do NOT put arrivealivetour.com on Cloudflare

Cloudflare only works if you hand it a whole domain's DNS, and
`arrivealivetour.com` currently runs:

| Record | What it does |
|---|---|
| MX → `outlook.com` | **Your company email (Microsoft 365)** |
| A → `192.124.249.114` | Your website |
| `resend._domainkey` TXT | Resend's email signature |
| `send.` MX + SPF | Resend's sending records |
| `google-site-verification` | Google tooling |

Move the nameservers and every one of those has to survive the migration.
If the MX record doesn't, company email stops. That is not a risk worth
taking for a survey server nobody ever types the address of.

Cloudflare does have a way to hand over just one subdomain, but it's an
Enterprise-plan feature, so it isn't available to you.

---

### Option A — Tailscale (free, no domain, nothing to buy)

Tailscale builds a small private network between your desktop and your
tablets. No domain, no DNS changes, no router settings, and it gives you a
real `https` address for free. Your existing domain is never touched.

The trade-off: the Tailscale app has to be installed and signed in on every
tablet.

**A1.** Sign up at [tailscale.com](https://tailscale.com) with your Google or
Microsoft account. The free plan covers 6 people and unlimited devices.

**A2.** Install Tailscale on the desktop, sign in. Then in the
[admin console](https://login.tailscale.com/admin/dns) → **DNS**, turn on
**MagicDNS**, then turn on **HTTPS Certificates**.

**A3.** On the desktop, in PowerShell:

```powershell
tailscale serve --bg 3000
```

It prints your address — something like
`https://desktop.tailXXXX.ts.net`. Write it down; that's what goes in the
tablets.

**A4.** Install the Tailscale app from the Play Store on each tablet and sign
in with the same account. In the admin console, find each tablet and set its
key expiry to **never**, or they'll drop off in six months mid-tour.

**A5.** Test from a tablet on cellular:

```
https://desktop.tailXXXX.ts.net/health
```

**A6.** Put that address into `backend\.env`, replacing the `localhost` line:

```
BACKEND_URL="https://desktop.tailXXXX.ts.net"
```

Then restart:

```powershell
Stop-ScheduledTask  -TaskName ArriveAliveServer
Start-ScheduledTask -TaskName ArriveAliveServer
```

**A7.** Tell me the address and I'll build the tablet app (step 7).

---

### Option B — Cloudflare Tunnel on a separate domain (~$11/year)

Buy `arrivealivesurvey.com` (or anything cheap) and give *that* to
Cloudflare. `arrivealivetour.com` stays exactly as it is. Nothing to install
on the tablets.

Below, **`<your-domain>`** is the new domain you bought.

**B1.** Add `<your-domain>` to Cloudflare at
[dash.cloudflare.com](https://dash.cloudflare.com) (free plan). It will ask
you to change your nameservers at the registrar — allow a few hours.

**B2.** Go to **Zero Trust → Networks → Tunnels → Create a tunnel**.
Choose **Cloudflared**, name it `arrivealive`.

**B3.** Cloudflare shows you a Windows install command with a long token in
it. Copy it and run it in PowerShell **as Administrator**. This installs the
tunnel as a Windows service, so it also auto-starts at boot.

**B4.** Still in Cloudflare, add a **Public Hostname** to the tunnel:

| Field | Value |
|---|---|
| Subdomain | `surveys` |
| Domain | `<your-domain>` |
| Service Type | `HTTP` |
| URL | `localhost:3000` |

**B5.** Test it from your phone on cellular (not your home wifi):

```
https://surveys.<your-domain>/health
```

---

### Option C — skip step 6 entirely (free, but read the catch)

The tablets already work with no internet at all. They store every survey and
pledge on the device and sync when they can reach the server.

So you *can* do nothing here, run on office wifi only, and let the tablets
sync when the team gets back.

The catch, and it's a real one: **pledge emails don't send until the tablet
syncs.** Someone who pledges on a Friday gets their photo email whenever the
tablets next reach the desktop. If the team is out for two weeks, that's two
weeks. And until they sync, that event's data exists only on the tablet — a
lost or broken tablet is lost data with no backup.

Fine for local events where tablets come home the same day. Not good for
touring. Option A costs nothing and removes both problems, so prefer it.

---

### Either way

`{"status":"ok"}` means you're live.

**6f.** Send yourself one test pledge from a tablet, to your own email address.

Pledge emails still go out through Resend from `noreply@arrivealivetour.com` —
that part is untouched by this move. This test is only to confirm your Resend
key made it into the `.env` file correctly.

Check the email arrives **and that the photo shows up in it**. If the email
arrives with no photo, tell me and I'll look at the log.

---

## Step 7 — Point the tablets at your desktop

**This step is required, and it needs a new APK.** The server address is
baked into the app when it's built, so the tablets will keep talking to the
old Railway address until you rebuild.

Tell me once step 6 works and I'll set the address and build you a fresh APK
to install on the tablets and phones.

---

## Everyday operation

**Nothing.** The server starts with the desktop and backs itself up nightly.

Worth knowing:

- **Leave the desktop on** when teams are out. If it's off or asleep, tablets
  hold their data and sync later — nothing is lost, just delayed.
- **Backups** land in `C:\ArriveAlive\backend\prisma\backups\`. The most
  recent 30 are kept. Copy them to a USB drive or OneDrive occasionally — a
  backup on the same machine doesn't help if the drive dies.
- **Deleting pledge data** after an event: admin website → Events →
  **Purge Pledges**. Removes the photos and participant emails, keeps every
  survey answer.

### Handy commands

```powershell
# Restart the server
Stop-ScheduledTask  -TaskName ArriveAliveServer
Start-ScheduledTask -TaskName ArriveAliveServer

# Watch the log live
Get-Content C:\ArriveAlive\desktop\logs\server.log -Tail 30 -Wait

# Back up right now
Start-ScheduledTask -TaskName ArriveAliveBackup

# Are the tasks registered?
Get-ScheduledTask -TaskName ArriveAlive*
```

**`Stop-ScheduledTask : The system cannot find the file specified`** means the
task doesn't exist yet — step 5 was never finished, so nothing is scheduled to
stop. Nothing is broken. Check with:

```powershell
Get-ScheduledTask -TaskName ArriveAlive*
```

Blank output confirms it. Go back and do step 5. Until then you can run the
server by hand any time by double-clicking
`C:\ArriveAlive\desktop\start-server.bat` — it just won't come back on its own
after a reboot.

If step 5's installer says the `-File` path **does not exist**, your project
folder is nested one level deeper (common with ZIP downloads — you get
`C:\ArriveAlive\Arrive-Alive-Tour-Survey-3.1\...`). Find the real location:

```powershell
Get-ChildItem C:\ArriveAlive -Recurse -Filter install-autostart.ps1 |
  Select-Object FullName
```

Then `cd` to the folder that contains `desktop\` and run the installer from
there. If it is nested, move the inner folder's contents up to `C:\ArriveAlive`
so every other command in this guide matches.

### Updating the app later

**Start here every time.** In PowerShell:

```powershell
git --version
```

- **You see a version number** (e.g. `git version 2.47.1`) → go to A below.
- **You see `git : The term 'git' is not recognized...`** → Git is not
  installed *on this computer*, or PowerShell hasn't picked it up yet. Go to
  B below.

Connecting the project to GitHub **on the GitHub website** does not put Git
on your desktop. Git is a program that has to be installed on the machine
you're typing on, separately, once.

#### A — Git is installed and this folder is already connected

```powershell
cd C:\ArriveAlive
git pull
Stop-ScheduledTask  -TaskName ArriveAliveServer
Start-ScheduledTask -TaskName ArriveAliveServer
```

If `git pull` answers `fatal: not a git repository`, the folder came from a
ZIP and was never connected. Do B, starting at the `git init` block.

If it refuses with **`Your local changes to the following files would be
overwritten`** and names `backend/bun.lock`, that's just your Bun version
having rewritten the package list. It holds nothing of yours — throw it away
and pull again:

```powershell
git checkout -- backend/bun.lock
git pull
```

#### B — Install Git, then connect this folder once

```powershell
winget install --id Git.Git -e --source winget
```

**Now close PowerShell completely and open a new window.** A PowerShell
window only learns about newly installed programs when it starts, so the
window you ran the install in will keep saying `'git' is not recognized`
forever. Confirm in the new window:

```powershell
git --version
```

Then connect your existing folder in place — this keeps your database and
your `.env`:

```powershell
cd C:\ArriveAlive
git init
git remote add origin https://github.com/Arrivealive770/Arrive-Alive-Tour-Survey-3.1.git
git fetch origin
git reset --mixed origin/main
git checkout -- .
```

`git reset --mixed` then `checkout -- .` overwrites the project files with
the latest versions. It does **not** touch `backend\.env`, `backend\prisma\prod.db`,
or your backups — those are ignored by Git, which is exactly why they're
ignored. From then on, A is all you need.

If `winget` itself is not recognized (older Windows 10), download the
installer from <https://git-scm.com/download/win>, run it, accept every
default, then close and reopen PowerShell.

### What kind of change needs what

Three separate things can change, and they update in three different ways.
Check this list before assuming you need a new APK — most changes don't.

**Survey content, teams, events, photo overlays, admin accounts**
Change them in the admin site. Live immediately, on every tablet, no build
and no restart. The tablets read all of this from the server.

**The server and the admin site itself**
`git pull` on the desktop, then restart — section A above. The tablets need
no attention.

**The tablet app itself** (screens, wording on buttons, the survey flow, a new
feature)
This needs a new APK: build it in Expo, then install it on each tablet. As
long as it's built from the same Expo project, it installs over the old one
and keeps each tablet's saved setup and any surveys that haven't synced yet.

That last one means physically touching every tablet, which is the painful
one mid-tour. It can be avoided — see below.

### Over-the-air app updates (not set up yet)

Expo can push app updates to the tablets over the internet: you publish, and
each tablet picks the change up the next time it's opened. No APK, no
re-installing, no chasing tablets between venues.

It is **not** enabled on this project — it needs the `expo-updates` package
added and configured, which happens on the Expo side. Worth doing before a
tour rather than during one.

Even with it on, some changes still need a fresh APK: a new device permission,
a new native module (camera, Bluetooth, printing), or an Expo SDK upgrade.
Day-to-day wording and layout changes go over the air.

---

## Restoring a backup

If the database is ever damaged:

```powershell
Stop-ScheduledTask -TaskName ArriveAliveServer
cd C:\ArriveAlive\backend\prisma
Copy-Item prod.db prod.db.broken
Copy-Item backups\survey-backup-<newest>.db prod.db
Start-ScheduledTask -TaskName ArriveAliveServer
```

Keep the `.broken` copy until you've confirmed the restore looks right in the
admin website.
