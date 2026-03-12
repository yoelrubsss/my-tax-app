import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Seeding user for Prisma database...');
    console.log('');

    // CRITICAL FIX: The JWT stores numeric user IDs (from better-sqlite3 database)
    // But Prisma expects String IDs. We need to create User records for all possible
    // session IDs that might be stored in JWTs.

    // Common user IDs from the legacy better-sqlite3 database
    const userIds = ['1', '2', '3']; // Convert to strings for Prisma

    for (const userId of userIds) {
      console.log(`Checking user ID: ${userId}...`);

      const user = await prisma.user.upsert({
        where: { id: userId },
        update: {
          // Update name if needed
          name: userId === '2' ? 'Yoel' : `User ${userId}`,
        },
        create: {
          id: userId,
          email: userId === '2' ? 'demo@example.com' : `user${userId}@example.com`,
          name: userId === '2' ? 'Yoel' : `User ${userId}`,
          password: '$2a$10$dummyHashForDemoUserNotForProduction', // Dummy hash
        },
      });

      console.log(`✅ User ${userId} synced:`, user.email);

      // Ensure UserProfile exists for this user
      let profile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        profile = await prisma.userProfile.create({
          data: {
            userId: user.id,
            businessName: userId === '2' ? 'העסק של יואל' : `עסק ${userId}`,
            businessType: 'OSEK_MURSHE',
            isHomeOffice: false,
            hasChildren: false,
            childrenCount: 0,
            hasVehicle: false,
          },
        });
        console.log(`   ✅ UserProfile created for user ${userId}`);
      } else {
        console.log(`   ✅ UserProfile already exists for user ${userId}`);
      }

      console.log('');
    }

    console.log('🎉 Seeding completed successfully!');
    console.log('');
    console.log('You can now:');
    console.log('  1. Go to /settings and save your profile');
    console.log('  2. Use the AI chat to ask about transactions');
    console.log('  3. Navigate between months without errors');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
