import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import type { Signup, Slot, Day, SevaType, Event } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';

const DISABLE_SHEETS = process.env.DISABLE_SHEETS_SYNC === 'true';

type SignupWithRelations = Signup & {
  slot: Slot & {
    day: Day & {
      event: Event;
    };
    sevaType: SevaType;
  };
};

// ============================================================================
// GOOGLE SHEETS CLIENT
// ============================================================================

let sheetsClient: sheets_v4.Sheets | null = null;
let authClient: JWT | null = null;

function getAuthClient(): JWT {
  if (authClient) return authClient;

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Service Account credentials not configured');
  }

  authClient = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  return authClient;
}

function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const auth = getAuthClient();
  sheetsClient = google.sheets({ version: 'v4', auth });

  return sheetsClient;
}

// ============================================================================
// SPREADSHEET MANAGEMENT
// ============================================================================

/**
 * Get or create Google Sheet for event + month
 * Returns spreadsheet ID
 */
export async function getOrCreateMonthlySheet(
  event: Event,
  date: Date
): Promise<string> {
  // Check if spreadsheet already exists for this event
  if (event.sheetsSpreadsheetId) {
    return event.sheetsSpreadsheetId;
  }

  // Create new spreadsheet
  const month = formatInTimeZone(date, event.timezone, 'MMMM yyyy');
  const title = `${event.name} - ${month}`;

  const sheets = getSheetsClient();
  const drive = google.drive({ version: 'v3', auth: getAuthClient() });

  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title,
        timeZone: event.timezone,
      },
      sheets: [
        {
          properties: {
            title: 'Roster',
            gridProperties: {
              frozenRowCount: 1, // Freeze header row
            },
          },
        },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId!;

  // Add header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Roster!A1:M1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        'Date',
        'Day',
        'Shift',
        'Seva',
        'Capacity',
        'Filled',
        'Name',
        'Email',
        'Phone',
        'Notes',
        'Status',
        'Timestamp',
        'SignupId',
      ]],
    },
  });

  // Format header row (bold, background color)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.4, green: 0.5, blue: 0.9 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true,
                },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        },
      ],
    },
  });

  // Move to Drive folder if configured
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: process.env.GOOGLE_DRIVE_FOLDER_ID,
      fields: 'id, parents',
    });
  }

  console.log(`[Sheets] Created spreadsheet: ${title} (${spreadsheetId})`);

  // Update event with spreadsheet ID
  const { prisma } = await import('./db');
  await prisma.event.update({
    where: { id: event.id },
    data: { sheetsSpreadsheetId: spreadsheetId },
  });

  return spreadsheetId;
}

// ============================================================================
// SIGNUP SYNC
// ============================================================================

/**
 * Upsert signup to Google Sheets (idempotent)
 */
export async function upsertSignupToSheet(signup: SignupWithRelations): Promise<number> {
  if (DISABLE_SHEETS) {
    console.log('[Sheets] DISABLED - Would upsert signup:', signup.id);
    return -1;
  }

  const event = signup.slot.day.event;
  const day = signup.slot.day;
  const seva = signup.slot.sevaType;
  
  // Get or create spreadsheet
  const spreadsheetId = await getOrCreateMonthlySheet(event, day.date);
  const sheets = getSheetsClient();

  // Prepare row data
  const dateStr = formatInTimeZone(day.date, event.timezone, 'yyyy-MM-dd');
  const dayOfWeekStr = formatInTimeZone(day.date, event.timezone, 'EEEE');
  const timestampStr = formatInTimeZone(signup.createdAt, event.timezone, 'yyyy-MM-dd HH:mm:ss');

  const rowData = [
    dateStr,
    dayOfWeekStr,
    event.shiftLabel,
    seva.name,
    signup.slot.capacity,
    signup.slot.filledCount,
    signup.name,
    signup.email,
    signup.phone || '',
    signup.notes || '',
    signup.status,
    timestampStr,
    signup.id,
  ];

  // Find existing row by SignupId (column M)
  const existingData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Roster!M:M',
  });

  const signupIds = existingData.data.values || [];
  const existingRowIndex = signupIds.findIndex(row => row[0] === signup.id);

  let rowNumber: number;

  if (existingRowIndex >= 0) {
    // Update existing row
    rowNumber = existingRowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Roster!A${rowNumber}:M${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData],
      },
    });
    console.log(`[Sheets] Updated row ${rowNumber} for signup ${signup.id}`);
  } else {
    // Append new row
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Roster!A:M',
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData],
      },
    });
    
    // Extract row number from update range (e.g., "Roster!A2:M2")
    const updatedRange = appendResponse.data.updates?.updatedRange || '';
    const match = updatedRange.match(/A(\d+)/);
    rowNumber = match ? parseInt(match[1]) : -1;
    
    console.log(`[Sheets] Appended row ${rowNumber} for signup ${signup.id}`);
  }

  return rowNumber;
}

/**
 * Mark signup as cancelled in Sheets
 */
export async function markSignupCancelledInSheet(signup: SignupWithRelations): Promise<void> {
  if (DISABLE_SHEETS) {
    console.log('[Sheets] DISABLED - Would mark cancelled:', signup.id);
    return;
  }

  const event = signup.slot.day.event;
  const day = signup.slot.day;
  
  if (!event.sheetsSpreadsheetId) {
    console.warn(`[Sheets] No spreadsheet ID for event ${event.id}, skipping cancel sync`);
    return;
  }

  const spreadsheetId = event.sheetsSpreadsheetId;
  const sheets = getSheetsClient();

  // Find row by SignupId
  const existingData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Roster!M:M',
  });

  const signupIds = existingData.data.values || [];
  const rowIndex = signupIds.findIndex(row => row[0] === signup.id);

  if (rowIndex < 0) {
    console.warn(`[Sheets] Signup ${signup.id} not found in sheet, cannot mark cancelled`);
    return;
  }

  const rowNumber = rowIndex + 1;

  // Update Status column (K) and Filled count (F)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Roster!K${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['CANCELLED']],
    },
  });

  // Update filled count
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Roster!F${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[signup.slot.filledCount]],
    },
  });

  console.log(`[Sheets] Marked row ${rowNumber} as CANCELLED for signup ${signup.id}`);
}

/**
 * Batch sync all signups for an event (for admin retry)
 */
export async function batchSyncSignups(eventId: string, month?: string): Promise<number> {
  const { prisma } = await import('./db');

  const signups = await prisma.signup.findMany({
    where: {
      slot: {
        day: {
          eventId,
          ...(month && {
            date: {
              gte: new Date(`${month}-01`),
              lt: new Date(new Date(`${month}-01`).setMonth(new Date(`${month}-01`).getMonth() + 1)),
            },
          }),
        },
      },
    },
    include: {
      slot: {
        include: {
          day: { include: { event: true } },
          sevaType: true,
        },
      },
    },
  });

  let synced = 0;
  for (const signup of signups) {
    try {
      if (signup.status === 'CANCELLED') {
        await markSignupCancelledInSheet(signup);
      } else {
        await upsertSignupToSheet(signup);
      }
      synced++;
    } catch (error) {
      console.error(`[Sheets] Failed to sync signup ${signup.id}:`, error);
    }
  }

  console.log(`[Sheets] Batch synced ${synced}/${signups.length} signups`);
  return synced;
}

export default getSheetsClient;
