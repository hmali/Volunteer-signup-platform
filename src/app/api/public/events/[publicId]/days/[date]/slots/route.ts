import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';

export async function GET(
  request: NextRequest,
  { params }: { params: { publicId: string; date: string } }
) {
  try {
    const { publicId, date } = params;

    // Parse date
    const dateObj = new Date(date + 'T00:00:00Z');
    
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json(
        { error: 'INVALID_DATE', message: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Find event
    const event = await prisma.event.findUnique({
      where: { publicId },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'EVENT_NOT_FOUND', message: 'Event not found' },
        { status: 404 }
      );
    }

    // Find day
    const day = await prisma.day.findFirst({
      where: {
        eventId: event.id,
        date: dateObj,
      },
      include: {
        slots: {
          include: {
            sevaType: true,
          },
          orderBy: {
            sevaType: { sortOrder: 'asc' },
          },
        },
      },
    });

    if (!day) {
      return NextResponse.json(
        { error: 'DAY_NOT_FOUND', message: 'No volunteering available for this date' },
        { status: 404 }
      );
    }

    const dayOfWeekName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.dayOfWeek];

    return NextResponse.json({
      date: format(day.date, 'yyyy-MM-dd'),
      dayOfWeek: dayOfWeekName,
      shiftLabel: event.shiftLabel,
      isClosed: day.isClosed,
      notes: day.notes,
      slots: day.slots.map(slot => ({
        id: slot.id,
        sevaType: {
          name: slot.sevaType.name,
          description: slot.sevaType.description,
          icon: slot.sevaType.icon,
          color: slot.sevaType.color,
        },
        capacity: slot.capacity,
        filledCount: slot.filledCount,
        availableCount: slot.capacity - slot.filledCount,
        status: slot.status,
      })),
    });

  } catch (error) {
    console.error('[API] Slots error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to load slots' },
      { status: 500 }
    );
  }
}
