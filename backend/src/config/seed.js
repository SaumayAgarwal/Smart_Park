const bcrypt = require('bcryptjs');
const { prisma } = require('./db');

async function seedDatabase() {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log('Database already contains records. Skipping seed.');
      return;
    }

    console.log('Seeding initial SmartPark data...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Seed Sample Owner
    const owner = await prisma.user.create({
      data: {
        name: 'Rajesh Kumar (Owner)',
        email: 'owner@smartpark.com',
        password: hashedPassword,
        phone: '+91 98765 43210',
        role: 'OWNER',
        enabled: true,
      },
    });

    // 2. Seed Sample Driver
    const driver = await prisma.user.create({
      data: {
        name: 'Vikram Singh (Driver)',
        email: 'driver@smartpark.com',
        password: hashedPassword,
        phone: '+91 91234 56789',
        role: 'DRIVER',
        enabled: true,
      },
    });

    // 3. Seed Sample Spots
    const spot1 = await prisma.parkingSpot.create({
      data: {
        ownerId: owner.id,
        title: 'Connaught Place Premium Garage',
        address: 'Block A, Inner Circle, Connaught Place',
        city: 'New Delhi',
        latitude: 28.6315,
        longitude: 77.2167,
        pricePerHour: 50.0,
        peakPricePerHour: 80.0,
        capacity: 10,
        covered: true,
        securityAvailable: true,
        evChargingAvailable: true,
        operatingHours: 'Mon-Sun 24 Hours',
        imageUrl: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=600&q=80',
        status: 'AVAILABLE',
      },
    });

    const spot2 = await prisma.parkingSpot.create({
      data: {
        ownerId: owner.id,
        title: 'Bandra West Private Driveway',
        address: 'Hill Road, Bandra West',
        city: 'Mumbai',
        latitude: 19.0544,
        longitude: 72.8406,
        pricePerHour: 60.0,
        peakPricePerHour: 100.0,
        capacity: 4,
        covered: false,
        securityAvailable: true,
        evChargingAvailable: false,
        operatingHours: 'Mon-Fri 8:00 AM - 10:00 PM',
        imageUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=600&q=80',
        status: 'AVAILABLE',
      },
    });

    // 4. Seed Sample Booking
    const now = new Date();
    const endTime = new Date(now.getTime() + 3 * 3600000);

    await prisma.booking.create({
      data: {
        userId: driver.id,
        parkingSpotId: spot1.id,
        startTime: now,
        endTime: endTime,
        amount: 150.0,
        status: 'CONFIRMED',
        bookingReference: 'BKG-SP8821',
        qrCode: 'QR-SECURE-8821',
        vehicleNumber: 'DL 01 AB 1234',
        vehicleType: 'SUV',
      },
    });

    console.log('Database seeded successfully!');
  } catch (err) {
    console.warn('Seed notice:', err.message);
  }
}

module.exports = { seedDatabase };

if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}
