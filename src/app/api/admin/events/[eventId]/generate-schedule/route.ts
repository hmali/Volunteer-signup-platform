import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateMonthDays } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // TODO: Add admin authentication

    const { eventId } = params;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'INVALID_MONTH', message: 'Month must be in YYYY-MM format' },
        { status: 400 }
      );
    }

    // Get event
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        sevaTypes: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'EVENT_NOT_FOUND', message: 'Event not found' },
        { status: 404 }
      );
    }

    if (event.sevaTypes.length === 0) {
      return NextResponse.json(
        { error: 'NO_SEVA_TYPES', message: 'Please create at least one seva type before generating schedule' },
        { status: 400 }
      );
    }

    // Parse month
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0); // Last day of month

    // Check if schedule already exists
    const existingDays = await prisma.day.count({
      where: {
        eventId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (existingDays > 0) {
      return NextResponse.json(
        { error: 'SCHEDULE_EXISTS', message: 'Schedule already exists for this month' },
        { status: 409 }
      );
    }

    // Generate days (excluding Thu/Fri)
    const monthDays = generateMonthDays(startDate, endDate, event.timezone);
    const validDays = monthDays.filter(d => !d.skip);

    // Create days and slots in transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdDays = [];
      let totalSlots = 0;

      for (const dayInfo of validDays) {
        // Create day
        const day = await tx.day.create({
          data: {
            eventId,
            date: dayInfo.date,
            dayOfWeek: dayInfo.dayOfWeek,
            isClosed: false,
          },
        });

        // Create slots for each seva type
        for (const sevaType of event.sevaTypes) {
          await tx.slot.create({
            data: {
              dayId: day.id,
              sevaTypeId: sevaType.id,
              capacity: sevaType.defaultCapacity,
              filledCount: 0,
              status: 'ACTIVE',
            },
          });
          totalSlots++;
        }

        createdDays.push({
          date: day.date.toISOString().substring(0, 10),
          dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.dayOfWeek],
          slotsCreated: event.sevaTypes.length,
        });
      }

      return { createdDays, totalSlots };
    });

    const skippedDays = monthDays.filter(d => d.skip);
    const skippedReasons = {
      thursday: skippedDays.filter(d => d.dayOfWeek === 4).length,
      friday: skippedDays.filter(d => d.dayOfWeek === 5).length,
    };

    return NextResponse.json(
      {
        summary: {
          month,
          totalDays: monthDays.length,
          generatedDays: validDays.length,
          skippedDays: skippedDays.length,
          skippedReasons,
          totalSlots: result.totalSlots,
          sevaTypes: event.sevaTypes.map(seva => ({
            name: seva.name,
            slots: validDays.length,
          })),
        },
        days: result.createdDays,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[API] Generate schedule error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to generate schedule' },
      { status: 500 }
    );
  }
}
