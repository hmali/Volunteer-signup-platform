/**
 * Race Condition Test for Capacity Enforcement
 * 
 * Tests that two volunteers attempting to signup for the last available slot
 * will correctly result in one success and one failure (no overbooking).
 */

import { PrismaClient } from '@prisma/client';
import { createSignup, SignupError } from '../lib/signup';

const prisma = new PrismaClient();

describe('Capacity Enforcement - Race Condition Test', () => {
  let eventId: string;
  let sevaTypeId: string;
  let slotId: string;

  beforeAll(async () => {
    // Create test event
    const event = await prisma.event.create({
      data: {
        name: 'Test Event',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
        timezone: 'America/New_York',
        shiftLabel: '6:00 PM – 8:00 PM',
        createdById: 'test-admin',
      },
    });
    eventId = event.id;

    // Create seva type
    const sevaType = await prisma.sevaType.create({
      data: {
        eventId,
        name: 'Test Seva',
        defaultCapacity: 2, // Only 2 spots
        isActive: true,
        sortOrder: 1,
      },
    });
    sevaTypeId = sevaType.id;

    // Create day
    const day = await prisma.day.create({
      data: {
        eventId,
        date: new Date('2026-06-07'), // Saturday
        dayOfWeek: 6,
        isClosed: false,
      },
    });

    // Create slot with capacity of 2
    const slot = await prisma.slot.create({
      data: {
        dayId: day.id,
        sevaTypeId,
        capacity: 2,
        filledCount: 0,
        status: 'ACTIVE',
      },
    });
    slotId = slot.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.signup.deleteMany({ where: { slot: { dayId: { in: await prisma.day.findMany({ where: { eventId } }).then(d => d.map(x => x.id)) } } } });
    await prisma.slot.deleteMany({ where: { sevaTypeId } });
    await prisma.day.deleteMany({ where: { eventId } });
    await prisma.sevaType.deleteMany({ where: { eventId } });
    await prisma.event.delete({ where: { id: eventId } });
    await prisma.$disconnect();
  });

  test('First signup should succeed', async () => {
    const signup = await createSignup(slotId, {
      name: 'Alice',
      email: 'alice@test.com',
    });

    expect(signup).toBeDefined();
    expect(signup.name).toBe('Alice');
    expect(signup.email).toBe('alice@test.com');
    expect(signup.status).toBe('CONFIRMED');

    // Verify slot updated
    const slot = await prisma.slot.findUnique({ where: { id: slotId } });
    expect(slot?.filledCount).toBe(1);
  });

  test('Second signup should succeed (2/2 capacity)', async () => {
    const signup = await createSignup(slotId, {
      name: 'Bob',
      email: 'bob@test.com',
    });

    expect(signup).toBeDefined();
    expect(signup.name).toBe('Bob');
    expect(signup.status).toBe('CONFIRMED');

    // Verify slot updated and marked FULL
    const slot = await prisma.slot.findUnique({ where: { id: slotId } });
    expect(slot?.filledCount).toBe(2);
    expect(slot?.status).toBe('FULL');
  });

  test('Third signup should fail (capacity exceeded)', async () => {
    await expect(
      createSignup(slotId, {
        name: 'Charlie',
        email: 'charlie@test.com',
      })
    ).rejects.toThrow(SignupError);

    await expect(
      createSignup(slotId, {
        name: 'Charlie',
        email: 'charlie@test.com',
      })
    ).rejects.toThrow('full');

    // Verify slot still at capacity
    const slot = await prisma.slot.findUnique({ where: { id: slotId } });
    expect(slot?.filledCount).toBe(2);
  });

  test('RACE CONDITION: Concurrent signups should not exceed capacity', async () => {
    // Create a new slot for this test
    const day = await prisma.day.findFirst({ where: { eventId } });
    const newSlot = await prisma.slot.create({
      data: {
        dayId: day!.id,
        sevaTypeId,
        capacity: 1, // Only 1 spot!
        filledCount: 0,
        status: 'ACTIVE',
      },
    });

    // Attempt 3 concurrent signups for 1 spot
    const signupPromises = [
      createSignup(newSlot.id, { name: 'User1', email: 'user1@test.com' }),
      createSignup(newSlot.id, { name: 'User2', email: 'user2@test.com' }),
      createSignup(newSlot.id, { name: 'User3', email: 'user3@test.com' }),
    ];

    // Wait for all to complete
    const results = await Promise.allSettled(signupPromises);

    // Count successes and failures
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    // Exactly 1 should succeed, 2 should fail
    expect(successes).toBe(1);
    expect(failures).toBe(2);

    // Verify database state
    const finalSlot = await prisma.slot.findUnique({ where: { id: newSlot.id } });
    expect(finalSlot?.filledCount).toBe(1); // NOT 2 or 3!
    expect(finalSlot?.status).toBe('FULL');

    const signupCount = await prisma.signup.count({
      where: { slotId: newSlot.id, status: 'CONFIRMED' },
    });
    expect(signupCount).toBe(1); // Only 1 signup created

    // Cleanup
    await prisma.signup.deleteMany({ where: { slotId: newSlot.id } });
    await prisma.slot.delete({ where: { id: newSlot.id } });
  });

  test('Duplicate email should be rejected', async () => {
    // Create a new slot
    const day = await prisma.day.findFirst({ where: { eventId } });
    const newSlot = await prisma.slot.create({
      data: {
        dayId: day!.id,
        sevaTypeId,
        capacity: 5,
        filledCount: 0,
        status: 'ACTIVE',
      },
    });

    // First signup
    await createSignup(newSlot.id, {
      name: 'David',
      email: 'david@test.com',
    });

    // Second signup with same email should fail
    await expect(
      createSignup(newSlot.id, {
        name: 'David Again',
        email: 'david@test.com',
      })
    ).rejects.toThrow('already signed up');

    // Cleanup
    await prisma.signup.deleteMany({ where: { slotId: newSlot.id } });
    await prisma.slot.delete({ where: { id: newSlot.id } });
  });
});
