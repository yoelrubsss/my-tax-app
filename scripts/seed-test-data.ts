/**
 * Seed script to populate the database with test data
 * Run with: npm run seed-test-data
 */

import { prisma } from '../lib/prisma';

async function main() {
  console.log('Starting database seed...');

  // Create a test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      id: 'mock-user-id',
      email: 'test@example.com',
      name: 'יוסי כהן',
      password: 'hashed_password_here', // In production, use bcrypt
    },
  });

  console.log('✓ Created/found user:', user.email);

  // Create user profile
  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      businessName: 'כהן ייעוץ ופיתוח',
      businessType: 'OSER_MURSHE',
      isHomeOffice: true,
      hasChildren: true,
      childrenCount: 2,
      standardWorkDay: 9,
    },
  });

  console.log('✓ Created user profile');

  // Create sample transactions
  const transactions = [
    {
      userId: user.id,
      date: new Date('2024-01-15'),
      merchant: 'דלק',
      description: 'תדלוק רכב',
      amount: 300,
      vatRate: 0.17,
      vatAmount: 43.59,
      netAmount: 256.41,
      category: 'vehicle-fuel',
      type: 'EXPENSE',
      isRecognized: true,
    },
    {
      userId: user.id,
      date: new Date('2024-01-20'),
      merchant: 'אופיס דיפו',
      description: 'ציוד משרדי',
      amount: 450,
      vatRate: 0.17,
      vatAmount: 65.38,
      netAmount: 384.62,
      category: 'office-equipment',
      type: 'EXPENSE',
      isRecognized: true,
    },
    {
      userId: user.id,
      date: new Date('2024-01-25'),
      merchant: 'מסעדת טאבולה',
      description: 'ארוחת צהריים',
      amount: 180,
      vatRate: 0.17,
      vatAmount: 26.15,
      netAmount: 153.85,
      category: 'restaurant',
      type: 'EXPENSE',
      isRecognized: false,
    },
    {
      userId: user.id,
      date: new Date('2024-02-01'),
      merchant: 'חברת החשמל',
      description: 'חשבון חשמל למשרד הביתי',
      amount: 250,
      vatRate: 0.17,
      vatAmount: 36.32,
      netAmount: 213.68,
      category: 'home-office',
      type: 'EXPENSE',
      isRecognized: true,
    },
    {
      userId: user.id,
      date: new Date('2024-02-05'),
      merchant: 'לקוח ABC בע"מ',
      description: 'שירותי ייעוץ - חודש ינואר',
      amount: 5000,
      vatRate: 0.17,
      vatAmount: 726.50,
      netAmount: 4273.50,
      category: 'professional-services',
      type: 'INCOME',
      isRecognized: true,
    },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({ data: tx });
  }

  console.log(`✓ Created ${transactions.length} sample transactions`);

  // Create sample chat messages
  const chatMessages = [
    {
      userId: user.id,
      role: 'user',
      content: 'האם אני יכול לקזז מע"מ על הוצאות רכב?',
    },
    {
      userId: user.id,
      role: 'assistant',
      content: 'כן, כעוסק מורשה אתה יכול לקזז 66.67% (2/3) מהמע"מ על הוצאות רכב אם הרכב משמש בעיקר לעסק.',
    },
    {
      userId: user.id,
      role: 'user',
      content: 'מה לגבי הוצאות משרד ביתי?',
    },
    {
      userId: user.id,
      role: 'assistant',
      content: 'הוצאות משרד ביתי מוכרות באופן יחסי. בדרך כלל אם חדר אחד משמש למשרד, ניתן להכיר בכ-20-25% מהוצאות החשמל והארנונה.',
    },
  ];

  for (const msg of chatMessages) {
    await prisma.chatMessage.create({ data: msg });
  }

  console.log(`✓ Created ${chatMessages.length} sample chat messages`);

  console.log('\n✅ Database seeded successfully!');
  console.log('\nTest User Details:');
  console.log('- ID:', user.id);
  console.log('- Email:', user.email);
  console.log('- Name:', user.name);
  console.log('- Business Type:', profile.businessType);
  console.log('- Has Home Office:', profile.isHomeOffice);
  console.log('- Children:', profile.childrenCount);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
