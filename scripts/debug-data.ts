/**
 * Database Diagnostic Script
 *
 * Purpose: Dump all data from Prisma database to diagnose why:
 * - Dashboard shows 0 data
 * - AI sees "0 transactions"
 * - Settings appear empty after refresh
 *
 * Run: npm run debug-data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           🔍 DATABASE DIAGNOSTIC REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n');

  try {
    // ===================================================================
    // 1. USERS
    // ===================================================================
    console.log('📋 SECTION 1: USERS');
    console.log('───────────────────────────────────────────────────────────────');

    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' },
    });

    if (users.length === 0) {
      console.log('❌ NO USERS FOUND!');
      console.log('   Run: npm run seed-user');
    } else {
      console.log(`✅ Found ${users.length} user(s):\n`);
      users.forEach((user, index) => {
        console.log(`   User #${index + 1}:`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Name: ${user.name || '(none)'}`);
        console.log(`      Created: ${user.createdAt.toISOString()}`);
        console.log('');
      });
    }

    // ===================================================================
    // 2. USER PROFILES
    // ===================================================================
    console.log('📋 SECTION 2: USER PROFILES');
    console.log('───────────────────────────────────────────────────────────────');

    const profiles = await prisma.userProfile.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: { userId: 'asc' },
    });

    if (profiles.length === 0) {
      console.log('❌ NO USER PROFILES FOUND!');
      console.log('   This will cause Settings page to fail.');
      console.log('   Run: npm run seed-user');
    } else {
      console.log(`✅ Found ${profiles.length} profile(s):\n`);
      profiles.forEach((profile, index) => {
        console.log(`   Profile #${index + 1}:`);
        console.log(`      User ID: ${profile.userId}`);
        console.log(`      User Email: ${profile.user.email}`);
        console.log(`      User Name: ${profile.user.name || '(none)'}`);
        console.log(`      Business Name: ${profile.businessName || '(none)'}`);
        console.log(`      Business Type: ${profile.businessType || '(none)'}`);
        console.log(`      Home Office: ${profile.isHomeOffice ? 'Yes' : 'No'}`);
        console.log(`      Has Children: ${profile.hasChildren ? 'Yes' : 'No'}`);
        console.log(`      Children Count: ${profile.childrenCount}`);
        console.log(`      Has Vehicle: ${profile.hasVehicle ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    // ===================================================================
    // 3. TRANSACTIONS
    // ===================================================================
    console.log('📋 SECTION 3: TRANSACTIONS');
    console.log('───────────────────────────────────────────────────────────────');

    const transactions = await prisma.transaction.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 50, // Limit to last 50 transactions
    });

    if (transactions.length === 0) {
      console.log('❌ NO TRANSACTIONS FOUND!');
      console.log('   This is why:');
      console.log('   - Dashboard shows ₪0.00');
      console.log('   - AI says "I don\'t have access to transactions"');
      console.log('   - TransactionManager shows "אין עסקאות להצגה"');
      console.log('');
      console.log('   🔧 SOLUTION: Upload receipts or create transactions manually.');
    } else {
      console.log(`✅ Found ${transactions.length} transaction(s):\n`);

      // Summary by type
      const income = transactions.filter(t => t.type === 'INCOME');
      const expense = transactions.filter(t => t.type === 'EXPENSE');

      console.log(`   📊 SUMMARY:`);
      console.log(`      Income: ${income.length} transaction(s)`);
      console.log(`      Expense: ${expense.length} transaction(s)`);
      console.log('');

      // Detailed list
      console.log(`   📝 DETAILED LIST (most recent ${Math.min(10, transactions.length)}):\n`);
      transactions.slice(0, 10).forEach((tx, index) => {
        const date = new Date(tx.date).toLocaleDateString('he-IL');
        const typeIcon = tx.type === 'INCOME' ? '💰' : '💸';
        console.log(`   ${typeIcon} Transaction #${index + 1}:`);
        console.log(`      ID: ${tx.id}`);
        console.log(`      User: ${tx.user.name} (${tx.user.email})`);
        console.log(`      Date: ${date}`);
        console.log(`      Type: ${tx.type}`);
        console.log(`      Merchant: ${tx.merchant}`);
        console.log(`      Description: ${tx.description || '(none)'}`);
        console.log(`      Amount: ₪${tx.amount.toFixed(2)}`);
        console.log(`      VAT Amount: ₪${tx.vatAmount.toFixed(2)}`);
        console.log(`      Net Amount: ₪${tx.netAmount.toFixed(2)}`);
        console.log(`      Category: ${tx.category || '(none)'}`);
        console.log(`      Receipt: ${tx.receiptUrl || '(none)'}`);
        console.log(`      Created: ${tx.createdAt.toISOString()}`);
        console.log('');
      });

      // Calculate totals
      const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = expense.reduce((sum, t) => sum + t.amount, 0);
      const netProfit = totalIncome - totalExpense;

      console.log('   💵 FINANCIAL SUMMARY:');
      console.log(`      Total Income: ₪${totalIncome.toFixed(2)}`);
      console.log(`      Total Expense: ₪${totalExpense.toFixed(2)}`);
      console.log(`      Net Profit: ₪${netProfit.toFixed(2)}`);
      console.log('');
    }

    // ===================================================================
    // 4. CHAT MESSAGES
    // ===================================================================
    console.log('📋 SECTION 4: CHAT MESSAGES');
    console.log('───────────────────────────────────────────────────────────────');

    const chatMessages = await prisma.chatMessage.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20, // Last 20 messages
    });

    if (chatMessages.length === 0) {
      console.log('ℹ️  No chat messages found.');
      console.log('   This is normal if you haven\'t used the AI chat yet.');
    } else {
      console.log(`✅ Found ${chatMessages.length} chat message(s):\n`);

      chatMessages.slice(0, 5).forEach((msg, index) => {
        const roleIcon = msg.role === 'user' ? '👤' : '🤖';
        const preview = msg.content.length > 100
          ? msg.content.substring(0, 100) + '...'
          : msg.content;

        console.log(`   ${roleIcon} Message #${index + 1}:`);
        console.log(`      User: ${msg.user.name} (${msg.user.email})`);
        console.log(`      Role: ${msg.role}`);
        console.log(`      Content: ${preview}`);
        console.log(`      Created: ${msg.createdAt.toISOString()}`);
        console.log('');
      });
    }

    // ===================================================================
    // 5. DIAGNOSTICS
    // ===================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('           🔍 DIAGNOSTIC RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    const issues: string[] = [];
    const warnings: string[] = [];

    if (users.length === 0) {
      issues.push('❌ CRITICAL: No users in database!');
      issues.push('   → Run: npm run seed-user');
    }

    if (profiles.length === 0) {
      issues.push('❌ CRITICAL: No user profiles in database!');
      issues.push('   → Run: npm run seed-user');
    }

    if (transactions.length === 0) {
      warnings.push('⚠️  WARNING: No transactions in database.');
      warnings.push('   → This explains why dashboard shows ₪0.00');
      warnings.push('   → This explains why AI says "no transaction history"');
      warnings.push('   → Upload receipts or create transactions to fix this.');
    }

    if (users.length > 0 && profiles.length === 0) {
      issues.push('❌ CRITICAL: Users exist but no profiles!');
      issues.push('   → Foreign key constraint will block Settings page.');
      issues.push('   → Run: npm run seed-user');
    }

    if (issues.length > 0) {
      console.log('🚨 CRITICAL ISSUES FOUND:\n');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('');
    }

    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS:\n');
      warnings.forEach(warning => console.log(`   ${warning}`));
      console.log('');
    }

    if (issues.length === 0 && warnings.length === 0) {
      console.log('✅ ALL CHECKS PASSED!');
      console.log('   Database is healthy and ready.');
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERROR DURING DIAGNOSTIC:', error);
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
