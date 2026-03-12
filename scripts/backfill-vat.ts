/**
 * 🔧 VAT Backfill Script
 *
 * One-time maintenance script to recalculate recognizedVatAmount for all existing transactions.
 * This script implements Israeli tax law compliance by applying category-based VAT recognition rules.
 *
 * What it does:
 * 1. Fetches all EXPENSE transactions from Prisma database
 * 2. Looks up each transaction's category in tax-knowledge.ts
 * 3. Calculates: recognizedVatAmount = vatAmount × category.vatPercentage
 * 4. Updates the transaction in the database
 * 5. Provides detailed logging and summary
 *
 * Usage:
 *   npm run backfill-vat
 *
 * Last Updated: 2026-03-08
 */

import { prisma } from '../lib/prisma';
import { getCategoryById } from '../lib/tax-knowledge';

interface UpdateStats {
  totalTransactions: number;
  expenseCount: number;
  incomeCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  totalVatBefore: number;
  totalVatAfter: number;
}

async function backfillRecognizedVat() {
  console.log('🔧 Starting VAT Backfill Script...\n');
  console.log('📊 This script will recalculate recognizedVatAmount for all transactions');
  console.log('   based on Israeli tax law category rules.\n');

  const stats: UpdateStats = {
    totalTransactions: 0,
    expenseCount: 0,
    incomeCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    totalVatBefore: 0,
    totalVatAfter: 0,
  };

  try {
    // Step 1: Fetch all transactions
    console.log('📥 Fetching all transactions from database...');
    const allTransactions = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
    });

    stats.totalTransactions = allTransactions.length;
    console.log(`✅ Found ${stats.totalTransactions} transaction(s)\n`);

    if (stats.totalTransactions === 0) {
      console.log('⚠️  No transactions found. Nothing to update.');
      return;
    }

    // Step 2: Process each transaction
    console.log('🔄 Processing transactions...\n');

    for (const transaction of allTransactions) {
      try {
        const txId = transaction.id.substring(0, 8); // Short ID for logging

        // Count transaction types
        if (transaction.type === 'INCOME') {
          stats.incomeCount++;
        } else if (transaction.type === 'EXPENSE') {
          stats.expenseCount++;
        }

        // INCOME transactions: Always 100% recognized
        if (transaction.type === 'INCOME') {
          const recognizedVat = transaction.vatAmount;

          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { recognizedVatAmount: recognizedVat },
          });

          stats.updatedCount++;
          stats.totalVatBefore += transaction.vatAmount;
          stats.totalVatAfter += recognizedVat;

          console.log(
            `✅ [${txId}] INCOME - ${transaction.merchant} | ` +
            `Recognized: ₪${recognizedVat.toFixed(2)} (100%)`
          );
          continue;
        }

        // EXPENSE transactions: Apply category rules
        if (transaction.type === 'EXPENSE') {
          // Look up category
          const taxCategory = getCategoryById(transaction.category);

          if (!taxCategory) {
            console.warn(
              `⚠️  [${txId}] EXPENSE - ${transaction.merchant} | ` +
              `Unknown category "${transaction.category}" - Using 100% recognition`
            );

            // Default to 100% if category not found
            const recognizedVat = transaction.vatAmount;

            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { recognizedVatAmount: recognizedVat },
            });

            stats.updatedCount++;
            stats.totalVatBefore += transaction.vatAmount;
            stats.totalVatAfter += recognizedVat;
            continue;
          }

          // Calculate recognized VAT based on category rules
          const vatPercentage = taxCategory.vatPercentage;
          const recognizedVat = transaction.vatAmount * vatPercentage;
          const recognitionPercent = (vatPercentage * 100).toFixed(0);

          // Update database
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { recognizedVatAmount: parseFloat(recognizedVat.toFixed(2)) },
          });

          stats.updatedCount++;
          stats.totalVatBefore += transaction.vatAmount;
          stats.totalVatAfter += recognizedVat;

          // Log with color coding
          const vatDiff = transaction.vatAmount - recognizedVat;
          const hasReduction = vatDiff > 0.01; // More than 1 agora difference

          if (hasReduction) {
            console.log(
              `🟡 [${txId}] EXPENSE - ${transaction.merchant.padEnd(30)} | ` +
              `Category: ${taxCategory.label.padEnd(20)} | ` +
              `Total VAT: ₪${transaction.vatAmount.toFixed(2).padStart(7)} → ` +
              `Recognized: ₪${recognizedVat.toFixed(2).padStart(7)} (${recognitionPercent}% מוכר) ` +
              `[-₪${vatDiff.toFixed(2)}]`
            );
          } else {
            console.log(
              `✅ [${txId}] EXPENSE - ${transaction.merchant.padEnd(30)} | ` +
              `Category: ${taxCategory.label.padEnd(20)} | ` +
              `Recognized: ₪${recognizedVat.toFixed(2).padStart(7)} (${recognitionPercent}%)`
            );
          }
        }

      } catch (error: any) {
        stats.errorCount++;
        console.error(
          `❌ Error processing transaction ${transaction.id}:`,
          error.message
        );
      }
    }

    // Step 3: Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Transactions Processed: ${stats.totalTransactions}`);
    console.log(`  ├─ Income Transactions:     ${stats.incomeCount}`);
    console.log(`  ├─ Expense Transactions:    ${stats.expenseCount}`);
    console.log(`  ├─ Successfully Updated:    ${stats.updatedCount} ✅`);
    console.log(`  ├─ Skipped:                 ${stats.skippedCount}`);
    console.log(`  └─ Errors:                  ${stats.errorCount} ${stats.errorCount > 0 ? '❌' : ''}`);
    console.log('');
    console.log('💰 VAT TOTALS (Expenses Only):');
    console.log(`  ├─ Total VAT Before (Receipts):  ₪${stats.totalVatBefore.toFixed(2)}`);
    console.log(`  ├─ Recognized VAT After (Rules): ₪${stats.totalVatAfter.toFixed(2)}`);

    const vatSavings = stats.totalVatBefore - stats.totalVatAfter;
    if (vatSavings > 0.01) {
      console.log(`  └─ Adjustment Applied:           -₪${vatSavings.toFixed(2)} 🔻`);
      console.log('');
      console.log('⚠️  IMPORTANT: Your claimable VAT has been reduced by category rules.');
      console.log('   This ensures compliance with Israeli tax law (vehicle 2/3 rule, etc.)');
    } else {
      console.log(`  └─ No Adjustment Needed:         ₪0.00`);
      console.log('');
      console.log('✅ All transactions already had 100% VAT recognition.');
    }

    console.log('='.repeat(80));
    console.log('');
    console.log('✅ Backfill completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Restart your dev server: npm run dev');
    console.log('  2. Check the dashboard - VAT totals should now be accurate');
    console.log('  3. Review the transaction list - you should see both VAT columns');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ CRITICAL ERROR during backfill:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Disconnect from database
    await prisma.$disconnect();
  }
}

// Run the script
backfillRecognizedVat()
  .then(() => {
    console.log('👋 Script finished. Goodbye!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
