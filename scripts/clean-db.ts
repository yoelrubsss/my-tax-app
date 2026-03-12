import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanDatabase() {
  try {
    console.log("🧹 Starting database cleanup...");

    // Delete all transactions
    const deletedTransactions = await prisma.transaction.deleteMany({});
    console.log(`✅ Deleted ${deletedTransactions.count} transactions`);

    // Delete all chat history
    const deletedChats = await prisma.chatMessage.deleteMany({});
    console.log(`✅ Deleted ${deletedChats.count} chat messages`);

    console.log("\n🎉 Database cleaned! Ready for real users.");
  } catch (error) {
    console.error("❌ Error cleaning database:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
