# API Specification

## Base URLs

- **Public**: `https://yourdomain.com/api/public`
- **Admin**: `https://yourdomain.com/api/admin`

## Authentication

### Admin Endpoints
- **Method**: AWS Cognito JWT Bearer Token
- **Header**: `Authorization: Bearer <token>`

### Public Endpoints
- No authentication required
- Rate limited: 10 requests/minute per IP

---

## Public API

### 1. Get Event Calendar

Retrieve month calendar with slot availability.

```http
GET /api/public/events/:publicId/calendar?month=YYYY-MM
```

**Parameters**:
- `publicId` (path): Event's public ID
- `month` (query): Month in `YYYY-MM` format

**Response**: `200 OK`
```json
{
  "event": {
    "id": "evt_123",
    "name": "Temple Volunteering - January 2026",
    "shiftLabel": "6:30 PM – 8:30 PM",
    "timezone": "America/New_York",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  },
  "days": [
    {
      "date": "2026-01-01",
      "dayOfWeek": "Wednesday",
      "isClosed": false,
      "totalSlots": 4,
      "filledSlots": 2,
      "availableSlots": 2,
      "slots": [
        {
          "id": "slot_abc",
          "sevaName": "Kitchen Seva",
          "capacity": 4,
          "filledCount": 1,
          "status": "ACTIVE"
        },
        {
          "id": "slot_def",
          "sevaName": "Hall Cleaning",
          "capacity": 3,
          "filledCount": 1,
          "status": "ACTIVE"
        }
      ]
    },
    {
      "date": "2026-01-02",
      "dayOfWeek": "Thursday",
      "isClosed": true,
      "reason": "Temple Policy: No volunteering on Thursdays"
    }
  ]
}
```

---

### 2. Get Slots for a Specific Day

```http
GET /api/public/events/:publicId/days/:date/slots
```

**Parameters**:
- `publicId` (path): Event's public ID
- `date` (path): Date in `YYYY-MM-DD` format

**Response**: `200 OK`
```json
{
  "date": "2026-01-01",
  "dayOfWeek": "Wednesday",
  "shiftLabel": "6:30 PM – 8:30 PM",
  "isClosed": false,
  "slots": [
    {
      "id": "slot_abc",
      "sevaType": {
        "name": "Kitchen Seva",
        "description": "Help prepare prasad and clean kitchen",
        "icon": "🍽️",
        "color": "#3B82F6"
      },
      "capacity": 4,
      "filledCount": 1,
      "availableCount": 3,
      "status": "ACTIVE"
    },
    {
      "id": "slot_def",
      "sevaType": {
        "name": "Hall Cleaning",
        "description": "Sweep and mop main hall",
        "icon": "🧹",
        "color": "#10B981"
      },
      "capacity": 3,
      "filledCount": 3,
      "availableCount": 0,
      "status": "FULL"
    }
  ]
}
```

**Errors**:
- `404`: Day not found or event doesn't exist
- `400`: Invalid date format

---

### 3. Create Signup

```http
POST /api/public/slots/:slotId/signup
```

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1-555-1234",
  "notes": "First time volunteering, excited to help!"
}
```

**Validation**:
- `name`: Required, 2-100 characters
- `email`: Required, valid email format
- `phone`: Optional, valid phone format
- `notes`: Optional, max 500 characters

**Response**: `201 Created`
```json
{
  "signup": {
    "id": "signup_xyz",
    "slotId": "slot_abc",
    "name": "John Doe",
    "email": "john@example.com",
    "status": "CONFIRMED",
    "createdAt": "2026-01-01T10:30:00Z"
  },
  "event": {
    "name": "Temple Volunteering - January 2026",
    "date": "2026-01-01",
    "dayOfWeek": "Wednesday",
    "shiftLabel": "6:30 PM – 8:30 PM",
    "sevaName": "Kitchen Seva",
    "timezone": "America/New_York"
  },
  "calendar": {
    "icsDownloadUrl": "/api/public/signups/signup_xyz/calendar.ics",
    "googleCalendarUrl": "https://calendar.google.com/calendar/render?action=TEMPLATE&text=..."
  },
  "message": "Signup confirmed! Check your email for details and cancellation link."
}
```

**Errors**:
- `400`: Validation failed (invalid input)
- `404`: Slot not found
- `409`: Slot is full
- `409`: Duplicate signup (same email already registered for this slot)
- `410`: Day is closed
- `429`: Rate limit exceeded

---

### 4. Download Calendar ICS

```http
GET /api/public/signups/:signupId/calendar.ics
```

**Response**: `200 OK`
```
Content-Type: text/calendar
Content-Disposition: attachment; filename="volunteer-signup.ics"

BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Temple Volunteering//EN
BEGIN:VEVENT
UID:signup_xyz@temple.org
DTSTAMP:20260101T103000Z
DTSTART;TZID=America/New_York:20260101T183000
DTEND;TZID=America/New_York:20260101T203000
SUMMARY:Kitchen Seva - Temple Volunteering
DESCRIPTION:Thank you for volunteering!\n\nTo cancel: https://...
LOCATION:Temple Address
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

---

### 5. Cancel Signup

```http
POST /api/public/cancel/:token
```

**Parameters**:
- `token` (path): Secure cancellation token from email

**Response**: `200 OK`
```json
{
  "message": "Your signup has been cancelled successfully.",
  "signup": {
    "id": "signup_xyz",
    "name": "John Doe",
    "date": "2026-01-01",
    "sevaName": "Kitchen Seva",
    "status": "CANCELLED",
    "cancelledAt": "2026-01-01T12:00:00Z"
  }
}
```

**Errors**:
- `404`: Invalid or expired token
- `410`: Signup already cancelled

---

## Admin API

### 1. Create Event

```http
POST /api/admin/events
```

**Headers**:
```
Authorization: Bearer <cognito-token>
```

**Request Body**:
```json
{
  "name": "Temple Volunteering - January 2026",
  "description": "Monthly volunteering schedule for our temple community",
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "timezone": "America/New_York",
  "shiftLabel": "6:30 PM – 8:30 PM"
}
```

**Response**: `201 Created`
```json
{
  "event": {
    "id": "evt_123",
    "publicId": "clx7a2b3c0001",
    "name": "Temple Volunteering - January 2026",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31",
    "timezone": "America/New_York",
    "shiftLabel": "6:30 PM – 8:30 PM",
    "publicUrl": "https://yourdomain.com/signup/clx7a2b3c0001",
    "createdAt": "2026-01-01T08:00:00Z"
  }
}
```

---

### 2. Create Seva Type

```http
POST /api/admin/events/:eventId/sevas
```

**Request Body**:
```json
{
  "name": "Kitchen Seva",
  "description": "Help prepare prasad and clean kitchen after service",
  "defaultCapacity": 4,
  "sortOrder": 1,
  "icon": "🍽️",
  "color": "#3B82F6",
  "isActive": true
}
```

**Response**: `201 Created`
```json
{
  "sevaType": {
    "id": "seva_abc",
    "eventId": "evt_123",
    "name": "Kitchen Seva",
    "description": "Help prepare prasad and clean kitchen after service",
    "defaultCapacity": 4,
    "sortOrder": 1,
    "icon": "🍽️",
    "color": "#3B82F6",
    "isActive": true
  }
}
```

---

### 3. Generate Monthly Schedule

Auto-creates Day and Slot records for entire month (excluding Thu/Fri).

```http
POST /api/admin/events/:eventId/generate-schedule?month=YYYY-MM
```

**Query Parameters**:
- `month`: Month to generate (e.g., `2026-01`)

**Response**: `201 Created`
```json
{
  "summary": {
    "month": "2026-01",
    "totalDays": 31,
    "generatedDays": 22,
    "skippedDays": 9,
    "skippedReasons": {
      "thursday": 4,
      "friday": 5
    },
    "totalSlots": 88,
    "sevaTypes": [
      { "name": "Kitchen Seva", "slots": 22 },
      { "name": "Hall Cleaning", "slots": 22 },
      { "name": "Garden Seva", "slots": 22 },
      { "name": "Office Help", "slots": 22 }
    ]
  },
  "days": [
    {
      "date": "2026-01-01",
      "dayOfWeek": "Wednesday",
      "slotsCreated": 4
    }
    // ... 21 more days
  ]
}
```

**Errors**:
- `400`: Schedule already exists for this month
- `400`: No active seva types defined

---

### 4. Update Day (Close/Notes)

```http
PATCH /api/admin/days/:dayId
```

**Request Body**:
```json
{
  "isClosed": true,
  "notes": "Temple closed for Diwali celebration"
}
```

**Response**: `200 OK`
```json
{
  "day": {
    "id": "day_123",
    "date": "2026-01-15",
    "isClosed": true,
    "notes": "Temple closed for Diwali celebration",
    "updatedAt": "2026-01-01T10:00:00Z"
  }
}
```

---

### 5. Update Slot Capacity

```http
PATCH /api/admin/slots/:slotId
```

**Request Body**:
```json
{
  "capacity": 6,
  "status": "ACTIVE"
}
```

**Response**: `200 OK`
```json
{
  "slot": {
    "id": "slot_abc",
    "capacity": 6,
    "filledCount": 2,
    "status": "ACTIVE",
    "updatedAt": "2026-01-01T10:00:00Z"
  }
}
```

**Errors**:
- `400`: Cannot reduce capacity below current filledCount

---

### 6. Get Roster

```http
GET /api/admin/events/:eventId/roster?month=YYYY-MM&groupBy=day|seva
```

**Query Parameters**:
- `month`: Filter by month (optional)
- `groupBy`: Group results by `day` or `seva` (default: `day`)
- `search`: Search by volunteer name/email (optional)

