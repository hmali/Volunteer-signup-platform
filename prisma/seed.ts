import { PrismaClient } from '@prisma/client';
import { generateMonthDays } from '../src/lib/utils';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@temple.org' },
    update: {},
    create: {
      cognitoId: 'local-admin-123',
      email: 'admin@temple.org',
      name: 'Temple Administrator',
    },
  });

  console.log('✓ Created admin user:', admin.email);

  // Create sample event
  const event = await prisma.event.upsert({
    where: { publicId: 'sample-event-2026-01' },
    update: {},
    create: {
      name: 'Temple Volunteering - January 2026',
      description: 'Monthly volunteering schedule for our temple community. Join us in serving!',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      timezone: 'America/New_York',
      shiftLabel: '6:30 PM – 8:30 PM',
      publicId: 'sample-event-2026-01',
      createdById: admin.id,
    },
  });

  console.log('✓ Created event:', event.name);

  // Create seva types (NOT hard-coded - admin defined)
  const sevaTypes = [
    {
      name: 'Kitchen Seva',
      description: 'Help prepare prasad and clean kitchen after evening service. Light cooking and cleaning duties.',
      defaultCapacity: 4,
      sortOrder: 1,
      icon: '🍽️',
      color: '#3B82F6',
    },
    {
      name: 'Hall Cleaning',
      description: 'Sweep and mop the main prayer hall. Keep our sacred space clean and welcoming.',
      defaultCapacity: 3,
      sortOrder: 2,
      icon: '🧹',
      color: '#10B981',
    },
    {
      name: 'Garden Seva',
      description: 'Maintain temple gardens, water plants, and keep the outdoor spaces beautiful.',
      defaultCapacity: 3,
      sortOrder: 3,
      icon: '🌱',
      color: '#F59E0B',
    },
    {
      name: 'Office Help',
      description: 'Assist with administrative tasks, mailings, and general office support.',
      defaultCapacity: 2,
      sortOrder: 4,
      icon: '📋',
      color: '#8B5CF6',
    },
  ];

  for (const sevaData of sevaTypes) {
    const seva = await prisma.sevaType.upsert({
      where: {
        eventId_name: {
          eventId: event.id,
          name: sevaData.name,
        },
      },
      update: {},
      create: {
        ...sevaData,
        eventId: event.id,
        isActive: true,
      },
    });
    console.log(`  ✓ Created seva type: ${seva.name}`);
  }

  // Generate January 2026 schedule (excluding Thu/Fri)
  const monthStart = new Date('2026-01-01');
  const monthEnd = new Date('2026-01-31');
  const monthDays = generateMonthDays(monthStart, monthEnd, event.timezone);
  const validDays = monthDays.filter(d => !d.skip);

  console.log(`\n📅 Generating schedule for January 2026...`);
  console.log(`  Total days: ${monthDays.length}`);
  console.log(`  Valid volunteer days: ${validDays.length}`);
  console.log(`  Excluded (Thu/Fri): ${monthDays.length - validDays.length}`);

  let totalSlots = 0;
  const activeSevaTypes = await prisma.sevaType.findMany({
    where: { eventId: event.id, isActive: true },
  });

  for (const dayInfo of validDays) {
    // Check if day already exists
    const existingDay = await prisma.day.findFirst({
      where: {
        eventId: event.id,
        date: dayInfo.date,
      },
    });

    if (existingDay) {
      continue; // Skip if already created
    }

    const day = await prisma.day.create({
      data: {
        eventId: event.id,
        date: dayInfo.date,
        dayOfWeek: dayInfo.dayOfWeek,
        isClosed: false,
      },
    });

    // Create slots for each seva type
    for (const sevaType of activeSevaTypes) {
      await prisma.slot.create({
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
  }

  console.log(`✓ Created ${validDays.length} days with ${totalSlots} slots total`);

  // Create sample signups for demo purposes
  console.log('\n👥 Creating sample signups...');
  
  const sampleSignups = [
    {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1-555-0101',
      date: new Date('2026-01-03'), // Saturday
      sevaName: 'Kitchen Seva',
    },
    {
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      phone: '+1-555-0102',
      date: new Date('2026-01-03'),
      sevaName: 'Hall Cleaning',
    },
    {
      name: 'Bob Johnson',
      email: 'bob.johnson@example.com',
      phone: '+1-555-0103',
      date: new Date('2026-01-05'), // Monday
      sevaName: 'Kitchen Seva',
    },
    {
      name: 'Alice Williams',
      email: 'alice.williams@example.com',
      phone: '+1-555-0104',
      date: new Date('2026-01-05'),
      sevaName: 'Garden Seva',
    },
  ];

  for (const signupData of sampleSignups) {
    const crypto = await import('crypto');
    
    // Find the slot
    const day = await prisma.day.findFirst({
      where: {
        eventId: event.id,
        date: signupData.date,
      },
    });

    if (!day) continue;

    const sevaType = await prisma.sevaType.findFirst({
      where: {
        eventId: event.id,
        name: signupData.sevaName,
      },
    });

    if (!sevaType) continue;

    const slot = await prisma.slot.findFirst({
      where: {
        dayId: day.id,
        sevaTypeId: sevaType.id,
      },
    });

    if (!slot) continue;

    // Create signup
    const cancelToken = crypto.randomBytes(32).toString('hex');
    const cancelTokenHash = crypto.createHash('sha256').update(cancelToken).digest('hex');

    const signup = await prisma.signup.create({
      data: {
        slotId: slot.id,
        name: signupData.name,
        email: signupData.email,
        phone: signupData.phone,
        cancelToken,
        cancelTokenHash,
        status: 'CONFIRMED',
      },
    });

    // Update slot filled count
    await prisma.slot.update({
      where: { id: slot.id },
      data: { filledCount: { increment: 1 } },
    });

    console.log(`  ✓ ${signup.name} → ${sevaType.name} on ${signupData.date.toISOString().substring(0, 10)}`);
  }

  console.log('\n✅ Seed completed!');
  console.log(`\nPublic signup URL: http://localhost:3000/signup/${event.publicId}`);
  console.log(`Admin dashboard: http://localhost:3000/admin`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
