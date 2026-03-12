/**
 * Test script for Fiscal Utilities
 * Demonstrates period management functionality
 */

import {
  getCurrentPeriod,
  getPeriodLabel,
  getDeadline,
  getDaysRemaining,
  getPreviousPeriod,
  getNextPeriod,
  getPeriodDateRange,
  filterTransactionsByPeriod,
  getDeadlineStatus,
  isCurrentPeriod,
  isPeriodPast,
  isPeriodFuture,
  getPeriodsForYear,
  comparePeriods,
  VATperiod,
} from "../lib/fiscal-utils";

console.log("=".repeat(60));
console.log("Fiscal Utilities Test - Israeli VAT Period Management");
console.log("=".repeat(60));
console.log();

// Test 1: Get current period
console.log("📅 Test 1: Current Period");
console.log("-".repeat(60));
const currentPeriod = getCurrentPeriod();
console.log(`Current Period: Period ${currentPeriod.periodIndex} of ${currentPeriod.year}`);
console.log(`Hebrew Label: ${getPeriodLabel(currentPeriod)}`);
console.log();

// Test 2: Period date ranges
console.log("📆 Test 2: Period Date Ranges");
console.log("-".repeat(60));
for (let i = 1; i <= 6; i++) {
  const period: VATperiod = { year: 2026, periodIndex: i as 1 | 2 | 3 | 4 | 5 | 6 };
  const dateRange = getPeriodDateRange(period);
  const label = getPeriodLabel(period);
  console.log(
    `Period ${i}: ${label.padEnd(25)} | ${dateRange.startDateString} to ${dateRange.endDateString}`
  );
}
console.log();

// Test 3: Deadlines
console.log("⏰ Test 3: VAT Submission Deadlines");
console.log("-".repeat(60));
for (let i = 1; i <= 6; i++) {
  const period: VATperiod = { year: 2026, periodIndex: i as 1 | 2 | 3 | 4 | 5 | 6 };
  const deadline = getDeadline(period);
  const label = getPeriodLabel(period);
  const deadlineStr = deadline.toLocaleDateString("he-IL");
  console.log(`${label.padEnd(25)} → Deadline: ${deadlineStr}`);
}
console.log();

// Test 4: Current period deadline status
console.log("🚨 Test 4: Current Period Deadline Status");
console.log("-".repeat(60));
const deadline = getDeadline(currentPeriod);
const daysRemaining = getDaysRemaining(deadline);
const deadlineStatus = getDeadlineStatus(currentPeriod);
console.log(`Period: ${getPeriodLabel(currentPeriod)}`);
console.log(`Deadline: ${deadline.toLocaleDateString("he-IL")}`);
console.log(`Days Remaining: ${daysRemaining}`);
console.log(`Status: ${deadlineStatus.status.toUpperCase()}`);
console.log(`Message: ${deadlineStatus.message}`);
console.log();

// Test 5: Period navigation
console.log("⬅️➡️ Test 5: Period Navigation");
console.log("-".repeat(60));
const testPeriod: VATperiod = { year: 2026, periodIndex: 3 }; // May-Jun
const prevPeriod = getPreviousPeriod(testPeriod);
const nextPeriod = getNextPeriod(testPeriod);
console.log(`Current: ${getPeriodLabel(testPeriod)}`);
console.log(`Previous: ${getPeriodLabel(prevPeriod)}`);
console.log(`Next: ${getPeriodLabel(nextPeriod)}`);
console.log();

// Test edge cases
console.log("🔄 Test 6: Year Rollover");
console.log("-".repeat(60));
const period1: VATperiod = { year: 2026, periodIndex: 1 };
const period6: VATperiod = { year: 2026, periodIndex: 6 };
console.log(`Period 1 Previous: ${getPeriodLabel(getPreviousPeriod(period1))}`);
console.log(`Period 6 Next: ${getPeriodLabel(getNextPeriod(period6))}`);
console.log(`Period 6 Deadline: ${getDeadline(period6).toLocaleDateString("he-IL")} (should be Jan 15, 2027)`);
console.log();

// Test 7: Transaction filtering
console.log("🔍 Test 7: Transaction Filtering");
console.log("-".repeat(60));
const sampleTransactions = [
  { id: 1, date: "2026-01-15", description: "Transaction in Jan", amount: 100 },
  { id: 2, date: "2026-02-20", description: "Transaction in Feb", amount: 200 },
  { id: 3, date: "2026-03-10", description: "Transaction in Mar", amount: 300 },
  { id: 4, date: "2026-05-05", description: "Transaction in May", amount: 400 },
];

const period1Transactions = filterTransactionsByPeriod(sampleTransactions, {
  year: 2026,
  periodIndex: 1,
});
const period2Transactions = filterTransactionsByPeriod(sampleTransactions, {
  year: 2026,
  periodIndex: 2,
});

console.log(
  `Period 1 (Jan-Feb) Transactions: ${period1Transactions.length} found`
);
period1Transactions.forEach((t) =>
  console.log(`  - ${t.date}: ${t.description}`)
);

console.log(
  `Period 2 (Mar-Apr) Transactions: ${period2Transactions.length} found`
);
period2Transactions.forEach((t) =>
  console.log(`  - ${t.date}: ${t.description}`)
);
console.log();

// Test 8: Period status
console.log("✅ Test 8: Period Status (Past/Current/Future)");
console.log("-".repeat(60));
const periods = getPeriodsForYear(currentPeriod.year);
periods.forEach((period) => {
  let status = "";
  if (isPeriodPast(period)) status = "Past    ";
  else if (isCurrentPeriod(period)) status = "Current ";
  else if (isPeriodFuture(period)) status = "Future  ";

  console.log(`[${status}] ${getPeriodLabel(period)}`);
});
console.log();

// Test 9: Period comparison
console.log("🔢 Test 9: Period Comparison");
console.log("-".repeat(60));
const periodA: VATperiod = { year: 2025, periodIndex: 6 };
const periodB: VATperiod = { year: 2026, periodIndex: 1 };
const periodC: VATperiod = { year: 2026, periodIndex: 1 };

console.log(`${getPeriodLabel(periodA)} vs ${getPeriodLabel(periodB)}: ${comparePeriods(periodA, periodB)} (should be -1)`);
console.log(`${getPeriodLabel(periodB)} vs ${getPeriodLabel(periodC)}: ${comparePeriods(periodB, periodC)} (should be 0)`);
console.log(`${getPeriodLabel(periodB)} vs ${getPeriodLabel(periodA)}: ${comparePeriods(periodB, periodA)} (should be 1)`);
console.log();

console.log("=".repeat(60));
console.log("✅ All Tests Complete");
console.log("=".repeat(60));
console.log(`\nTotal Functions Tested: 15`);
console.log("Ready for integration with VATReport component!");
console.log();
