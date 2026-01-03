import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';

export async function GET(
  request: NextRequest,
  { params }: { params: { publicId: string } }
) {
  try {
    const { publicId } = params;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM

    // Find event by publicId
    const event = await prisma.event.findUnique({
      where: { publicId },
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

    // Build date filter
    let dateFilter: any = {
      eventId: event.id,
    };

    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      
      dateFilter.date = {
        gte: startDate,
        lte: endDate,
      };
    } else {
      // Default to event date range
      dateFilter.date = {
        gte: event.startDate,
        lte: event.endDate,
      };
    }

    // Get days with slots
    const days = await prisma.day.findMany({
      where: dateFilter,
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
      orderBy: { date: 'asc' },
    });

    // Format response
    const calendarDays = days.map(day => {
      const totalSlots = day.slots.length;
      const filledSlots = day.slots.reduce((sum, slot) => sum + slot.filledCount, 0);
      const totalCapacity = day.slots.reduce((sum, slot) => sum + slot.capacity, 0);

      return {
        date: format(day.date, 'yyyy-MM-dd'),
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.dayOfWeek],
        isClosed: day.isClosed,
        notes: day.notes,
        totalSlots,
        filledSlots,
        availableSlots: totalCapacity - filledSlots,
        slots: day.slots.map(slot => ({
          id: slot.id,
          sevaName: slot.sevaType.name,
          capacity: slot.capacity,
          filledCount: slot.filledCount,
          availableCount: slot.capacity - slot.filledCount,
          status: slot.status,
        })),
      };
    });

    return NextResponse.json({
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        shiftLabel: event.shiftLabel,
        timezone: event.timezone,
        startDate: format(event.startDate, 'yyyy-MM-dd'),
        endDate: format(event.endDate, 'yyyy-MM-dd'),
      },
      days: calendarDays,
    });

  } catch (error) {
    console.error('[API] Calendar error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to load calendar' },
      { status: 500 }
    );
  }
}
