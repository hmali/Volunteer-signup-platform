# Volunteer Sign-Up Platform

A production-ready, calendar-based volunteer sign-up web application for recurring temple/event volunteering, similar to SignUpGenius.

## 🚀 Quick Links

### Deployment & Setup
- **[30-Minute AWS Quick Start](./QUICKSTART_AWS.md)** - Fast deployment guide
- **[Complete AWS Testing Guide](./AWS_TESTING_GUIDE.md)** - 100+ step manual
- **[AWS Architecture Diagrams](./AWS_ARCHITECTURE.md)** - Visual infrastructure guide
- **[Setup Checklist](./AWS_SETUP_COMPLETE.md)** - Master deployment checklist
- **[AWS Summary](./AWS_README.md)** - What was delivered

### Troubleshooting
- **[🚨 Database Auth Error Fix](./FIX_DB_AUTH.md)** - Quick fix for P1000 error
- **[Copy & Paste DB Commands](./COPY_PASTE_DB_FIX.md)** - Terminal commands ready to use
- **[Complete DB Troubleshooting](./TROUBLESHOOT_DB.md)** - Comprehensive database guide

### Frontend
- **[Frontend Implementation](./FRONTEND_SUMMARY.md)** - UI components documentation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS CLOUD                                │
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Route 53   │─────▶│  EC2 Ubuntu  │      │   RDS/PG     │  │
│  │  (Optional)  │      │              │◀────▶│  (or Docker) │  │
│  └──────────────┘      │  ┌────────┐  │      └──────────────┘  │
│                        │  │ Nginx  │  │                          │
│                        │  │ HTTPS  │  │      ┌──────────────┐  │
│                        │  └────┬───┘  │      │   Cognito    │  │
│                        │       │      │      │    (Admin    │  │
│                        │  ┌────▼───┐  │      │     Auth)    │  │
│                        │  │Next.js │◀─┼──────┤              │  │
│                        │  │  Web   │  │      └──────────────┘  │
│                        │  │  App   │  │                          │
│                        │  └────┬───┘  │      ┌──────────────┐  │
│                        │       │      │      │     SES      │  │
│                        │       ▼      │      │   (Email)    │  │
│                        │  ┌────────┐  │      └──────────────┘  │
│                        │  │  SQS   │◀─┼─┐                       │
│                        │  │ Queue  │  │ │    ┌──────────────┐  │
│                        │  └────┬───┘  │ │    │      S3      │  │
│                        │       │      │ │    │  (JSON Mirror│  │
│                        │  ┌────▼───┐  │ │    │   + Backup)  │  │
│                        │  │Worker  │──┼─┼───▶│              │  │
│                        │  │Service │  │ │    └──────────────┘  │
│                        │  └────────┘  │ │                       │
│                        └──────────────┘ │                       │
│                                         │                       │
└─────────────────────────────────────────┼───────────────────────┘
                                          │
                                          ▼
                                ┌──────────────────┐
                                │  Google Sheets   │
                                │  (Roster Export) │
                                └──────────────────┘
