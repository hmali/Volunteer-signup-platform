import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Joi from 'joi';

const sevaSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional().allow('', null),
  defaultCapacity: Joi.number().integer().min(1).max(20).default(4),
  sortOrder: Joi.number().integer().default(0),
  icon: Joi.string().max(10).optional().allow('', null),
  color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional().allow('', null),
  isActive: Joi.boolean().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // TODO: Add admin authentication

    const { eventId } = params;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'EVENT_NOT_FOUND', message: 'Event not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { error, value } = sevaSchema.validate(body);

    if (error) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: error.details[0].message },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.sevaType.findFirst({
      where: {
        eventId,
        name: value.name,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'DUPLICATE_NAME', message: 'A seva with this name already exists' },
        { status: 409 }
      );
    }

    // Create seva type
    const sevaType = await prisma.sevaType.create({
      data: {
        eventId,
        name: value.name,
        description: value.description,
        defaultCapacity: value.defaultCapacity,
        sortOrder: value.sortOrder,
        icon: value.icon,
        color: value.color,
        isActive: value.isActive,
      },
    });

    return NextResponse.json(
      {
        sevaType: {
          id: sevaType.id,
          eventId: sevaType.eventId,
          name: sevaType.name,
          description: sevaType.description,
          defaultCapacity: sevaType.defaultCapacity,
          sortOrder: sevaType.sortOrder,
          icon: sevaType.icon,
          color: sevaType.color,
          isActive: sevaType.isActive,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[API] Create seva error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create seva type' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;

    const sevaTypes = await prisma.sevaType.findMany({
      where: { eventId },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({
      sevaTypes: sevaTypes.map(seva => ({
        id: seva.id,
        name: seva.name,
        description: seva.description,
        defaultCapacity: seva.defaultCapacity,
        sortOrder: seva.sortOrder,
        icon: seva.icon,
        color: seva.color,
        isActive: seva.isActive,
      })),
    });

  } catch (error) {
    console.error('[API] List sevas error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to list seva types' },
      { status: 500 }
    );
  }
}
