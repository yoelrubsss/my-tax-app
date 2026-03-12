/**
 * Fix Ownership & Date Migration Script
 *
 * Problem:
 * 1. All transactions belong to "mock-user-id" instead of actual user "2" (Yoel)
 * 2. All transactions are dated 2024, but dashboard filters for 2026
 *
 * Solution:
 * 1. Transfer all transactions to userId = '2'
 * 2. Update all dates from 2024 → 2026 (preserve month/day)
 *
 * Run: npm run fix-ownership
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_USER_ID = '2'; // Yoel's user ID
const OLD_YEAR = 2024;
const NEW_YEAR = 2026;

async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           🔧 OWNERSHIP & DATE MIGRATION SCRIPT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n');

  try {
    // ===================================================================
    // STEP 1: Verify target user exists
    // ===================================================================
    console.log('📋 STEP 1: Verifying target user...');
    console.log('───────────────────────────────────────────────────────────────');

    const targetUser = await prisma.user.findUnique({
      where: { id: TARGET_USER_ID },
      include: {
        profile: true,
      },
    });

    if (!targetUser) {
      console.error(`❌ ERROR: Target user ID "${TARGET_USER_ID}" does not exist!`);
      console.log('   Run: npm run seed-user');
      console.log('');
      process.exit(1);
    }

    console.log(`✅ Target user found:`);
    console.log(`   ID: ${targetUser.id}`);
    console.log(`   Email: ${targetUser.email}`);
    console.log(`   Name: ${targetUser.name}`);
    console.log(`   Has Profile: ${targetUser.profile ? 'Yes' : 'No'}`);
    console.log('');

    // ===================================================================
    // STEP 2: Analyze existing transactions
    // ===================================================================
    console.log('📋 STEP 2: Analyzing existing transactions...');
    console.log('───────────────────────────────────────────────────────────────');

    const allTransactions = await prisma.transaction.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    if (allTransactions.length === 0) {
      console.log('⚠️  No transactions found in database.');
      console.log('   Nothing to migrate.');
      console.log('');
      process.exit(0);
    }

    console.log(`✅ Found ${allTransactions.length} transaction(s)\n`);

    // Group by user
    const byUser = new Map<string, number>();
    allTransactions.forEach(tx => {
      const count = byUser.get(tx.userId) || 0;
      byUser.set(tx.userId, count + 1);
    });

    console.log('   Transactions by User:');
    byUser.forEach((count, userId) => {
      const user = allTransactions.find(tx => tx.userId === userId)?.user;
      console.log(`      - User ${userId} (${user?.email || 'unknown'}): ${count} transaction(s)`);
    });
    console.log('');

    // Analyze dates
    const dates = allTransactions.map(tx => new Date(tx.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    console.log('   Date Range:');
    console.log(`      Earliest: ${minDate.toISOString().split('T')[0]}`);
    console.log(`      Latest: ${maxDate.toISOString().split('T')[0]}`);
    console.log('');

    // Count transactions that need migration
    const needsOwnershipFix = allTransactions.filter(tx => tx.userId !== TARGET_USER_ID);
    const needsDateFix = allTransactions.filter(tx => {
      const year = new Date(tx.date).getFullYear();
      return year === OLD_YEAR;
    });

    console.log('   Migration Needed:');
    console.log(`      Ownership Fix: ${needsOwnershipFix.length} transaction(s)`);
    console.log(`      Date Fix (${OLD_YEAR} → ${NEW_YEAR}): ${needsDateFix.length} transaction(s)`);
    console.log('');

    if (needsOwnershipFix.length === 0 && needsDateFix.length === 0) {
      console.log('✅ All transactions are already correct!');
      console.log('   No migration needed.');
      console.log('');
      process.exit(0);
    }

    // ===================================================================
    // STEP 3: Confirm migration
    // ===================================================================
    console.log('📋 STEP 3: Migration Plan');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`   Will update ${allTransactions.length} transaction(s):`);
    console.log(`      1. Set userId = "${TARGET_USER_ID}" for all transactions`);
    console.log(`      2. Update dates: ${OLD_YEAR} → ${NEW_YEAR} (preserve month/day)`);
    console.log('');
    console.log('   ⚠️  This operation cannot be undone!');
    console.log('   Press Ctrl+C now to cancel, or wait 3 seconds to proceed...');
    console.log('');

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ===================================================================
    // STEP 4: Perform migration
    // ===================================================================
    console.log('📋 STEP 4: Performing migration...');
    console.log('───────────────────────────────────────────────────────────────');

    let successCount = 0;
    let errorCount = 0;

    for (const transaction of allTransactions) {
      try {
        const oldDate = new Date(transaction.date);
        const oldYear = oldDate.getFullYear();
        const oldUserId = transaction.userId;

        // Calculate new date (change year from OLD_YEAR to NEW_YEAR)
        let newDate: Date;
        if (oldYear === OLD_YEAR) {
          newDate = new Date(
            NEW_YEAR,
            oldDate.getMonth(),
            oldDate.getDate(),
            oldDate.getHours(),
            oldDate.getMinutes(),
            oldDate.getSeconds()
          );
        } else {
          // Keep the date as-is if it's not from OLD_YEAR
          newDate = oldDate;
        }

        // Update transaction
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            userId: TARGET_USER_ID,
            date: newDate,
          },
        });

        const dateChanged = oldYear === OLD_YEAR;
        const ownerChanged = oldUserId !== TARGET_USER_ID;

        console.log(`   ✅ Updated transaction ${transaction.id}:`);
        if (ownerChanged) {
          console.log(`      Owner: ${oldUserId} → ${TARGET_USER_ID}`);
        }
        if (dateChanged) {
          console.log(`      Date: ${oldDate.toISOString().split('T')[0]} → ${newDate.toISOString().split('T')[0]}`);
        }
        if (!ownerChanged && !dateChanged) {
          console.log(`      (No changes needed)`);
        }

        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed to update transaction ${transaction.id}:`, error);
        errorCount++;
      }
    }

    console.log('');

    // ===================================================================
    // STEP 5: Verify migration
    // ===================================================================
    console.log('📋 STEP 5: Verifying migration...');
    console.log('───────────────────────────────────────────────────────────────');

    const updatedTransactions = await prisma.transaction.findMany({
      where: { userId: TARGET_USER_ID },
      orderBy: { date: 'desc' },
    });

    console.log(`✅ Verification complete:`);
    console.log(`   Total transactions: ${allTransactions.length}`);
    console.log(`   Successfully migrated: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Now owned by user "${TARGET_USER_ID}": ${updatedTransactions.length}`);
    console.log('');

    // Show sample of migrated transactions
    if (updatedTransactions.length > 0) {
      console.log('   📊 Sample of migrated transactions (latest 5):');
      updatedTransactions.slice(0, 5).forEach(tx => {
        const date = new Date(tx.date).toISOString().split('T')[0];
        const typeIcon = tx.type === 'INCOME' ? '💰' : '💸';
        console.log(`      ${typeIcon} ${date} | ${tx.merchant} | ₪${tx.amount.toFixed(2)}`);
      });
      console.log('');
    }

    // Calculate financial summary
    const income = updatedTransactions.filter(tx => tx.type === 'INCOME');
    const expense = updatedTransactions.filter(tx => tx.type === 'EXPENSE');
    const totalIncome = income.reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpense = expense.reduce((sum, tx) => sum + tx.amount, 0);
    const netProfit = totalIncome - totalExpense;

    console.log('   💵 Financial Summary:');
    console.log(`      Income: ${income.length} transactions, ₪${totalIncome.toFixed(2)}`);
    console.log(`      Expense: ${expense.length} transactions, ₪${totalExpense.toFixed(2)}`);
    console.log(`      Net Profit: ₪${netProfit.toFixed(2)}`);
    console.log('');

    // ===================================================================
    // FINAL REPORT
    // ===================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('           ✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('🎉 All transactions have been migrated:');
    console.log(`   ✅ Owner updated to user "${TARGET_USER_ID}" (${targetUser.name})`);
    console.log(`   ✅ Dates updated from ${OLD_YEAR} to ${NEW_YEAR}`);
    console.log('');
    console.log('Next Steps:');
    console.log('   1. Refresh your browser (F5)');
    console.log('   2. Dashboard should now show your transaction totals');
    console.log('   3. AI chat should now see your transaction history');
    console.log('   4. Month navigation should work correctly');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERROR DURING MIGRATION:', error);
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
