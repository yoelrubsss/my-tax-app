/**
 * LIST MY TRANSACTIONS
 *
 * This script fetches and displays all transactions for User ID "2" (Yoel)
 * in a clean, readable table format.
 *
 * Usage: npm run list-my-transactions
 */

import { prisma } from "../lib/prisma";

const TARGET_USER_ID = "2";

async function listMyTransactions() {
  try {
    console.log("=" .repeat(80));
    console.log("📋 LISTING ALL TRANSACTIONS FOR USER ID:", TARGET_USER_ID);
    console.log("=" .repeat(80));
    console.log("");

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: TARGET_USER_ID },
      include: { profile: true },
    });

    if (!user) {
      console.error(`❌ User with ID "${TARGET_USER_ID}" not found!`);
      process.exit(1);
    }

    console.log(`✅ User Found: ${user.name} (${user.email})`);
    if (user.profile) {
      console.log(`   Business: ${user.profile.businessName || 'N/A'}`);
    }
    console.log("");

    // Fetch all transactions for this user
    const transactions = await prisma.transaction.findMany({
      where: { userId: TARGET_USER_ID },
      orderBy: { date: 'desc' },
    });

    if (transactions.length === 0) {
      console.log("✅ No transactions found. Database is clean for this user.");
      console.log("");
      process.exit(0);
    }

    console.log(`📊 Found ${transactions.length} transaction(s):`);
    console.log("");

    // Print table header
    console.log("-".repeat(120));
    console.log(
      "ID".padEnd(6) +
      "Date".padEnd(12) +
      "Merchant/Description".padEnd(35) +
      "Amount".padEnd(12) +
      "Category".padEnd(20) +
      "Receipt".padEnd(10) +
      "Status"
    );
    console.log("-".repeat(120));

    // Print each transaction
    let totalAmount = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let draftCount = 0;
    let completedCount = 0;

    transactions.forEach((tx) => {
      // Determine status using "Money Talks" rule
      const status = tx.amount === 0 ? "DRAFT" : "COMPLETED";

      // Format fields
      const id = String(tx.id).padEnd(6);
      const date = tx.date.toISOString().split('T')[0].padEnd(12);
      const merchant = (tx.merchant || tx.description || 'N/A').substring(0, 33).padEnd(35);
      const amount = `₪${tx.amount.toFixed(2)}`.padEnd(12);
      const category = (tx.category || 'N/A').substring(0, 18).padEnd(20);
      const hasReceipt = (tx.receiptUrl ? "Yes" : "No").padEnd(10);
      const statusStr = status;

      console.log(id + date + merchant + amount + category + hasReceipt + statusStr);

      // Accumulate stats
      totalAmount += tx.amount;
      if (tx.type === 'INCOME') incomeCount++;
      if (tx.type === 'EXPENSE') expenseCount++;
      if (status === 'DRAFT') draftCount++;
      if (status === 'COMPLETED') completedCount++;
    });

    console.log("-".repeat(120));
    console.log("");

    // Print summary
    console.log("📊 SUMMARY:");
    console.log(`   Total Transactions: ${transactions.length}`);
    console.log(`   - Income: ${incomeCount}`);
    console.log(`   - Expenses: ${expenseCount}`);
    console.log(`   - Drafts: ${draftCount}`);
    console.log(`   - Completed: ${completedCount}`);
    console.log(`   Total Amount: ₪${totalAmount.toFixed(2)}`);
    console.log("");

    // Print date range
    if (transactions.length > 0) {
      const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());
      const earliest = dates[0].toISOString().split('T')[0];
      const latest = dates[dates.length - 1].toISOString().split('T')[0];
      console.log(`📅 Date Range: ${earliest} to ${latest}`);
      console.log("");
    }

    // Highlight potential ghost data
    const ghostCandidates = transactions.filter(
      t => t.merchant === 'Draft Transaction' || t.description === 'Draft Transaction' || t.amount === 0
    );

    if (ghostCandidates.length > 0) {
      console.log("⚠️  POTENTIAL GHOST DATA:");
      console.log(`   Found ${ghostCandidates.length} transaction(s) with placeholder or zero values`);
      console.log(`   You may want to review these and run clear-transactions if needed.`);
      console.log("");
    }

    console.log("✅ Script completed successfully.");
    console.log("");

  } catch (error) {
    console.error("❌ Error listing transactions:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
listMyTransactions();
