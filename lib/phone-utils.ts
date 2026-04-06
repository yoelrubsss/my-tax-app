import { devLog } from "@/lib/dev-log";

/**
 * Phone Number Utilities for Israeli WhatsApp Integration
 *
 * Normalizes Israeli phone numbers to match WhatsApp API format
 */

/**
 * Normalize Israeli phone number to international format
 *
 * Logic:
 * 1. Remove all non-digit characters (+, -, spaces)
 * 2. If starts with '0', remove it and prepend '972'
 * 3. If starts with '972', keep as-is
 * 4. Otherwise, prepend '972'
 *
 * Examples:
 * - "052-458-9771" → "972524589771"
 * - "0524589771" → "972524589771"
 * - "972524589771" → "972524589771"
 * - "+972524589771" → "972524589771"
 * - "52-458-9771" → "972524589771"
 *
 * @param phoneNumber - Raw phone number input
 * @returns Normalized phone number in format 972XXXXXXXXX, or null if invalid
 */
export function normalizeIsraeliPhone(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) {
    return null;
  }

  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  devLog(`📱 [PHONE] Normalizing: "${phoneNumber}" → cleaned: "${cleaned}"`);

  // Validate minimum length (Israeli mobile: 9-10 digits, with country code: 11-12 digits)
  if (cleaned.length < 9) {
    console.warn(`⚠️ [PHONE] Too short: "${cleaned}" (min 9 digits required)`);
    return null;
  }

  // If starts with '0', remove it and prepend '972'
  if (cleaned.startsWith('0')) {
    cleaned = '972' + cleaned.substring(1);
    devLog(`📱 [PHONE] Removed leading 0, added 972: "${cleaned}"`);
  }
  // If doesn't start with '972', prepend it
  else if (!cleaned.startsWith('972')) {
    cleaned = '972' + cleaned;
    devLog(`📱 [PHONE] Added 972 prefix: "${cleaned}"`);
  }

  // Validate final format (should be 972XXXXXXXXX - 12 digits total)
  if (!cleaned.startsWith('972') || cleaned.length < 12 || cleaned.length > 13) {
    console.warn(`⚠️ [PHONE] Invalid format after normalization: "${cleaned}"`);
    return null;
  }

  devLog(`✅ [PHONE] Normalized: "${phoneNumber}" → "${cleaned}"`);
  return cleaned;
}

/**
 * Format Israeli phone number for display
 *
 * Converts 972524589771 → 052-458-9771
 *
 * @param phoneNumber - Normalized phone number (972XXXXXXXXX)
 * @returns Formatted display string, or original if invalid
 */
export function formatIsraeliPhoneForDisplay(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) {
    return '';
  }

  // If it's already in 972 format, convert to Israeli display format
  if (phoneNumber.startsWith('972')) {
    const withoutPrefix = phoneNumber.substring(3); // Remove '972'
    if (withoutPrefix.length === 9) {
      // Format as 0XX-XXX-XXXX
      return `0${withoutPrefix.substring(0, 2)}-${withoutPrefix.substring(2, 5)}-${withoutPrefix.substring(5)}`;
    }
  }

  // Return as-is if can't format
  return phoneNumber;
}

/**
 * Validate Israeli phone number format
 *
 * @param phoneNumber - Phone number to validate
 * @returns True if valid Israeli phone number
 */
export function isValidIsraeliPhone(phoneNumber: string | null | undefined): boolean {
  if (!phoneNumber) {
    return false;
  }

  const normalized = normalizeIsraeliPhone(phoneNumber);
  return normalized !== null && normalized.startsWith('972') && normalized.length >= 12;
}

/**
 * Test suite for phone normalization
 * Run with: npm run test-phone-utils
 */
export function testPhoneNormalization() {
  const testCases = [
    { input: '052-458-9771', expected: '972524589771' },
    { input: '0524589771', expected: '972524589771' },
    { input: '972524589771', expected: '972524589771' },
    { input: '+972524589771', expected: '972524589771' },
    { input: '52-458-9771', expected: '972524589771' },
    { input: '054 123 4567', expected: '972541234567' },
    { input: '(050) 987-6543', expected: '972509876543' },
    { input: '', expected: null },
    { input: '123', expected: null },
  ];

  console.log('\n========================================');
  console.log('📱 Phone Normalization Test Suite');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  testCases.forEach(({ input, expected }, index) => {
    const result = normalizeIsraeliPhone(input);
    const success = result === expected;

    if (success) {
      console.log(`✅ Test ${index + 1}: "${input}" → "${result}"`);
      passed++;
    } else {
      console.error(`❌ Test ${index + 1}: "${input}" → Expected: "${expected}", Got: "${result}"`);
      failed++;
    }
  });

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  return { passed, failed };
}
