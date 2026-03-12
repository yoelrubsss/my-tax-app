/**
 * CLEAR TRANSACTIONS
 *
 * This script DELETES ALL transactions for User ID "2" (Yoel).
 *
 * ⚠️  WARNING: This is a DESTRUCTIVE operation!
 * - Deletes ALL Transaction records where userId = "2"
 * - Does NOT delete the User or UserProfile
 * - Cannot be undone
 *
 * Usage: npm run clear-transactions
 */

import { prisma } from "../lib/prisma";

const TARGET_USER_ID = "2";

async function clearTransactions() {
  try {
    console.log("=" .repeat(80));
    console.log("🗑️  CLEAR TRANSACTIONS FOR USER ID:", TARGET_USER_ID);
    console.log("=" .repeat(80));
    console.log("");

    // Step 1: Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: TARGET_USER_ID },
      include: { profile: true },
    });

    if (!user) {
      console.error(`❌ User with ID "${TARGET_USER_ID}" not found!`);
      console.error("   Cannot proceed without a valid user.");
      process.exit(1);
    }

    console.log(`✅ User Found: ${user.name} (${user.email})`);
    if (user.profile) {
      console.log(`   Business: ${user.profile.businessName || 'N/A'}`);
    }
    console.log("");

    // Step 2: Count existing transactions
    const transactionCount = await prisma.transaction.count({
      where: { userId: TARGET_USER_ID },
    });

    if (transactionCount === 0) {
      console.log("✅ No transactions found. Nothing to delete.");
      console.log("");
      process.exit(0);
    }

    console.log(`📊 Found ${transactionCount} transaction(s) to delete.`);
    console.log("");

    // Step 3: Show a preview of what will be deleted
    const sampleTransactions = await prisma.transaction.findMany({
      where: { userId: TARGET_USER_ID },
      orderBy: { date: 'desc' },
      take: 5,
    });

    console.log("📋 Preview (first 5 transactions):");
    sampleTransactions.forEach((tx) => {
      console.log(
        `   - ID ${tx.id}: ${tx.date.toISOString().split('T')[0]} | ${tx.merchant || tx.description} | ₪${tx.amount.toFixed(2)}`
      );
    });
    if (transactionCount > 5) {
      console.log(`   ... and ${transactionCount - 5} more`);
    }
    console.log("");

    // Step 4: Confirm deletion (safety check)
    console.log("⚠️  WARNING: This will DELETE ALL transactions for this user!");
    console.log("⚠️  This action CANNOT be undone!");
    console.log("");
    console.log("   To proceed, set CONFIRM_DELETE=true in the script.");
    console.log("");

    // Safety mechanism: Require explicit confirmation
    const CONFIRM_DELETE = process.env.CONFIRM_DELETE === "true";

    if (!CONFIRM_DELETE) {
      console.log("❌ Deletion NOT confirmed. Exiting safely.");
      console.log("   To delete, run: CONFIRM_DELETE=true npm run clear-transactions");
      console.log("");
      process.exit(0);
    }

    // Step 5: Perform deletion
    console.log("🗑️  Deleting transactions...");
    console.log("");

    const deleteResult = await prisma.transaction.deleteMany({
      where: { userId: TARGET_USER_ID },
    });

    console.log(`✅ Deleted ${deleteResult.count} transaction(s) successfully!`);
    console.log("");

    // Step 6: Verify deletion
    const remainingCount = await prisma.transaction.count({
      where: { userId: TARGET_USER_ID },
    });

    if (remainingCount === 0) {
      console.log("✅ Verification: All transactions deleted. Database is clean.");
    } else {
      console.warn(`⚠️  Warning: ${remainingCount} transaction(s) still remain!`);
    }

    console.log("");

    // Step 7: Verify user and profile still exist
    const userCheck = await prisma.user.findUnique({
      where: { id: TARGET_USER_ID },
      include: { profile: true },
    });

    if (userCheck) {
      console.log("✅ User and Profile remain intact:");
      console.log(`   - User: ${userCheck.name} (${userCheck.email})`);
      console.log(`   - Profile: ${userCheck.profile ? 'Exists' : 'Not Found'}`);
    } else {
      console.error("❌ ERROR: User was deleted! This should not happen!");
    }

    console.log("");
    console.log("✅ Script completed successfully.");
    console.log("");

  } catch (error) {
    console.error("❌ Error clearing transactions:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearTransactions();
