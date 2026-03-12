// Create default user for testing
import { createUser, getUser } from "../lib/db-operations";
import "../lib/init-db";

console.log("Checking for default user...");

try {
  // Check if user with ID 1 exists
  const existingUser = getUser(1);

  if (existingUser) {
    console.log("Default user already exists:");
    console.log(`  Name: ${existingUser.name}`);
    console.log(`  Dealer Number: ${existingUser.dealer_number}`);
  } else {
    // Create default user
    const userId = createUser({
      name: "משתמש ברירת מחדל",
      dealer_number: "000000000",
    });

    console.log("Created default user:");
    console.log(`  ID: ${userId}`);
    console.log(`  Name: משתמש ברירת מחדל`);
    console.log(`  Dealer Number: 000000000`);
    console.log("\nYou can update this later when implementing user authentication.");
  }
} catch (error) {
  console.error("Error creating default user:", error);
}
