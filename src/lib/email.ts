import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { Signup, Slot, Day, SevaType, Event } from '@prisma/client';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const sesClient = new SESClient({
  region: process.env.SES_REGION || process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL!;
const FROM_NAME = process.env.SES_FROM_NAME || 'Volunteer Signup';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;
const DISABLE_EMAIL = process.env.DISABLE_EMAIL_SENDING === 'true';

type SignupWithRelations = Signup & {
  slot: Slot & {
    day: Day & {
      event: Event;
    };
    sevaType: SevaType;
  };
};

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function getConfirmationEmailHtml(signup: SignupWithRelations): string {
  const event = signup.slot.day.event;
  const day = signup.slot.day;
  const seva = signup.slot.sevaType;
  
  const dateStr = formatInTimeZone(day.date, event.timezone, 'EEEE, MMMM d, yyyy');
  const cancelUrl = `${BASE_URL}/api/public/cancel/${signup.cancelToken}`;
  const icsUrl = `${BASE_URL}/api/public/signups/${signup.id}/calendar.ics`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Volunteer Signup Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">✓ Signup Confirmed!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-top: 0;">Hi ${signup.name},</p>
    
    <p>Thank you for volunteering! Your signup has been confirmed.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">${event.name}</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; width: 120px;">📅 Date:</td>
          <td style="padding: 8px 0;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">⏰ Time:</td>
          <td style="padding: 8px 0;">${event.shiftLabel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">🙏 Seva:</td>
          <td style="padding: 8px 0;">${seva.name}</td>
        </tr>
        ${seva.description ? `
        <tr>
          <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">📝 Details:</td>
          <td style="padding: 8px 0; color: #666;">${seva.description}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <div style="margin: 30px 0;">
      <h3 style="margin-bottom: 15px;">Add to Calendar</h3>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <a href="${icsUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
          📥 Download ICS
        </a>
        <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(seva.name + ' - ' + event.name)}&dates=${formatInTimeZone(day.date, event.timezone, 'yyyyMMdd')}T${event.shiftLabel.split('–')[0].trim().replace(/[: ]/g, '')}00/${formatInTimeZone(day.date, event.timezone, 'yyyyMMdd')}T${event.shiftLabel.split('–')[1].trim().replace(/[: ]/g, '')}00&details=${encodeURIComponent('Thank you for volunteering!')}&location=${encodeURIComponent('Temple')}" style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
          📅 Google Calendar
        </a>
      </div>
    </div>
    
    <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;">
        <strong>Need to cancel?</strong> Click the button below. Please cancel as soon as possible so others can sign up.
      </p>
      <a href="${cancelUrl}" style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px; font-size: 14px;">
        Cancel My Signup
      </a>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">
      <p>Questions? Please contact the temple office.</p>
      <p style="margin-bottom: 0;">With gratitude,<br><strong>${FROM_NAME}</strong></p>
    </div>
  </div>
</body>
</html>
  `;
}

function getConfirmationEmailText(signup: SignupWithRelations): string {
  const event = signup.slot.day.event;
  const day = signup.slot.day;
  const seva = signup.slot.sevaType;
  
  const dateStr = formatInTimeZone(day.date, event.timezone, 'EEEE, MMMM d, yyyy');
  const cancelUrl = `${BASE_URL}/api/public/cancel/${signup.cancelToken}`;

  return `
✓ SIGNUP CONFIRMED

Hi ${signup.name},

Thank you for volunteering! Your signup has been confirmed.

EVENT: ${event.name}
DATE: ${dateStr}
TIME: ${event.shiftLabel}
SEVA: ${seva.name}
${seva.description ? '\nDETAILS: ' + seva.description : ''}

NEED TO CANCEL?
If you cannot make it, please cancel as soon as possible:
${cancelUrl}

ADD TO CALENDAR:
Download: ${BASE_URL}/api/public/signups/${signup.id}/calendar.ics

Questions? Please contact the temple office.

With gratitude,
${FROM_NAME}
  `;
}

function getCancellationEmailHtml(signup: SignupWithRelations): string {
  const event = signup.slot.day.event;
  const day = signup.slot.day;
  const seva = signup.slot.sevaType;
  
  const dateStr = formatInTimeZone(day.date, event.timezone, 'EEEE, MMMM d, yyyy');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signup Cancelled</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #6b7280; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">Signup Cancelled</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-top: 0;">Hi ${signup.name},</p>
    
    <p>Your volunteer signup has been cancelled as requested.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b7280;">
      <h2 style="margin-top: 0; color: #6b7280; font-size: 20px;">Cancelled Signup</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; width: 120px;">Event:</td>
          <td style="padding: 8px 0;">${event.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Date:</td>
          <td style="padding: 8px 0;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Time:</td>
          <td style="padding: 8px 0;">${event.shiftLabel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">Seva:</td>
          <td style="padding: 8px 0;">${seva.name}</td>
        </tr>
      </table>
    </div>
    
    <p>This spot is now available for other volunteers. If you'd like to sign up again, please visit the signup page.</p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">
      <p style="margin-bottom: 0;">Thank you,<br><strong>${FROM_NAME}</strong></p>
    </div>
  </div>
</body>
</html>
  `;
}

// ============================================================================
// EMAIL SENDING
// ============================================================================

export async function sendConfirmationEmail(signup: SignupWithRelations): Promise<string> {
  if (DISABLE_EMAIL) {
    console.log('[Email] DISABLED - Would send confirmation email to:', signup.email);
    return 'disabled';
  }

  const command = new SendEmailCommand({
    Source: `${FROM_NAME} <${FROM_EMAIL}>`,
    Destination: {
      ToAddresses: [signup.email],
    },
    Message: {
      Subject: {
        Data: `✓ Volunteer Signup Confirmed - ${signup.slot.sevaType.name}`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: getConfirmationEmailHtml(signup),
          Charset: 'UTF-8',
        },
        Text: {
          Data: getConfirmationEmailText(signup),
          Charset: 'UTF-8',
        },
      },
    },
  });

  const response = await sesClient.send(command);
  console.log(`[Email] Sent confirmation to ${signup.email}, MessageId: ${response.MessageId}`);
  
  return response.MessageId!;
}

export async function sendCancellationEmail(signup: SignupWithRelations): Promise<string> {
  if (DISABLE_EMAIL) {
    console.log('[Email] DISABLED - Would send cancellation email to:', signup.email);
    return 'disabled';
  }

  const command = new SendEmailCommand({
    Source: `${FROM_NAME} <${FROM_EMAIL}>`,
    Destination: {
      ToAddresses: [signup.email],
    },
    Message: {
      Subject: {
        Data: `Signup Cancelled - ${signup.slot.sevaType.name}`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: getCancellationEmailHtml(signup),
          Charset: 'UTF-8',
        },
      },
    },
  });

  const response = await sesClient.send(command);
  console.log(`[Email] Sent cancellation to ${signup.email}, MessageId: ${response.MessageId}`);
  
  return response.MessageId!;
}

export default sesClient;
