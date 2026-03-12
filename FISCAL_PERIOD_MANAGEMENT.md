# Fiscal Period Management

## Overview

This module manages Israeli VAT bi-monthly periods, deadlines, and transaction filtering for tax reporting.

---

## File: `lib/fiscal-utils.ts`

### Core Concepts

#### Bi-Monthly VAT Periods

Israeli authorized dealers (עוסק מורשה) report VAT on a **bi-monthly basis**:

| Period | Months | Date Range | Deadline |
|--------|--------|------------|----------|
| Period 1 | Jan-Feb | Jan 1 - Feb 28/29 | March 15 |
| Period 2 | Mar-Apr | Mar 1 - Apr 30 | May 15 |
| Period 3 | May-Jun | May 1 - Jun 30 | July 15 |
| Period 4 | Jul-Aug | Jul 1 - Aug 31 | September 15 |
| Period 5 | Sep-Oct | Sep 1 - Oct 31 | November 15 |
| Period 6 | Nov-Dec | Nov 1 - Dec 31 | January 15 (next year) |

#### Deadline Rule

The deadline for VAT submission is always the **15th of the month** following the period end.

---

## Types

### VATperiod

```typescript
interface VATperiod {
  year: number;
  periodIndex: 1 | 2 | 3 | 4 | 5 | 6;
}
```

**Example**:
```typescript
{ year: 2026, periodIndex: 1 } // Jan-Feb 2026
```

### PeriodDateRange

```typescript
interface PeriodDateRange {
  startDate: Date;           // JavaScript Date object
  endDate: Date;             // JavaScript Date object
  startDateString: string;   // YYYY-MM-DD format
  endDateString: string;     // YYYY-MM-DD format
}
```

---

## Functions

### 1. getCurrentPeriod()

Returns the current bi-monthly period based on today's date.

```typescript
function getCurrentPeriod(): VATperiod
```

**Example**:
```typescript
const current = getCurrentPeriod();
// If today is January 15, 2026:
// Returns: { year: 2026, periodIndex: 1 }
```

---

### 2. getPeriodLabel(period)

Returns a Hebrew label for the period.

```typescript
function getPeriodLabel(period: VATperiod): string
```

**Example**:
```typescript
const label = getPeriodLabel({ year: 2026, periodIndex: 1 });
// Returns: "ינואר - פברואר 2026"
```

**All Labels**:
- Period 1: "ינואר - פברואר 2026"
- Period 2: "מרץ - אפריל 2026"
- Period 3: "מאי - יוני 2026"
- Period 4: "יולי - אוגוסט 2026"
- Period 5: "ספטמבר - אוקטובר 2026"
- Period 6: "נובמבר - דצמבר 2026"

---

### 3. getPeriodDateRange(period)

Returns the exact start and end dates for a period.

```typescript
function getPeriodDateRange(period: VATperiod): PeriodDateRange
```

**Example**:
```typescript
const range = getPeriodDateRange({ year: 2026, periodIndex: 1 });
// Returns:
// {
//   startDate: Date(2026-01-01),
//   endDate: Date(2026-02-28),
//   startDateString: "2026-01-01",
//   endDateString: "2026-02-28"
// }
```

---

### 4. getDeadline(period)

Returns the VAT submission deadline date.

```typescript
function getDeadline(period: VATperiod): Date
```

**Example**:
```typescript
const deadline = getDeadline({ year: 2026, periodIndex: 1 });
// Returns: Date(2026-03-15) - March 15, 2026

const deadline6 = getDeadline({ year: 2026, periodIndex: 6 });
// Returns: Date(2027-01-15) - January 15, 2027 (next year!)
```

---

### 5. getDaysRemaining(deadline)

Calculates days remaining until deadline.

```typescript
function getDaysRemaining(deadline: Date): number
```

**Returns**:
- **Positive number**: Days remaining
- **Negative number**: Days overdue
- **0**: Due today

**Example**:
```typescript
const deadline = new Date(2026, 2, 15); // March 15, 2026
const days = getDaysRemaining(deadline);
// If today is Feb 1: Returns 42 (days remaining)
// If today is Mar 20: Returns -5 (5 days overdue)
```

---

### 6. getPreviousPeriod(period)

