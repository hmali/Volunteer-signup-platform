# Architecture Documentation

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUBLIC INTERNET                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │   Nginx       │
              │   (HTTPS)     │
              └───────┬───────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│  Static       │           │  API Routes   │
│  Pages        │           │  /api/*       │
│  (Next.js)    │           │               │
└───────────────┘           └───────┬───────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────┐  ┌──────────────┐
            │  PostgreSQL  │ │   SQS    │  │     S3       │
            │  (Primary)   │ │  Queue   │  │ (JSON Store) │
            └──────────────┘ └────┬─────┘  └──────────────┘
                                  │
                                  ▼
                          ┌──────────────┐
                          │   Worker     │
                          │   Service    │
                          └───┬──────┬───┘
                              │      │
                    ┌─────────┘      └─────────┐
                    ▼                          ▼
            ┌──────────────┐          ┌──────────────┐
            │ Google       │          │    SES       │
            │ Sheets API   │          │  (Email)     │
            └──────────────┘          └──────────────┘
```

### Component Responsibilities

#### 1. Next.js Web Application
- **Public Pages**: Calendar view, slot selection, signup form, confirmation
- **Admin Dashboard**: Event management, seva configuration, roster views
- **API Routes**: RESTful endpoints for both public and admin operations

#### 2. PostgreSQL Database
- **Source of Truth**: All transactional data
- **ACID Compliance**: Guarantees capacity enforcement
- **Row-level Locking**: Prevents race conditions on last available slot

#### 3. AWS S3
- **JSON Mirror**: Every signup/cancellation stored as JSON
- **Key Structure**: `events/{publicId}/month={YYYY-MM}/date={YYYY-MM-DD}/slot={slotId}/signup={signupId}.json`
- **Purpose**: Durable backup, audit trail, fast retrieval without DB queries
- **Features**: Server-side encryption (SSE-S3), versioning enabled

#### 4. AWS SQS
- **Primary Queue**: Job distribution to workers
- **Dead Letter Queue**: Failed jobs after max retries
- **Job Types**:
  - `SHEETS_UPSERT_SIGNUP`: Update Google Sheets with new signup
  - `SHEETS_MARK_CANCELLED`: Mark signup as cancelled in Sheets
  - `EMAIL_CONFIRMATION`: Send signup confirmation
  - `EMAIL_CANCELLATION`: Send cancellation confirmation

#### 5. Worker Service
- **SQS Consumer**: Polls queue for jobs
- **Job Processing**:
  - Loads signup data from PostgreSQL
  - Updates Google Sheets (idempotent upserts)
  - Sends emails via SES
  - Logs to ExportSyncLog
- **Retry Logic**: Exponential backoff (1s, 2s, 4s, 8s, 16s)
- **Health Check**: `/health` endpoint

#### 6. Google Sheets Integration
- **Per-Event Sheets**: One spreadsheet per event + month
- **Sheet Structure**:
  ```
  Roster Tab:
  Date | Day | Shift | Seva | Capacity | Filled | Name | Email | Phone | Notes | Status | Timestamp | SignupId
  ```
- **Upsert Logic**: Find row by SignupId, update if exists, append if new
- **Cancellations**: Mark Status=Cancelled (preserve history)
- **Service Account**: Uses Google Service Account for server-to-server auth

#### 7. AWS SES
- **Transactional Emails**:
  - Signup confirmation with cancellation link
  - Cancellation confirmation
  - (Optional) Reminder emails
- **Templates**: HTML + plain text
- **Logging**: All sends logged to NotificationLog

## Data Flow Details

### Signup Flow (Critical Path)

```
1. User submits signup form
   ↓
2. POST /api/public/slots/{slotId}/signup
   ↓
3. BEGIN TRANSACTION
   - SELECT ... FOR UPDATE (row lock on slot)
   - Validate capacity (current < max)
   - INSERT INTO Signup
   - INCREMENT Slot.filledCount
   COMMIT TRANSACTION
   ↓
4. Write to S3 (synchronous, ~50-100ms)
   - Key: events/{publicId}/month=2026-01/date=2026-01-15/slot=abc/signup=xyz.json
   - Body: {signupId, slotId, name, email, date, seva, ...}
   ↓
5. Enqueue SQS jobs (asynchronous, ~10ms)
   - Job 1: SHEETS_UPSERT_SIGNUP {signupId: xyz}
   - Job 2: EMAIL_CONFIRMATION {signupId: xyz}
   ↓
6. Return 200 OK with confirmation data
   - Volunteer sees confirmation page immediately
   ↓
7. Worker processes jobs (background, 0-30 seconds later)
   - Updates Google Sheets
   - Sends email
   - Logs success to ExportSyncLog
```

**Total Response Time**: ~100-200ms (DB + S3)
**User Experience**: Immediate confirmation, email arrives within seconds

### Cancellation Flow

```
1. User clicks cancellation link in email
   - Link: /api/public/cancel/{secureToken}
   ↓
2. POST /api/public/cancel/{token}
   ↓
3. BEGIN TRANSACTION
   - Find Signup by cancelTokenHash
   - UPDATE Signup SET status='CANCELLED'
   - DECREMENT Slot.filledCount
   COMMIT TRANSACTION
   ↓
4. Update S3 JSON (add cancelledAt field)
   ↓
5. Enqueue jobs:
   - SHEETS_MARK_CANCELLED {signupId}
   - EMAIL_CANCELLATION {signupId}
   ↓
6. Return cancellation confirmation page
   ↓
7. Worker updates Sheets + sends email
```

### Admin Schedule Generation

```
1. Admin: "Generate January 2026"
   ↓
2. POST /api/admin/events/{id}/generate-month?month=2026-01
   ↓
3. Calculate date range (Jan 1-31, 2026)
   ↓
4. For each date:
   - Skip if Thursday or Friday
   - Create Day record
   ↓
5. For each Day, for each active SevaType:
   - Create Slot (capacity = sevaType.defaultCapacity)
   ↓
6. Return count: "Created 22 days, 88 slots (4 sevas/day)"
```

## Database Schema

### Core Entities

```prisma
Event
├── id: String (UUID)
├── name: String
├── startDate: DateTime
├── endDate: DateTime
├── timezone: String (America/New_York)
├── shiftLabel: String ("6:30 PM – 8:30 PM")
├── publicId: String (unique, unguessable)
├── driveFolderId: String?
├── sheetsSpreadsheetId: String?
├── createdById: String
└── createdAt: DateTime

SevaType
├── id: String (UUID)
├── eventId: String → Event
├── name: String ("Kitchen Seva")
├── description: String?
├── defaultCapacity: Int (default: 4)
├── isActive: Boolean
├── sortOrder: Int
├── icon: String?
└── color: String?

Day
├── id: String (UUID)
├── eventId: String → Event
├── date: DateTime (date only, in event timezone)
├── isClosed: Boolean
└── notes: String?

Slot
├── id: String (UUID)
├── dayId: String → Day
├── sevaTypeId: String → SevaType
├── capacity: Int
├── filledCount: Int (default: 0)
└── status: Enum (ACTIVE, FULL, CLOSED)

Signup
├── id: String (UUID)
├── slotId: String → Slot
├── name: String
├── email: String
├── phone: String?
├── notes: String?
├── cancelToken: String (unique, indexed)
├── cancelTokenHash: String (indexed)
├── status: Enum (CONFIRMED, CANCELLED)
├── createdAt: DateTime
└── cancelledAt: DateTime?

ExportSyncLog
├── id: String (UUID)
├── signupId: String → Signup
├── s3Key: String
├── sheetsSpreadsheetId: String?
├── sheetsRowId: Int?
├── lastSyncedAt: DateTime
├── status: Enum (PENDING, SUCCESS, FAILED)
├── retryCount: Int
└── lastError: String?

NotificationLog
├── id: String (UUID)
├── signupId: String → Signup
├── type: Enum (CONFIRMATION, CANCELLATION, REMINDER)
├── sentAt: DateTime
├── status: Enum (SENT, FAILED)
└── providerMessageId: String?
```

## Concurrency & Race Condition Handling

### Problem: Two volunteers attempt to take the last slot simultaneously

**Without Protection**:
```
Time | User A                    | User B
-----|---------------------------|---------------------------
T0   | SELECT * FROM Slot        | SELECT * FROM Slot
     | (capacity=4, filled=3)    | (capacity=4, filled=3)
T1   | Check: 3 < 4 ✓            | Check: 3 < 4 ✓
T2   | INSERT Signup             | INSERT Signup
T3   | UPDATE Slot SET filled=4  | UPDATE Slot SET filled=5
     | OVERBOOKING! ❌
```

**With Row-Level Locking**:
```sql
BEGIN TRANSACTION;

-- Lock the row (other transactions must wait)
SELECT * FROM "Slot"
WHERE id = $1
FOR UPDATE;

-- Check capacity
IF (filledCount >= capacity) THEN
  ROLLBACK;
  RETURN 'FULL';
END IF;

-- Reserve spot
INSERT INTO "Signup" (...) VALUES (...);

UPDATE "Slot"
SET "filledCount" = "filledCount" + 1
WHERE id = $1;

COMMIT;
```

**Behavior**:
- User A acquires lock → proceeds
- User B waits for lock → gets updated filledCount=4 → sees full → returns error
- **No overbooking possible**

### Implementation

```typescript
// src/lib/signup.ts
export async function createSignup(slotId: string, data: SignupData) {
  return await prisma.$transaction(async (tx) => {
    // Acquire row lock
    const slot = await tx.slot.findUnique({
      where: { id: slotId },
      include: { day: { include: { event: true } }, sevaType: true },
      // FOR UPDATE
      // Prisma doesn't support FOR UPDATE directly, use raw query
    });
    
    // Use raw query for FOR UPDATE
    const [lockedSlot] = await tx.$queryRaw`
      SELECT * FROM "Slot"
      WHERE id = ${slotId}
      FOR UPDATE
    `;
    
    if (lockedSlot.filledCount >= lockedSlot.capacity) {
      throw new Error('SLOT_FULL');
    }
    
    const signup = await tx.signup.create({
      data: { ...data, slotId }
    });
    
    await tx.slot.update({
      where: { id: slotId },
      data: { filledCount: { increment: 1 } }
    });
    
    return signup;
  });
}
```

## Google Sheets Sync Strategy

### Requirements
1. **Idempotent**: Running the same job multiple times produces the same result
2. **Non-blocking**: Never delays signup API response
3. **Durable**: Survives worker restarts
4. **Auditable**: Track sync status per signup

### Design

**Sheet Structure** (per event + month):
```
Spreadsheet: "Temple Volunteering - January 2026"
Tab: "Roster"

| Date       | Day | Shift           | Seva         | Cap | Filled | Name      | Email         | Phone      | Notes | Status    | Timestamp           | SignupId |
|------------|-----|-----------------|--------------|-----|--------|-----------|---------------|------------|-------|-----------|---------------------|----------|
| 2026-01-01 | Wed | 6:30 PM-8:30 PM | Kitchen Seva | 4   | 1      | John Doe  | john@test.com | 555-1234   |       | CONFIRMED | 2026-01-01 10:30:00 | abc123   |
| 2026-01-01 | Wed | 6:30 PM-8:30 PM | Hall Seva    | 3   | 1      | Jane Smith| jane@test.com | 555-5678   |       | CONFIRMED | 2026-01-01 11:00:00 | def456   |
```

**Upsert Algorithm**:
```typescript
async function upsertSignupToSheet(signupId: string) {
  // 1. Load signup from DB
  const signup = await prisma.signup.findUnique({
    where: { id: signupId },
    include: { slot: { include: { day: true, sevaType: true } } }
  });
  
  // 2. Get or create spreadsheet
  const spreadsheetId = await getOrCreateMonthlySheet(
    signup.slot.day.eventId,
    signup.slot.day.date
  );
  
  // 3. Find existing row by SignupId (column M)
  const rows = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Roster!M:M' // SignupId column
  });
  
  const existingRowIndex = rows.data.values?.findIndex(
    (row) => row[0] === signupId
  );
  
  // 4. Prepare row data
  const rowData = [
    formatDate(signup.slot.day.date),
    getDayOfWeek(signup.slot.day.date),
    signup.slot.day.event.shiftLabel,
    signup.slot.sevaType.name,
    signup.slot.capacity,
    signup.slot.filledCount,
    signup.name,
    signup.email,
    signup.phone || '',
    signup.notes || '',
    signup.status,
    signup.createdAt.toISOString(),
    signup.id
  ];
  
  // 5. Update or append
  if (existingRowIndex >= 0) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Roster!A${existingRowIndex + 1}:M${existingRowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] }
    });
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Roster!A:M',
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] }
    });
  }
  
  // 6. Log sync
  await prisma.exportSyncLog.create({
    data: {
      signupId,
      sheetsSpreadsheetId: spreadsheetId,
      s3Key: getS3Key(signup),
      status: 'SUCCESS',
      lastSyncedAt: new Date()
    }
  });
}
```

**Idempotency**: 
- Keyed by SignupId
- Running twice updates the same row (no duplicates)

## Security Considerations

### 1. Public Signup Protection
- **Rate Limiting**: 10 requests/minute per IP on signup endpoints
- **CAPTCHA**: Optional (can add later if needed)
- **Input Validation**: Joi/Zod schemas for all inputs

### 2. Cancellation Token Security
```typescript
// Generate token
const cancelToken = crypto.randomBytes(32).toString('hex');
const cancelTokenHash = crypto
  .createHash('sha256')
  .update(cancelToken)
  .digest('hex');

// Store only hash
await prisma.signup.create({
  data: { cancelTokenHash, ... }
});

// Send token in email
const cancelUrl = `${BASE_URL}/api/public/cancel/${cancelToken}`;
```

**Why**: If DB is compromised, attackers cannot cancel signups without the original token.

### 3. Admin Authentication
- **AWS Cognito**: User pools with MFA
- **Session Management**: HTTP-only cookies
- **RBAC**: Admin role required for all `/api/admin/*` endpoints

### 4. PII Protection
- **Public APIs**: Never expose volunteer emails/phones
- **S3**: Private bucket, presigned URLs for admin-only access
- **Logging**: Mask PII in application logs

### 5. AWS IAM Permissions (Least Privilege)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::volunteer-signups-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage"],
      "Resource": "arn:aws:sqs:us-east-1:123456789012:volunteer-jobs"
    },
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

## Scalability & Performance

### Current Design (Single EC2)
- **Capacity**: ~1000 signups/hour
- **Bottleneck**: Worker throughput on Sheets API (write quota: 100 requests/100 seconds/user)

### Scaling Options

#### Horizontal Scaling (Future)
1. **Multi-worker Deployment**:
   - Deploy 2-3 worker containers
   - SQS automatically distributes jobs
   - Each worker has own Google Service Account (separate quotas)

2. **Database**:
   - Migrate to RDS with read replicas
   - Roster queries use read replica
   - Writes stay on primary

3. **Caching**:
   - Redis for slot availability (TTL: 30s)
   - Invalidate on signup/cancellation

#### Google Sheets Quota Management
- **Quota**: 100 writes/100 seconds per service account
- **Strategy**: 
  - Batch updates (10 signups → 1 API call)
  - Use multiple service accounts (round-robin)
  - Fall back to S3-only if quota exceeded (manual Sheets sync later)

## Monitoring & Observability

### Metrics to Track
1. **Signup Success Rate**: % of signups that complete
2. **Worker Job Latency**: Time from enqueue to completion
3. **Sheets Sync Failure Rate**: % of failed syncs
4. **Email Delivery Rate**: % of emails successfully sent
5. **API Response Times**: p50, p95, p99

### Logging Strategy
```typescript
// Structured JSON logs
logger.info('signup.created', {
  signupId: 'abc123',
  slotId: 'def456',
  eventId: 'ghi789',
  timestamp: new Date().toISOString()
});

logger.error('sheets.sync.failed', {
  signupId: 'abc123',
  error: err.message,
  retryCount: 3
});
```

### Health Checks
- **Web App**: `GET /api/health` → 200 OK (checks DB connection)
- **Worker**: `GET /health` → 200 OK (checks SQS connection)

## Deployment Architecture (EC2)

```
EC2 Instance (Ubuntu 22.04)
├── Docker Containers
│   ├── nginx:alpine (Port 80, 443)
│   ├── volunteer-web:latest (Port 3000)
│   ├── volunteer-worker:latest
│   └── postgres:15-alpine (Port 5432) [optional, use RDS in prod]
│
├── Let's Encrypt
│   └── Certbot (auto-renewal cron)
│
└── CloudWatch Agent
    └── Log streaming
```

**Network**:
- Security Group: Allow 80, 443 from 0.0.0.0/0
- Nginx reverse proxy to Next.js
- HTTPS only (redirect HTTP → HTTPS)

## Disaster Recovery

### Backup Strategy
1. **PostgreSQL**: Daily automated RDS snapshots (7-day retention)
2. **S3**: Versioning enabled (can restore deleted signups)
3. **Google Sheets**: Owned by temple's Drive account (persists independently)

### Recovery Procedures
1. **DB Corruption**: Restore from RDS snapshot
2. **S3 Data Loss**: Rebuild from PostgreSQL using batch export script
3. **Sheets Data Loss**: Rebuild from PostgreSQL using `POST /api/admin/sync-retry?full=true`

## Cost Estimation (Monthly)

**AWS Services** (assumes 500 signups/month):
- EC2 t3.medium (1 instance): $30
- RDS PostgreSQL t3.micro: $15
- S3 Standard (1 GB): $0.02
- SQS (10,000 requests): $0.00
- SES (2,000 emails): $0.20
- Data Transfer: ~$5
- **Total**: ~$50/month

**Google Workspace**:
- Service Account: Free
- Sheets API: Free (under quotas)

**Domain + SSL**:
- Domain: $12/year
- Let's Encrypt SSL: Free

**Grand Total**: ~$51-52/month
