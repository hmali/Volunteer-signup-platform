import { NextRequest, NextResponse } from 'next/server';
import { getSignupById } from '@/lib/signup';
import ical from 'ical-generator';
import { parseShiftLabel } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { signupId: string } }
) {
  try {
    const { signupId } = params;

    // Get signup details
    const signup = await getSignupById(signupId);

    const event = signup.slot.day.event;
    const day = signup.slot.day;
    const seva = signup.slot.sevaType;

    // Parse shift times
    const times = parseShiftLabel(event.shiftLabel);
    const [startHour, startMin] = times.start.split(':');
    const [endHour, endMin] = times.end.split(':');

    const startTime = new Date(day.date);
    startTime.setHours(parseInt(startHour), parseInt(startMin), 0);

    const endTime = new Date(day.date);
    endTime.setHours(parseInt(endHour), parseInt(endMin), 0);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const cancelUrl = `${baseUrl}/api/public/cancel/${signup.cancelToken}`;

    // Create iCalendar
    const calendar = ical({
      name: event.name,
      timezone: event.timezone,
    });

    calendar.createEvent({
      start: startTime,
      end: endTime,
      summary: `${seva.name} - ${event.name}`,
      description: `Thank you for volunteering!\n\nSeva: ${seva.name}\n${seva.description || ''}\n\nTo cancel your signup, visit:\n${cancelUrl}`,
      location: 'Temple',
      url: baseUrl,
      organizer: {
        name: 'Temple Volunteering',
        email: process.env.SES_FROM_EMAIL || 'noreply@temple.org',
      },
      status: 'CONFIRMED',
    });

    // Return ICS file
    const icsContent = calendar.toString();

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="volunteer-signup-${signupId}.ics"`,
      },
    });

  } catch (error) {
    console.error('[API] Calendar ICS error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to generate calendar file' },
      { status: 500 }
    );
  }
}
