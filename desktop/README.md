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

Create a file at `C:\ArriveAlive\backend\.env` containing these five lines.

Use Notepad, and when saving choose **All Files** for the file type so it
doesn't become `.env.txt`.

```
DATABASE_URL="file:./prod.db"
BETTER_AUTH_SECRET="5e3f5c20969ea59bd52195d9722fe5cf252c4d93d49c9694d7517904eadf2f9a"
BACKEND_URL="http://localhost:3000"
NODE_ENV="production"
RESEND_API_KEY="your-resend-key-here"
```

Replace the Resend key with yours — that's what sends the pledge emails.
Without it the server still runs, but no emails go out.

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

Cloudflare Tunnel does this for free, without touching your router, and
without exposing your home IP address.

### Which domain to use

Cloudflare requires you to point a whole domain's nameservers at it. That
means whichever domain you choose here, Cloudflare takes over all of its DNS —
website, email records, everything.

**Recommended: buy a separate domain** (`arrivealivesurvey.com` or similar,
around $11/year). Then `arrivealivetour.com` is never touched, so the website
and the Resend email records cannot be disturbed by this.

Using a subdomain of `arrivealivetour.com` is free and works, but it means
moving the live website's DNS to Cloudflare. Cloudflare copies the existing
records during setup, but if an SPF or DKIM record is missed, pledge emails
start landing in spam — and that is a bad thing to discover mid-tour.

Nobody ever sees or types this address; only the tablets use it. So pick the
option with less risk, not the prettier name.

Below, **`<your-domain>`** means whichever domain you chose.

**6a.** Add `<your-domain>` to Cloudflare at
[dash.cloudflare.com](https://dash.cloudflare.com) (free plan). It will ask
you to change your nameservers at your domain registrar — this can take a
few hours to take effect.

**6b.** Go to **Zero Trust → Networks → Tunnels → Create a tunnel**.
Choose **Cloudflared**, name it `arrivealive`.

**6c.** Cloudflare shows you a Windows install command with a long token in
it. Copy it and run it in PowerShell **as Administrator**. This installs the
tunnel as a Windows service, so it also auto-starts at boot.

**6d.** Still in Cloudflare, add a **Public Hostname** to the tunnel:

| Field | Value |
|---|---|
| Subdomain | `surveys` |
| Domain | `<your-domain>` |
| Service Type | `HTTP` |
| URL | `localhost:3000` |

**6e.** Test it from your phone on cellular (not your home wifi):

```
https://surveys.<your-domain>/health
```

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

### Updating the app later

```powershell
cd C:\ArriveAlive
git pull
Stop-ScheduledTask  -TaskName ArriveAliveServer
Start-ScheduledTask -TaskName ArriveAliveServer
```

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