**Response**: `200 OK`
```json
{
  "event": {
    "id": "evt_123",
    "name": "Temple Volunteering - January 2026"
  },
  "month": "2026-01",
  "groupBy": "day",
  "roster": [
    {
      "date": "2026-01-01",
      "dayOfWeek": "Wednesday",
      "shiftLabel": "6:30 PM – 8:30 PM",
      "totalCapacity": 13,
      "totalFilled": 5,
      "slots": [
        {
          "sevaName": "Kitchen Seva",
          "capacity": 4,
          "filledCount": 2,
          "signups": [
            {
              "id": "signup_1",
              "name": "John Doe",
              "email": "john@example.com",
              "phone": "+1-555-1234",
              "status": "CONFIRMED",
              "createdAt": "2026-01-01T10:30:00Z"
            }
          ]
        }
      ]
    }
  ],
  "summary": {
    "totalDays": 22,
    "totalSlots": 88,
    "totalCapacity": 350,
    "totalFilled": 127,
    "fillRate": 36.3
  }
}
```

---

### 7. Export Roster CSV

```http
GET /api/admin/events/:eventId/export?month=YYYY-MM&format=csv
```

**Response**: `200 OK`
```
Content-Type: text/csv
Content-Disposition: attachment; filename="roster-2026-01.csv"

Date,Day,Shift,Seva,Capacity,Filled,Name,Email,Phone,Notes,Status,Timestamp
2026-01-01,Wednesday,"6:30 PM – 8:30 PM",Kitchen Seva,4,1,John Doe,john@example.com,+1-555-1234,,CONFIRMED,2026-01-01T10:30:00Z
```

---

### 8. Get Sync Status

```http
GET /api/admin/events/:eventId/sync-status?month=YYYY-MM
```

**Response**: `200 OK`
```json
{
  "month": "2026-01",
  "summary": {
    "totalSignups": 127,
    "s3Synced": 127,
    "s3Failed": 0,
    "sheetsSynced": 125,
    "sheetsFailed": 2,
    "emailsSent": 126,
    "emailsFailed": 1
  },
  "failures": [
    {
      "signupId": "signup_xyz",
      "type": "SHEETS_SYNC",
      "error": "API quota exceeded",
      "retryCount": 3,
      "lastAttemptedAt": "2026-01-01T11:00:00Z"
    }
  ],
  "sheetsUrl": "https://docs.google.com/spreadsheets/d/abc123"
}
```

---

### 9. Retry Failed Syncs

```http
POST /api/admin/events/:eventId/sync-retry
```

**Request Body**:
```json
{
  "signupIds": ["signup_1", "signup_2"],
  "syncTypes": ["SHEETS", "EMAIL"]
}
```

**Response**: `200 OK`
```json
{
  "message": "Retry jobs enqueued",
  "jobsCreated": 4
}
```

---

### 10. Manual Signup (Admin)

```http
POST /api/admin/slots/:slotId/signup
```

**Request Body**:
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1-555-5678",
  "notes": "Added manually by admin",
  "sendConfirmation": true
}
```

**Response**: `201 Created`
```json
{
  "signup": {
    "id": "signup_abc",
    "name": "Jane Smith",
    "status": "CONFIRMED",
    "createdAt": "2026-01-01T10:00:00Z"
  }
}
```

---

### 11. Delete Signup (Admin)

```http
DELETE /api/admin/signups/:signupId
```

**Response**: `200 OK`
```json
{
  "message": "Signup deleted successfully",
  "signup": {
    "id": "signup_abc",
    "status": "CANCELLED"
  }
}
```

---

## Webhooks (Optional Future Enhancement)

For external integrations, the system can POST to configured webhook URLs:

```http
POST https://your-webhook-url.com/volunteer-signup
Content-Type: application/json
X-Webhook-Signature: sha256=...

{
  "event": "signup.created",
  "timestamp": "2026-01-01T10:30:00Z",
  "data": {
    "signupId": "signup_xyz",
    "eventId": "evt_123",
    "date": "2026-01-15",
    "sevaName": "Kitchen Seva"
  }
}
```

---

## Rate Limits

### Public Endpoints
- **Signup**: 10 requests/minute per IP
- **Calendar**: 60 requests/minute per IP
- **Cancel**: 5 requests/minute per IP

### Admin Endpoints
- **General**: 100 requests/minute per user
- **Export**: 10 requests/minute per user

**Rate Limit Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1704110400
```

**Response** when rate limited:
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again in 45 seconds.",
  "retryAfter": 45
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "email",
    "reason": "Invalid email format"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `SLOT_FULL` | 409 | Slot has reached capacity |
| `DAY_CLOSED` | 410 | Day is closed for signups |
| `DUPLICATE_SIGNUP` | 409 | Email already registered |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Missing/invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
