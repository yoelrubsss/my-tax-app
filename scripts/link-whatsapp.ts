/**
 * Utility script to link WhatsApp phone numbers to user accounts
 *
 * Usage:
 *   tsx scripts/link-whatsapp.ts user@example.com 972501234567
 */

import { prisma } from "../lib/prisma";

async function linkWhatsAppToUser(email: string, whatsappPhone: string) {
  try {
    console.log(`🔗 Linking WhatsApp ${whatsappPhone} to user ${email}...`);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    // Validate phone format (should be country code + number, no + or spaces)
    if (!/^\d{10,15}$/.test(whatsappPhone)) {
      console.error(`❌ Invalid phone format: ${whatsappPhone}`);
      console.log("   Format should be: 972501234567 (country code + number)");
      process.exit(1);
    }

    // Check if phone is already linked to another user
    const existingUser = await prisma.user.findFirst({
      where: {
        whatsappPhone,
        NOT: { id: user.id }
      },
    });

    if (existingUser) {
      console.error(`❌ WhatsApp number already linked to: ${existingUser.email}`);
      process.exit(1);
    }

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: { whatsappPhone },
    });

    console.log(`✅ Successfully linked WhatsApp ${whatsappPhone} to ${email}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   User can now send receipt images via WhatsApp!`);

  } catch (error) {
    console.error("❌ Error linking WhatsApp:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.log("Usage: tsx scripts/link-whatsapp.ts <email> <whatsapp_phone>");
  console.log("Example: tsx scripts/link-whatsapp.ts user@example.com 972501234567");
  process.exit(1);
}

const [email, whatsappPhone] = args;
linkWhatsAppToUser(email, whatsappPhone);
