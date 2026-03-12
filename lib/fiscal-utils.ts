/**
 * Fiscal Utilities for Israeli VAT Management
 *
 * Handles bi-monthly VAT periods, deadlines, and transaction filtering.
 * Israeli VAT reporting is done bi-monthly with deadlines on the 15th of the following month.
 */

/**
 * Represents a bi-monthly VAT period
 */
export interface VATperiod {
  year: number;
  periodIndex: 1 | 2 | 3 | 4 | 5 | 6; // 1=Jan-Feb, 2=Mar-Apr, ..., 6=Nov-Dec
}

/**
 * Period date range information
 */
export interface PeriodDateRange {
  startDate: Date;
  endDate: Date;
  startDateString: string; // YYYY-MM-DD format
  endDateString: string; // YYYY-MM-DD format
}

/**
 * Transaction interface for filtering
 */
export interface Transaction {
  date: string; // YYYY-MM-DD format
  [key: string]: any;
}

/**
 * Hebrew month names
 */
const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

/**
 * Get the current bi-monthly VAT period based on today's date
 */
export function getCurrentPeriod(): VATperiod {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  let periodIndex: 1 | 2 | 3 | 4 | 5 | 6;

  if (month <= 2) {
    periodIndex = 1; // Jan-Feb
  } else if (month <= 4) {
    periodIndex = 2; // Mar-Apr
  } else if (month <= 6) {
    periodIndex = 3; // May-Jun
  } else if (month <= 8) {
    periodIndex = 4; // Jul-Aug
  } else if (month <= 10) {
    periodIndex = 5; // Sep-Oct
  } else {
    periodIndex = 6; // Nov-Dec
  }

  return { year, periodIndex };
}

/**
 * Get Hebrew label for a period
 * Example: "ינואר - פברואר 2026"
 */
export function getPeriodLabel(period: VATperiod): string {
  const { year, periodIndex } = period;

  const periodMonths: Record<number, [number, number]> = {
    1: [0, 1],   // Jan-Feb
    2: [2, 3],   // Mar-Apr
    3: [4, 5],   // May-Jun
    4: [6, 7],   // Jul-Aug
    5: [8, 9],   // Sep-Oct
    6: [10, 11], // Nov-Dec
  };

  const [startMonth, endMonth] = periodMonths[periodIndex];
  const startMonthName = HEBREW_MONTHS[startMonth];
  const endMonthName = HEBREW_MONTHS[endMonth];

  return `${startMonthName} - ${endMonthName} ${year}`;
}

/**
 * Get the date range for a period
 */
export function getPeriodDateRange(period: VATperiod): PeriodDateRange {
  const { year, periodIndex } = period;

  const periodMonths: Record<number, [number, number]> = {
    1: [0, 1],   // Jan-Feb
    2: [2, 3],   // Mar-Apr
    3: [4, 5],   // May-Jun
    4: [6, 7],   // Jul-Aug
    5: [8, 9],   // Sep-Oct
    6: [10, 11], // Nov-Dec
  };

  const [startMonth, endMonth] = periodMonths[periodIndex];

  // Start date: First day of first month (use UTC to avoid timezone issues)
  const startDate = new Date(Date.UTC(year, startMonth, 1));

  // End date: Last day of second month
  const endDate = new Date(Date.UTC(year, endMonth + 1, 0)); // Day 0 of next month = last day of current month

  // Format dates properly in local timezone
  const formatDate = (date: Date): string => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    startDate,
    endDate,
    startDateString: formatDate(startDate),
    endDateString: formatDate(endDate),
  };
}

/**
 * Get the deadline for VAT submission for a period
 * Deadline is the 15th of the month following the period end
 */
export function getDeadline(period: VATperiod): Date {
  const { year, periodIndex } = period;

  // Deadline month is the month after the period ends
  const deadlineMonthZeroIndexed = periodIndex * 2; // Period 1 ends in Feb (month 1), deadline in Mar (month 2)

  let deadlineYear = year;
  let deadlineMonth = deadlineMonthZeroIndexed;

  // Handle year rollover for Period 6 (Nov-Dec)
  if (deadlineMonth >= 12) {
    deadlineMonth = 0; // January
    deadlineYear = year + 1;
  }

  return new Date(deadlineYear, deadlineMonth, 15);
}

/**
 * Get the number of days remaining until a deadline
 * Positive = days remaining, Negative = days overdue
 */