Returns the previous period.

```typescript
function getPreviousPeriod(period: VATperiod): VATperiod
```

**Example**:
```typescript
getPreviousPeriod({ year: 2026, periodIndex: 3 })
// Returns: { year: 2026, periodIndex: 2 }

getPreviousPeriod({ year: 2026, periodIndex: 1 })
// Returns: { year: 2025, periodIndex: 6 } // Year rollover!
```

---

### 7. getNextPeriod(period)

Returns the next period.

```typescript
function getNextPeriod(period: VATperiod): VATperiod
```

**Example**:
```typescript
getNextPeriod({ year: 2026, periodIndex: 3 })
// Returns: { year: 2026, periodIndex: 4 }

getNextPeriod({ year: 2026, periodIndex: 6 })
// Returns: { year: 2027, periodIndex: 1 } // Year rollover!
```

---

### 8. filterTransactionsByPeriod(transactions, period)

Filters transactions to only include those within the period's date range.

```typescript
function filterTransactionsByPeriod<T extends Transaction>(
  transactions: T[],
  period: VATperiod
): T[]
```

**Example**:
```typescript
const transactions = [
  { id: 1, date: "2026-01-15", amount: 100 },
  { id: 2, date: "2026-03-10", amount: 200 },
];

const period1 = filterTransactionsByPeriod(transactions, { year: 2026, periodIndex: 1 });
// Returns: [{ id: 1, date: "2026-01-15", amount: 100 }]
```

---

### 9. getDeadlineStatus(period)

Returns deadline status with Hebrew message.

```typescript
function getDeadlineStatus(period: VATperiod): {
  daysRemaining: number;
  status: "urgent" | "warning" | "ok" | "overdue";
  message: string;
}
```

**Status Levels**:
- **overdue**: Past deadline (negative days)
- **urgent**: 0-3 days remaining
- **warning**: 4-7 days remaining
- **ok**: 8+ days remaining

**Example**:
```typescript
const status = getDeadlineStatus({ year: 2026, periodIndex: 1 });
// If 2 days left:
// Returns: {
//   daysRemaining: 2,
//   status: "urgent",
//   message: "נשארו 2 ימים בלבד! 🔴"
// }

// If overdue by 5 days:
// Returns: {
//   daysRemaining: -5,
//   status: "overdue",
//   message: "באיחור 5 ימים! 🔴"
// }
```

---

### 10. isPeriodPast(period)

Checks if a period is in the past.

```typescript
function isPeriodPast(period: VATperiod): boolean
```

---

### 11. isCurrentPeriod(period)

Checks if a period is the current period.

```typescript
function isCurrentPeriod(period: VATperiod): boolean
```

---

### 12. isPeriodFuture(period)

Checks if a period is in the future.

```typescript
function isPeriodFuture(period: VATperiod): boolean
```

---

### 13. getPeriodsForYear(year)

Returns all 6 periods for a given year.

```typescript
function getPeriodsForYear(year: number): VATperiod[]
```

**Example**:
```typescript
const periods = getPeriodsForYear(2026);
// Returns: [
//   { year: 2026, periodIndex: 1 },
//   { year: 2026, periodIndex: 2 },
//   ...
//   { year: 2026, periodIndex: 6 }
// ]
```

---

### 14. comparePeriods(period1, period2)

Compares two periods chronologically.

```typescript
function comparePeriods(period1: VATperiod, period2: VATperiod): number
```

**Returns**:
- `-1`: period1 is earlier than period2
- `0`: periods are equal
- `1`: period1 is later than period2

**Example**:
```typescript
const p1 = { year: 2025, periodIndex: 6 };
const p2 = { year: 2026, periodIndex: 1 };
comparePeriods(p1, p2); // Returns: -1 (p1 is earlier)
```

---

## Usage Examples

### Example 1: Display Current Period with Deadline

```typescript
import { getCurrentPeriod, getPeriodLabel, getDeadline, getDeadlineStatus } from '@/lib/fiscal-utils';

const period = getCurrentPeriod();
const label = getPeriodLabel(period);
const deadline = getDeadline(period);
const status = getDeadlineStatus(period);

console.log(`Period: ${label}`);
console.log(`Deadline: ${deadline.toLocaleDateString('he-IL')}`);
console.log(`Status: ${status.message}`);

// Output:
// Period: ינואר - פברואר 2026
// Deadline: 15.3.2026
// Status: נשארו 41 ימים
```

