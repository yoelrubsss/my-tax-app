/**
 * Fix Transaction Status Script
 *
 * NOTE: The Prisma schema does NOT have a "status" field on Transaction.
 * This script simply verifies all transactions exist and are accessible.
 * In the Prisma schema, all transactions are treated as complete by default.
 *
 * Run: npm run fix-status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_USER_ID = '2'; // Yoel's user ID

async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           ✅ TRANSACTION VERIFICATION SCRIPT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n');

  try {
    // ===================================================================
    // STEP 1: Find all transactions for the target user
    // ===================================================================
    console.log('📋 STEP 1: Verifying transactions for user...');
    console.log('───────────────────────────────────────────────────────────────');

    const targetUser = await prisma.user.findUnique({
      where: { id: TARGET_USER_ID },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!targetUser) {
      console.error(`❌ ERROR: User ID "${TARGET_USER_ID}" does not exist!`);
      console.log('   Run: npm run seed-user');
      console.log('');
      process.exit(1);
    }

    console.log(`✅ Target user: ${targetUser.name} (${targetUser.email})`);
    console.log('');

    // Find all transactions for this user
    const allTransactions = await prisma.transaction.findMany({
      where: { userId: TARGET_USER_ID },
      orderBy: { date: 'desc' },
    });

    if (allTransactions.length === 0) {
      console.log('⚠️  No transactions found for this user.');
      console.log('   Upload receipts or create transactions to populate data.');
      console.log('');
      process.exit(0);
    }

    console.log(`✅ Found ${allTransactions.length} transaction(s)\n`);

    // ===================================================================
    // STEP 2: Analyze transactions
    // ===================================================================
    console.log('📋 STEP 2: Transaction Analysis');
    console.log('───────────────────────────────────────────────────────────────');

    const income = allTransactions.filter(tx => tx.type === 'INCOME');
    const expense = allTransactions.filter(tx => tx.type === 'EXPENSE');
    const totalIncome = income.reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpense = expense.reduce((sum, tx) => sum + tx.amount, 0);
    const netProfit = totalIncome - totalExpense;

    console.log('   📊 Summary:');
    console.log(`      Income: ${income.length} transactions (₪${totalIncome.toFixed(2)})`);
    console.log(`      Expense: ${expense.length} transactions (₪${totalExpense.toFixed(2)})`);
    console.log(`      Net Profit: ₪${netProfit.toFixed(2)}`);
    console.log('');

    console.log('   📝 Recent Transactions (latest 5):');
    allTransactions.slice(0, 5).forEach(tx => {
      const date = new Date(tx.date).toISOString().split('T')[0];
      const typeIcon = tx.type === 'INCOME' ? '💰' : '💸';
      console.log(`      ${typeIcon} ${date} | ${tx.merchant} | ₪${tx.amount.toFixed(2)}`);
    });
    if (allTransactions.length > 5) {
      console.log(`      ... and ${allTransactions.length - 5} more`);
    }
    console.log('');

    // ===================================================================
    // FINAL REPORT
    // ===================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('           ✅ ALL TRANSACTIONS VERIFIED!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`📊 Results: ${allTransactions.length} transactions found for user "${TARGET_USER_ID}"`);
    console.log('');
    console.log('ℹ️  NOTE: The Prisma schema does NOT have a "status" field.');
    console.log('   All transactions in the database are considered complete.');
    console.log('   There is no DRAFT/COMPLETED distinction in this schema.');
    console.log('');
    console.log('✅ All transactions should be visible on:');
    console.log('   - Dashboard (with correct totals)');
    console.log('   - AI Chat (for transaction queries)');
    console.log('   - Transaction Manager (full list)');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERROR DURING VERIFICATION:', error);
    console.log('\n');
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
