/**
 * Quick setup script to link WhatsApp to the first user account
 */

import { prisma } from "../lib/prisma";

async function setupWhatsApp() {
  try {
    console.log("🔍 Finding user accounts...");

    // List all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        whatsappPhone: true,
      },
    });

    if (users.length === 0) {
      console.error("❌ No users found in database");
      console.log("   Run: npm run seed-user");
      process.exit(1);
    }

    console.log(`\n📋 Found ${users.length} user(s):\n`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name || "No name"})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   WhatsApp: ${user.whatsappPhone || "Not linked"}\n`);
    });

    // Use first user for WhatsApp linking
    const firstUser = users[0];

    // Your WhatsApp test number (from Meta dashboard test numbers)
    // Format: country code + number (no + or spaces)
    const whatsappPhone = "15550899566"; // Meta's test number

    console.log(`🔗 Linking WhatsApp to: ${firstUser.email}`);
    console.log(`   WhatsApp number: +${whatsappPhone}`);

    await prisma.user.update({
      where: { id: firstUser.id },
      data: { whatsappPhone },
    });

    console.log(`\n✅ WhatsApp linked successfully!`);
    console.log(`\n📱 Next steps:`);
    console.log(`   1. Open Prisma Studio: npx prisma studio`);
    console.log(`   2. Update whatsappPhone field with YOUR actual number`);
    console.log(`   3. Format: 972501234567 (country code + number, no + or spaces)`);
    console.log(`\n🧪 Test the webhook:`);
    console.log(`   1. Start dev server: npm run dev`);
    console.log(`   2. Start ngrok: ngrok http 3000`);
    console.log(`   3. Set webhook URL in Meta dashboard to: https://your-ngrok-url.ngrok.io/api/webhook/whatsapp`);
    console.log(`   4. Send an image via WhatsApp`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupWhatsApp();
