import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "vat_management.db");
const db = new Database(dbPath);

console.log("Starting database migration: Adding document_path column...");

try {
  // Check if column already exists
  const tableInfo = db.pragma("table_info(transactions)");
  const columnExists = tableInfo.some(
    (col: any) => col.name === "document_path"
  );

  if (columnExists) {
    console.log("✓ Column 'document_path' already exists. Skipping migration.");
  } else {
    // Add document_path column to transactions table
    db.exec(`
      ALTER TABLE transactions
      ADD COLUMN document_path TEXT;
    `);
    console.log("✓ Successfully added 'document_path' column to transactions table.");
  }

  // Verify the change
  const updatedTableInfo = db.pragma("table_info(transactions)");
  console.log("\nCurrent transactions table schema:");
  console.table(updatedTableInfo);

  console.log("\n✓ Migration completed successfully!");
} catch (error) {
  console.error("✗ Migration failed:", error);
  process.exit(1);
} finally {
  db.close();
}
