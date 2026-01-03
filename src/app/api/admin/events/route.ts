import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateMonthDays } from '@/lib/utils';
import Joi from 'joi';

const eventSchema = Joi.object({
  name: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).optional().allow('', null),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  timezone: Joi.string().default('America/New_York'),
  shiftLabel: Joi.string().required(),
});

export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin authentication check here
    // const session = await getServerSession();
    // if (!session?.user?.isAdmin) return 401

    const body = await request.json();
    const { error, value } = eventSchema.validate(body);

    if (error) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: error.details[0].message },
        { status: 400 }
      );
    }

    // Create event with unique publicId
    const event = await prisma.event.create({
      data: {
        name: value.name,
        description: value.description,
        startDate: new Date(value.startDate),
        endDate: new Date(value.endDate),
        timezone: value.timezone,
        shiftLabel: value.shiftLabel,
        // TODO: Use actual admin ID from session
        createdById: 'admin-placeholder',
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const publicUrl = `${baseUrl}/signup/${event.publicId}`;

    return NextResponse.json(
      {
        event: {
          id: event.id,
          publicId: event.publicId,
          name: event.name,
          description: event.description,
          startDate: event.startDate.toISOString().substring(0, 10),
          endDate: event.endDate.toISOString().substring(0, 10),
          timezone: event.timezone,
          shiftLabel: event.shiftLabel,
          publicUrl,
          createdAt: event.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[API] Create event error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create event' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication

    const events = await prisma.event.findMany({
      include: {
        sevaTypes: {
          where: { isActive: true },
        },
        _count: {
          select: {
            days: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    return NextResponse.json({
      events: events.map(event => ({
        id: event.id,
        publicId: event.publicId,
        name: event.name,
        startDate: event.startDate.toISOString().substring(0, 10),
        endDate: event.endDate.toISOString().substring(0, 10),
        timezone: event.timezone,
        shiftLabel: event.shiftLabel,
        publicUrl: `${baseUrl}/signup/${event.publicId}`,
        sevaTypesCount: event.sevaTypes.length,
        daysCount: event._count.days,
        createdAt: event.createdAt.toISOString(),
      })),
    });

  } catch (error) {
    console.error('[API] List events error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to list events' },
      { status: 500 }
    );
  }
}