---

### Example 2: Filter Transactions for Period

```typescript
import { getCurrentPeriod, filterTransactionsByPeriod } from '@/lib/fiscal-utils';

const allTransactions = await fetchTransactions();
const currentPeriod = getCurrentPeriod();
const periodTransactions = filterTransactionsByPeriod(allTransactions, currentPeriod);

console.log(`Period transactions: ${periodTransactions.length}`);
```

---

### Example 3: Period Navigation

```typescript
import { getCurrentPeriod, getPreviousPeriod, getNextPeriod, getPeriodLabel } from '@/lib/fiscal-utils';

const current = getCurrentPeriod();
const prev = getPreviousPeriod(current);
const next = getNextPeriod(current);

console.log(`← ${getPeriodLabel(prev)}`);
console.log(`  ${getPeriodLabel(current)} (Current)`);
console.log(`→ ${getPeriodLabel(next)}`);

// Output:
// ← נובמבר - דצמבר 2025
//   ינואר - פברואר 2026 (Current)
// → מרץ - אפריל 2026
```

---

### Example 4: Deadline Urgency Alert

```typescript
import { getCurrentPeriod, getDeadlineStatus } from '@/lib/fiscal-utils';

const period = getCurrentPeriod();
const status = getDeadlineStatus(period);

if (status.status === "urgent" || status.status === "overdue") {
  alert(`⚠️ ${status.message}`);
}
```

---

## Testing

Run the test suite:

```bash
npm run test-fiscal-utils
```

**Tests Cover**:
1. ✅ Current period detection
2. ✅ All 6 period date ranges
3. ✅ Deadline calculation (including year rollover)
4. ✅ Days remaining calculation
5. ✅ Period navigation (prev/next)
6. ✅ Year rollover edge cases
7. ✅ Transaction filtering
8. ✅ Period status (past/current/future)
9. ✅ Period comparison

---

## Integration Points

### VATReport Component

Update `components/VATReport.tsx` to use fiscal utilities:

```typescript
import { getCurrentPeriod, getPeriodLabel, filterTransactionsByPeriod } from '@/lib/fiscal-utils';

// Replace manual period calculation with:
const period = getCurrentPeriod();
const label = getPeriodLabel(period);
const transactions = filterTransactionsByPeriod(allTransactions, period);
```

### Period Selector

Future enhancement: Add period navigation to VATReport:

```typescript
const [currentPeriod, setCurrentPeriod] = useState(getCurrentPeriod());

<button onClick={() => setCurrentPeriod(getPreviousPeriod(currentPeriod))}>
  ← Previous
</button>
<span>{getPeriodLabel(currentPeriod)}</span>
<button onClick={() => setCurrentPeriod(getNextPeriod(currentPeriod))}>
  Next →
</button>
```

---

## Key Features

✅ **Accurate Date Ranges** - Handles leap years and month lengths
✅ **Year Rollover** - Period 6 → Period 1 crosses years correctly
✅ **Hebrew Labels** - User-friendly period names
✅ **Deadline Tracking** - Always 15th of following month
✅ **Status Messages** - Hebrew urgency indicators
✅ **Transaction Filtering** - SQL-like date range filtering
✅ **Navigation** - Easy prev/next period switching

---

## Notes

### Leap Years

The utilities automatically handle leap years. February 29 is correctly included when applicable.

### Timezone Handling

All date calculations use UTC to avoid timezone issues. Dates are formatted as YYYY-MM-DD strings for consistency with the database.

### Performance

All functions are synchronous and lightweight. Transaction filtering is O(n) complexity.

---

## Summary

The fiscal utilities provide a complete solution for managing Israeli VAT bi-monthly periods:

- **15 Functions** covering all period management needs
- **Fully Tested** with comprehensive test suite
- **Hebrew Support** for user-facing messages
- **Type-Safe** with TypeScript interfaces
- **Production-Ready** for integration with VATReport

Ready for Phase 3.5, Step 2: Period Selector UI! 🚀
