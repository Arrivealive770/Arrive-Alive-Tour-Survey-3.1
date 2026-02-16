# Railway Deployment Guide

## Quick Start

1. **Create a new project on Railway** at [railway.app](https://railway.app)

2. **Add a PostgreSQL database** (recommended for production):
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will auto-generate the DATABASE_URL

3. **Connect your repo**:
   - Click "New" → "GitHub Repo"
   - Select this repository
   - Set the root directory to `backend`

4. **Set environment variables** in Railway dashboard:
   ```
   DATABASE_URL        → (auto-set if using Railway PostgreSQL)
   BETTER_AUTH_SECRET  → (generate a secure 32+ character secret)
   BACKEND_URL         → https://your-app.up.railway.app
   NODE_ENV            → production
   ```

5. **If using PostgreSQL**, update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

## Environment Variables Required

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `BETTER_AUTH_SECRET` | Auth encryption secret (32+ chars) | Yes |
| `BACKEND_URL` | Your Railway app URL | Yes |
| `SENDGRID_API_KEY` | For email sending | Optional |
| `EMAIL_FROM_ADDRESS` | Sender email address | Optional |

## Using SQLite with Persistent Volume

If you prefer SQLite (simpler but less scalable):

1. Add a volume in Railway settings:
   - Mount path: `/data`

2. Set DATABASE_URL:
   ```
   DATABASE_URL=file:/data/prod.db
   ```

## Troubleshooting

- **Database connection errors**: Ensure DATABASE_URL is correctly set
- **Auth issues**: Verify BACKEND_URL matches your Railway domain exactly
- **Build failures**: Check that all dependencies are in package.json
