# Arrive Alive Tour - Survey + Photo Pledge Kiosk System

An offline-first kiosk system for the Arrive Alive Tour, supporting multiple touring teams with tablets and phones operating at venues with no internet connectivity.

## System Overview

- **3 Teams** operating simultaneously
- **2 Tablets per team** running in kiosk mode (surveys + pledges)
- **1 Phone per team** as the Photo Hub (capturing pledge photos)
- **Fully offline capable** - syncs when connectivity returns

## Features

### Tablet Kiosk Mode
- Multiple survey types (Marijuana, Alcohol, Distracted, Impaired, Combo)
- 11 questions per survey, auto-advance on tap
- Post-survey pledge flow with photo selection
- Email capture for pledge photo delivery
- PIN-protected admin access (default: 1234)

### Phone Photo Hub
- Camera interface with real-time overlay preview
- Photo queue management
- Automatic upload when online
- QR code generation for offline photo reference

### Admin Dashboard
- Real-time analytics and charts
- CSV export functionality
- Device status monitoring
- Event management
- Survey type management (create, edit, delete) - **Web Admin Only**
- Survey results with pie charts
- Email queue status
- **Google Forms/Sheets Survey Import** - import pre/post survey data and link it to events

### Web Admin Portal
Access at `{BACKEND_URL}/admin` (password: 1234)
- Full survey management (add, edit, delete surveys)
- View survey results as pie charts
- Teams, events, and overlays management
- Data export with pie charts (select multiple events)
- Analytics dashboard

### Mobile Admin (phones/tablets)
- View-only for surveys (no editing)
- View survey results with pie charts
- Manage events and devices

### Offline-First Architecture
- SQLite local database on all devices
- Automatic sync when connectivity detected
- Retry logic with exponential backoff
- Team isolation (Team A cannot see Team B data)

## Environment Setup

### Backend Environment Variables

Add these to `backend/.env`:

```env
DATABASE_URL="file:./prisma/dev.db"
SENDGRID_API_KEY="your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="noreply@arrivealive.org"
```

### Mobile Environment Variables

The mobile app uses `EXPO_PUBLIC_BACKEND_URL` which is automatically configured by Vibecode.

## Deployment Guide for 3 Teams

### Step 1: Create Teams in Admin

1. Open the app and navigate to Admin (use PIN: 1234)
2. Create 3 teams with unique codes:
   - Team Alpha: `ALPHA2024`
   - Team Beta: `BETA2024`
   - Team Gamma: `GAMMA2024`

### Step 2: Configure Devices

For each team's devices:

**Tablets (x2 per team):**
1. Open the app
2. Select "Tablet (Kiosk Mode)"
3. Enter team code (e.g., `ALPHA2024`)
4. Name the device (e.g., "Tablet 1", "Tablet 2")
5. Device will enter kiosk mode after setup

**Phone (x1 per team):**
1. Open the app
2. Select "Phone (Photo Hub)"
3. Enter team code (same as tablets)
4. Name the device (e.g., "Photo Hub")

### Step 3: Create Events

Before each venue:
1. Access Admin Dashboard (PIN: 1234)
2. Go to Events tab
3. Create new event with:
   - Venue name
   - Date
   - Survey types to enable
   - Overlay type for photos

### Step 4: Offline Operation

At venues without internet:
1. Phone takes photos with overlay applied
2. Photos are queued locally
3. Tablets can view/select photos from the team's queue
4. Surveys and pledges are stored in local SQLite
5. When connectivity returns, everything syncs automatically

### Local Photo Transfer (Hotspot Mode)

For completely offline environments where photos should stay on the tablet's local storage:

**Setup (on Phone):**
1. Access Admin Settings (PIN: 1234)
2. Enable "Local Photo Transfer" toggle
3. Enter the tablet's IP address (usually `192.168.43.1` when tablet runs hotspot)
4. Set port (default: 8082)

**Operation:**
1. Tablet creates a WiFi hotspot
2. Phone connects to the tablet's hotspot
3. When photos are taken, they're sent directly to the tablet over the local network
4. Photos are stored on the tablet's local filesystem (not uploaded to cloud)
5. No internet connection required at any point

**Benefits:**
- Photos never leave the local devices
- Works in completely offline environments
- Direct device-to-device transfer over hotspot
- Tablet stores photos on its hard drive

### Step 5: End of Event

1. Access Admin Dashboard
2. Go to Events tab
3. Select the active event
4. Tap "End Event"
5. Confirm purge to delete all local photos and data

## Tech Stack

### Mobile App
- Expo SDK 53 + React Native
- expo-sqlite for local database
- Zustand for state management
- expo-camera for photo capture
- NetInfo for connectivity monitoring

### Backend
- Hono (Bun runtime)
- Prisma with SQLite
- SendGrid for email delivery
- File-based photo storage

## API Endpoints

### Sync Endpoints
- `POST /api/sync/surveys` - Batch upload surveys
- `POST /api/sync/pledges` - Batch upload pledges
- `GET /api/sync/photos/:teamId/:eventId` - Get team photos
- `POST /api/sync/status` - Report device status

### Admin Endpoints
- `GET /api/admin/analytics` - Dashboard data
- `GET /api/admin/export/csv` - Export survey data
- `GET /api/admin/devices` - Device status

### Survey Import Endpoints
- `POST /api/external-surveys/import` - Import Google Forms/Sheets CSV data linked to an event
- `GET /api/external-surveys?eventId=xxx` - List imports (optionally filtered by event)
- `GET /api/external-surveys/:id` - Get import with all row data
- `DELETE /api/external-surveys/:id` - Delete an import

### Survey Management Endpoints
- `GET /api/surveys/types` - List all survey types
- `GET /api/surveys/types/:slug` - Get single survey type
- `POST /api/surveys/types` - Create new survey type
- `PUT /api/surveys/types/:slug` - Update survey type
- `DELETE /api/surveys/types/:slug` - Delete/deactivate survey type
- `GET /api/surveys/results/:slug` - Get aggregated results with pie chart data

### Email Endpoints
- `POST /api/email/process` - Process email queue
- `GET /api/email/queue` - Queue status

## Survey Flow

1. Staff selects survey type (one-time per session)
2. Participant answers 11 questions (auto-advance)
3. Optional demographics (age bracket)
4. Post-survey: "Take the Pledge?" prompt
5. If yes: Photo selection → Email capture → Thank you
6. Auto-reset to Question 1 of same survey

## Pledge Email Content

Subject: "Your S.A.F.E. Pledge Photo"

Body includes:
- Thank you message
- Pledge photo with overlay
- Social media sharing prompt (#ArriveAlive)
- Links to Facebook and X/Twitter

## Troubleshooting

### Sync Not Working
- Check device is online (green indicator in admin)
- Force sync from Admin Dashboard
- Check backend logs for errors

### Photos Not Appearing on Tablets
- Ensure phone and tablets use same team code
- Check phone has uploaded photos (when online)
- Pull to refresh in photo selection

### Email Not Sending
- Verify SENDGRID_API_KEY is set
- Check email queue status in Admin
- Use "Retry Failed" to resend failed emails

## Default Admin PIN

The default admin PIN is `1234`. Change it in Settings after initial setup.

## License

Proprietary - Arrive Alive Tour
