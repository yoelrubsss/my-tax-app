/**
 * Test script for Tax Knowledge Base
 * Demonstrates how the legal rules work
 */

import {
  TAX_CATEGORIES,
  getCategoryById,
  suggestCategory,
  getAllCategoryLabels,
} from "../lib/tax-knowledge";

console.log("=".repeat(60));
console.log("Israeli Tax Knowledge Base - Test & Demo");
console.log("=".repeat(60));
console.log();

// Display all categories
console.log("📚 Available Tax Categories:");
console.log("-".repeat(60));
TAX_CATEGORIES.forEach((cat) => {
  console.log(`\n${cat.label} (${cat.id})`);
  console.log(`  • VAT Deduction: ${(cat.vatPercentage * 100).toFixed(1)}%`);
  console.log(
    `  • Income Tax Recognition: ${(cat.incomeTaxRecognition * 100).toFixed(1)}%`
  );
  console.log(`  • Warning: ${cat.warning}`);
  console.log(`  • Legal Ref: ${cat.legalRefUrl}`);
  console.log(
    `  • Keywords: ${cat.matchKeywords.slice(0, 5).join(", ")}...`
  );
});

console.log("\n" + "=".repeat(60));
console.log("🔍 Testing Auto-Detection (suggestCategory)");
console.log("=".repeat(60));

// Test auto-detection
const testCases = [
  "תדלוק בפז",
  "קניית מחשב נייד",
  "מנוי נטפליקס",
  "ארוחת עבודה עם לקוח",
  "שכר דירה משרד",
  "פרסום בגוגל",
  "ביטוח אחריות מקצועית",
];

testCases.forEach((description) => {
  const suggestion = suggestCategory(description);
  if (suggestion) {
    console.log(`\n"${description}"`);
    console.log(`  → Suggested: ${suggestion.label}`);
    console.log(`  → VAT: ${(suggestion.vatPercentage * 100).toFixed(1)}%`);
    console.log(
      `  → Income Tax: ${(suggestion.incomeTaxRecognition * 100).toFixed(1)}%`
    );
  } else {
    console.log(`\n"${description}"`);
    console.log(`  → No match found (will use "Other" category)`);
  }
});

console.log("\n" + "=".repeat(60));
console.log("💡 Example: Calculate VAT for Fuel Expense");
console.log("=".repeat(60));

// Example calculation
const fuelCategory = getCategoryById("vehicle-fuel");
if (fuelCategory) {
  const totalAmount = 500; // 500 NIS total
  const vatAmount = totalAmount * 0.18 / 1.18; // Extract VAT
  const deductibleVat = vatAmount * fuelCategory.vatPercentage;

  console.log(`\nTransaction: Fuel purchase - ₪${totalAmount}`);
  console.log(`Total VAT in invoice: ₪${vatAmount.toFixed(2)}`);
  console.log(
    `Deductible VAT (${(fuelCategory.vatPercentage * 100).toFixed(1)}%): ₪${deductibleVat.toFixed(2)}`
  );
  console.log(`Non-deductible (private use): ₪${(vatAmount - deductibleVat).toFixed(2)}`);
  console.log(`\n⚠️  ${fuelCategory.warning}`);
}

console.log("\n" + "=".repeat(60));
console.log("✅ Knowledge Base Test Complete");
console.log("=".repeat(60));
console.log(
  `\nTotal Categories: ${TAX_CATEGORIES.length}`
);
console.log("Ready for AI Accountant integration!");
console.log();
