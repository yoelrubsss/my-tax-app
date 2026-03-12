// Migration script to add authentication fields to users table
import db from "../lib/db";

console.log("Starting users table migration...");

try {
  // Check if users table has any data
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };

  console.log(`Found ${userCount.count} existing users.`);

  if (userCount.count === 0) {
    console.log("No users found. Recreating table with new schema...");

    // Drop and recreate if empty
    db.exec(`DROP TABLE IF EXISTS users`);
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        dealer_number TEXT NOT NULL UNIQUE,
        business_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Users table recreated with auth fields.");
  } else {
    console.log("Users exist. Adding new columns safely...");

    // Check if columns already exist
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const columnNames = tableInfo.map(col => col.name);

    // Add email column if it doesn't exist
    if (!columnNames.includes("email")) {
      console.log("Adding 'email' column...");
      db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
    }

    // Add password_hash column if it doesn't exist
    if (!columnNames.includes("password_hash")) {
      console.log("Adding 'password_hash' column...");
      db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
    }

    // Add business_name column if it doesn't exist
    if (!columnNames.includes("business_name")) {
      console.log("Adding 'business_name' column...");
      db.exec(`ALTER TABLE users ADD COLUMN business_name TEXT`);
    }

    console.log("✅ Users table migrated successfully.");
    console.log("⚠️  NOTE: Existing users will need to be updated with email/password manually.");
  }

  // Show final schema
  console.log("\nFinal users table schema:");
  const finalSchema = db.prepare("PRAGMA table_info(users)").all();
  console.table(finalSchema);

} catch (error) {
  console.error("❌ Migration failed:", error);
  process.exit(1);
}

console.log("\n✅ Migration completed successfully!");
