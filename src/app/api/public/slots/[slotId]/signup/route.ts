import { NextRequest, NextResponse } from 'next/server';
import { createSignup, SignupError } from '@/lib/signup';
import { generateGoogleCalendarUrl, parseShiftLabel } from '@/lib/utils';
import Joi from 'joi';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// Validation schema
const signupSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().max(20).optional().allow('', null),
  notes: Joi.string().max(500).optional().allow('', null),
});

// Rate limiting (simple in-memory, use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slotId: string } }
) {
  try {
    const { slotId } = params;

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again in a minute.',
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { error, value } = signupSchema.validate(body);

    if (error) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          details: error.details,
        },
        { status: 400 }
      );
    }

    // Create signup (race-safe with DB locking)
    const signup = await createSignup(slotId, value);

    // Generate calendar URLs
    const event = signup.slot.day.event;
    const day = signup.slot.day;
    const seva = signup.slot.sevaType;

    const times = parseShiftLabel(event.shiftLabel);
    const [startHour, startMin] = times.start.split(':');
    const [endHour, endMin] = times.end.split(':');

    const startTime = new Date(day.date);
    startTime.setHours(parseInt(startHour), parseInt(startMin), 0);

    const endTime = new Date(day.date);
    endTime.setHours(parseInt(endHour), parseInt(endMin), 0);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const icsUrl = `${baseUrl}/api/public/signups/${signup.id}/calendar.ics`;

    const googleCalendarUrl = generateGoogleCalendarUrl({
      title: `${seva.name} - ${event.name}`,
      description: `Thank you for volunteering!\n\n${seva.description || ''}\n\nTo cancel: ${baseUrl}/api/public/cancel/${signup.cancelToken}`,
      location: 'Temple',
      startTime,
      endTime,
      timezone: event.timezone,
    });

    const dateStr = formatInTimeZone(day.date, event.timezone, 'yyyy-MM-dd');
    const dayOfWeek = formatInTimeZone(day.date, event.timezone, 'EEEE');

    return NextResponse.json(
      {
        signup: {
          id: signup.id,
          slotId: signup.slotId,
          name: signup.name,
          email: signup.email,
          status: signup.status,
          createdAt: signup.createdAt.toISOString(),
        },
        event: {
          name: event.name,
          date: dateStr,
          dayOfWeek,
          shiftLabel: event.shiftLabel,
          sevaName: seva.name,
          sevaDescription: seva.description,
          timezone: event.timezone,
        },
        calendar: {
          icsDownloadUrl: icsUrl,
          googleCalendarUrl,
        },
        message: 'Signup confirmed! Check your email for details and cancellation link.',
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[API] Signup error:', error);

    if (error instanceof SignupError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create signup' },
      { status: 500 }
    );
  }
}
