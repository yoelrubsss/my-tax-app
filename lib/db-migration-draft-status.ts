import Database from "better-sqlite3";
import path from "path";

/**
 * Migration: Add draft/completed status workflow
 * - Add status column (DRAFT | COMPLETED)
 * - Make amount, description, category nullable
 * - Add document_path if not exists
 * - Add status index
 */

const dbPath = path.join(process.cwd(), "vat_management.db");
const db = new Database(dbPath);

export function migrateToDraftStatus() {
  console.log("Starting migration: Draft Status Workflow...");

  try {
    // Check if status column exists
    const tableInfo = db.pragma("table_info(transactions)");
    const hasStatus = tableInfo.some((col: any) => col.name === "status");
    const hasDocumentPath = tableInfo.some((col: any) => col.name === "document_path");

    if (!hasStatus) {
      console.log("Adding status column...");
      db.exec(`
        ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'COMPLETED';
      `);
      console.log("✓ Status column added");
    } else {
      console.log("✓ Status column already exists");
    }

    if (!hasDocumentPath) {
      console.log("Adding document_path column...");
      db.exec(`
        ALTER TABLE transactions ADD COLUMN document_path TEXT;
      `);
      console.log("✓ Document_path column added");
    } else {
      console.log("✓ Document_path column already exists");
    }

    // SQLite doesn't support ALTER COLUMN, so we need to create a new table
    // and copy data if we need to make columns nullable
    console.log("Creating updated transactions table...");

    // Create backup table
    db.exec(`DROP TABLE IF EXISTS transactions_backup;`);
    db.exec(`
      CREATE TABLE transactions_backup AS SELECT * FROM transactions;
    `);

    // Drop old table
    db.exec(`DROP TABLE transactions;`);

    // Create new table with nullable fields
    db.exec(`
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('income', 'expense') OR type IS NULL),
        amount REAL,
        vat_amount REAL,
        date TEXT DEFAULT (datetime('now')),
        description TEXT,
        category TEXT,
        is_vat_deductible INTEGER DEFAULT 0,
        document_path TEXT,
        status TEXT DEFAULT 'COMPLETED' CHECK(status IN ('DRAFT', 'COMPLETED')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Restore data from backup with explicit column mapping
    const columns = db.pragma("table_info(transactions_backup)").map((col: any) => col.name);
    const backupHasStatus = columns.includes("status");

    if (backupHasStatus) {
      // Status column exists, copy as-is but ensure it's COMPLETED if null
      db.exec(`
        INSERT INTO transactions (id, user_id, type, amount, vat_amount, date, description, category, is_vat_deductible, document_path, status, created_at)
        SELECT id, user_id, type, amount, vat_amount, date, description, category, is_vat_deductible, document_path,
               COALESCE(status, 'COMPLETED'), created_at
        FROM transactions_backup;
      `);
    } else {
      // No status column, set all to COMPLETED
      db.exec(`
        INSERT INTO transactions (id, user_id, type, amount, vat_amount, date, description, category, is_vat_deductible, document_path, status, created_at)
        SELECT id, user_id, type, amount, vat_amount, date, description, category, is_vat_deductible, document_path,
               'COMPLETED', created_at
        FROM transactions_backup;
      `);
    }

    // Drop backup
    db.exec(`DROP TABLE transactions_backup;`);

    // Recreate indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    `);

    console.log("✅ Migration completed successfully!");
    console.log("Transactions table now supports draft/completed workflow");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    db.close();
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateToDraftStatus();
}