```

## Data Flow

1. **Volunteer Signup**:
   - User selects date from calendar (excludes Thu/Fri)
   - Picks available seva slot
   - Submits form
   - **Atomic DB transaction** reserves capacity
   - **S3 JSON** written synchronously
   - **SQS jobs enqueued** for Sheets sync + email (async)
   - Returns confirmation immediately

2. **Background Worker**:
   - Polls SQS for jobs
   - Updates Google Sheets (upserts row keyed by signupId)
   - Sends emails via SES
   - Retries on failure with exponential backoff
   - Logs sync status to ExportSyncLog

3. **Admin Roster View**:
   - Reads from PostgreSQL (fast)
   - Shows Sheets sync status
   - Can export CSV or view Google Sheet
   - Retry failed syncs

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (RDS or Docker container)
- **ORM**: Prisma
- **Auth**: AWS Cognito (Admin only)
- **Email**: AWS SES
- **Storage**: AWS S3 (encrypted, versioned)
- **Queue**: AWS SQS + DLQ
- **Worker**: Node.js service (BullMQ + SQS consumer)
- **Sheets**: Google Sheets API + Service Account
- **Hosting**: AWS EC2 Ubuntu + Docker + Nginx + Let's Encrypt

## Features

### Admin
- ✅ Create events with custom date ranges
- ✅ Define seva types (NOT hard-coded)
- ✅ Generate monthly schedules (auto-excludes Thu/Fri)
- ✅ Set per-slot capacity overrides
- ✅ Close specific days
- ✅ View rosters by day/seva
- ✅ Export to CSV
- ✅ Auto-sync to Google Sheets
- ✅ Monitor sync status with retry
- ✅ Copy public signup links

### Volunteer (Public)
- ✅ Month calendar view (Thu/Fri disabled)
- ✅ Slot availability ("2 of 4 filled")
- ✅ Simple signup form
- ✅ Email confirmation
- ✅ Add-to-calendar (ICS + Google Calendar link)
- ✅ Secure cancellation via email token

### Technical
- ✅ Race-safe capacity enforcement (DB transactions + locks)
- ✅ S3 JSON mirror for every signup/cancellation
- ✅ Async Google Sheets sync (never blocks signup)
- ✅ Exponential backoff retries
- ✅ Timezone support (America/New_York)
- ✅ Rate limiting
- ✅ PII protection

## Quick Start

### 🚀 Deploy to AWS (Recommended)
**Ready to test on AWS? Start here!**

1. **[QUICKSTART_AWS.md](./QUICKSTART_AWS.md)** ⚡ - 30-minute setup guide
   - Automated scripts for AWS resource creation
   - Step-by-step EC2 deployment
   - Complete testing checklist

2. **[AWS_TESTING_GUIDE.md](./AWS_TESTING_GUIDE.md)** 📖 - Comprehensive manual
   - Detailed explanations for each AWS service
   - Troubleshooting guide
   - Production HTTPS setup

3. **[AWS_ARCHITECTURE.md](./AWS_ARCHITECTURE.md)** 🏗️ - Infrastructure diagrams
   - Visual data flow
   - Cost breakdown
   - Security configuration

### 💻 Local Development

```bash
# 1. Clone and install
git clone <repo>
cd volunteer-signup-platform
npm install --legacy-peer-deps

# 2. Set up environment
cp .env.example .env
# Edit .env with your AWS credentials, DB, etc.

# 3. Set up database
docker-compose up -d db
npx prisma migrate dev
npx prisma db seed

# 4. Run locally
npm run dev

# 5. In another terminal, start worker
npm run worker
```

Visit `http://localhost:3000`

## Environment Variables

See `.env.example` for full list. Key vars:

- `DATABASE_URL`: PostgreSQL connection string
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`: For JSON mirrors
- `SQS_QUEUE_URL`: For background jobs
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`: For Sheets API
- `SES_FROM_EMAIL`: Sender email address
- `NEXT_PUBLIC_BASE_URL`: Your domain (for email links)

## Project Structure

```
volunteer-signup-platform/
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Sample data
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── admin/              # Admin dashboard
│   │   ├── signup/[publicId]/  # Public signup pages
│   │   ├── api/                # API routes
│   │   └── layout.tsx
│   ├── components/             # React components
│   ├── lib/
│   │   ├── db.ts               # Prisma client
│   │   ├── s3.ts               # S3 operations
│   │   ├── sheets.ts           # Google Sheets sync
│   │   ├── email.ts            # SES email sending
│   │   ├── queue.ts            # SQS producer/consumer
│   │   └── auth.ts             # Cognito helpers
│   ├── worker/
│   │   └── index.ts            # Background worker
│   └── tests/
│       ├── capacity.test.ts    # Race condition tests
│       └── sheets.test.ts      # Idempotency tests
├── docker/
│   ├── Dockerfile.web
│   ├── Dockerfile.worker
│   └── nginx.conf
├── docker-compose.yml
├── DEPLOYMENT.md
└── README.md
```

## License

MIT