export function getDaysRemaining(deadline: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset time to start of day

  const deadlineCopy = new Date(deadline);
  deadlineCopy.setHours(0, 0, 0, 0);

  const diffTime = deadlineCopy.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get the previous period
 */
export function getPreviousPeriod(period: VATperiod): VATperiod {
  const { year, periodIndex } = period;

  if (periodIndex === 1) {
    // If Period 1, go to Period 6 of previous year
    return { year: year - 1, periodIndex: 6 };
  } else {
    // Otherwise, decrement period
    return { year, periodIndex: (periodIndex - 1) as 1 | 2 | 3 | 4 | 5 | 6 };
  }
}

/**
 * Get the next period
 */
export function getNextPeriod(period: VATperiod): VATperiod {
  const { year, periodIndex } = period;

  if (periodIndex === 6) {
    // If Period 6, go to Period 1 of next year
    return { year: year + 1, periodIndex: 1 };
  } else {
    // Otherwise, increment period
    return { year, periodIndex: (periodIndex + 1) as 1 | 2 | 3 | 4 | 5 | 6 };
  }
}

/**
 * Filter transactions by period
 * Returns only transactions that fall within the period's date range
 */
export function filterTransactionsByPeriod<T extends Transaction>(
  transactions: T[],
  period: VATperiod
): T[] {
  const { startDateString, endDateString } = getPeriodDateRange(period);

  return transactions.filter((transaction) => {
    return (
      transaction.date >= startDateString && transaction.date <= endDateString
    );
  });
}

/**
 * Check if a period is in the past
 */
export function isPeriodPast(period: VATperiod): boolean {
  const currentPeriod = getCurrentPeriod();

  if (period.year < currentPeriod.year) {
    return true;
  }

  if (period.year === currentPeriod.year && period.periodIndex < currentPeriod.periodIndex) {
    return true;
  }

  return false;
}

/**
 * Check if a period is the current period
 */
export function isCurrentPeriod(period: VATperiod): boolean {
  const currentPeriod = getCurrentPeriod();
  return period.year === currentPeriod.year && period.periodIndex === currentPeriod.periodIndex;
}

/**
 * Check if a period is in the future
 */
export function isPeriodFuture(period: VATperiod): boolean {
  const currentPeriod = getCurrentPeriod();

  if (period.year > currentPeriod.year) {
    return true;
  }

  if (period.year === currentPeriod.year && period.periodIndex > currentPeriod.periodIndex) {
    return true;
  }

  return false;
}

/**
 * Get deadline status message in Hebrew
 */
export function getDeadlineStatus(period: VATperiod): {
  daysRemaining: number;
  status: "urgent" | "warning" | "ok" | "overdue";
  message: string;
} {
  const deadline = getDeadline(period);
  const daysRemaining = getDaysRemaining(deadline);

  if (daysRemaining < 0) {
    return {
      daysRemaining,
      status: "overdue",
      message: `באיחור ${Math.abs(daysRemaining)} ימים! 🔴`,
    };
  } else if (daysRemaining === 0) {
    return {
      daysRemaining,
      status: "urgent",
      message: "מועד אחרון היום! ⚠️",
    };
  } else if (daysRemaining <= 3) {
    return {
      daysRemaining,
      status: "urgent",
      message: `נשארו ${daysRemaining} ימים בלבד! 🔴`,
    };
  } else if (daysRemaining <= 7) {
    return {
      daysRemaining,
      status: "warning",
      message: `נשארו ${daysRemaining} ימים ⚠️`,
    };
  } else {
    return {
      daysRemaining,
      status: "ok",
      message: `נשארו ${daysRemaining} ימים`,
    };
  }
}

/**
 * Get all periods for a given year
 */
export function getPeriodsForYear(year: number): VATperiod[] {
  return [
    { year, periodIndex: 1 },
    { year, periodIndex: 2 },
    { year, periodIndex: 3 },
    { year, periodIndex: 4 },
    { year, periodIndex: 5 },
    { year, periodIndex: 6 },
  ];
}

/**
 * Compare two periods
 * Returns: -1 if period1 < period2, 0 if equal, 1 if period1 > period2
 */
export function comparePeriods(period1: VATperiod, period2: VATperiod): number {
  if (period1.year < period2.year) return -1;
  if (period1.year > period2.year) return 1;

  if (period1.periodIndex < period2.periodIndex) return -1;
  if (period1.periodIndex > period2.periodIndex) return 1;

  return 0;
}
