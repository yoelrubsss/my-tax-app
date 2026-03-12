import db from "./db";
import bcrypt from "bcryptjs";

// User operations
export interface User {
  id?: number;
  email: string;
  password_hash?: string;
  name: string;
  dealer_number: string;
  business_name?: string;
  created_at?: string;
}

// Create user with authentication (for registration)
export async function createUser(
  email: string,
  password: string,
  name: string,
  dealer_number: string,
  business_name?: string
): Promise<number> {
  // Hash password
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  const stmt = db.prepare(
    "INSERT INTO users (email, password_hash, name, dealer_number, business_name) VALUES (?, ?, ?, ?, ?)"
  );
  const result = stmt.run(email, password_hash, name, dealer_number, business_name || null);
  return result.lastInsertRowid as number;
}

// Get user by email (for login)
export function getUserByEmail(email: string): User | undefined {
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  return stmt.get(email) as User | undefined;
}

// Get user by ID (existing function, updated for new schema)
export function getUser(id: number): User | undefined {
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  return stmt.get(id) as User | undefined;
}

// Get all users (existing function)
export function getAllUsers(): User[] {
  const stmt = db.prepare("SELECT * FROM users ORDER BY name");
  return stmt.all() as User[];
}

// Transaction operations
export interface Transaction {
  id?: number;
  user_id: number;
  type?: "income" | "expense";
  amount?: number;
  vat_amount?: number;
  date?: string;
  description?: string;
  category?: string;
  is_vat_deductible?: boolean;
  document_path?: string;
  status?: "DRAFT" | "COMPLETED";
  created_at?: string;
}

export function createTransaction(transaction: Omit<Transaction, "id" | "created_at">) {
  const stmt = db.prepare(`
    INSERT INTO transactions
    (user_id, type, amount, vat_amount, date, description, category, is_vat_deductible, document_path, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    transaction.user_id,
    transaction.type || null,
    transaction.amount || null,
    transaction.vat_amount || null,
    transaction.date || new Date().toISOString().split("T")[0],
    transaction.description || null,
    transaction.category || null,
    transaction.is_vat_deductible ? 1 : 0,
    transaction.document_path || null,
    transaction.status || "COMPLETED"
  );

  return result.lastInsertRowid;
}

export function getTransactionsByUser(userId: number, status?: "DRAFT" | "COMPLETED"): Transaction[] {
  let query = `
    SELECT * FROM transactions
    WHERE user_id = ?
  `;

  const params: any[] = [userId];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY date DESC, created_at DESC`;

  const stmt = db.prepare(query);
  return stmt.all(...params) as Transaction[];
}

export function getTransactionsByDateRange(
  userId: number,
  startDate: string,
  endDate: string
): Transaction[] {
  const stmt = db.prepare(`
    SELECT * FROM transactions
    WHERE user_id = ? AND date >= ? AND date <= ?
    ORDER BY date DESC
  `);
  return stmt.all(userId, startDate, endDate) as Transaction[];
}

export function getTransactionById(id: number): Transaction | undefined {
  const stmt = db.prepare("SELECT * FROM transactions WHERE id = ?");
  return stmt.get(id) as Transaction | undefined;
}

export function updateTransactionDocument(id: number, documentPath: string) {
  const stmt = db.prepare("UPDATE transactions SET document_path = ? WHERE id = ?");
  return stmt.run(documentPath, id);
}

export function updateTransaction(
  id: number,
  updates: Partial<Omit<Transaction, "id" | "user_id" | "created_at">>
) {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.type !== undefined) {
    fields.push("type = ?");
    values.push(updates.type);
  }
  if (updates.amount !== undefined) {
    fields.push("amount = ?");
    values.push(updates.amount);
  }
  if (updates.vat_amount !== undefined) {
    fields.push("vat_amount = ?");
    values.push(updates.vat_amount);
  }
  if (updates.date !== undefined) {
    fields.push("date = ?");
    values.push(updates.date);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.category !== undefined) {
    fields.push("category = ?");
    values.push(updates.category || null);
  }
  if (updates.is_vat_deductible !== undefined) {
    fields.push("is_vat_deductible = ?");
    values.push(updates.is_vat_deductible ? 1 : 0);
  }
  if (updates.document_path !== undefined) {
    fields.push("document_path = ?");
    values.push(updates.document_path || null);
  }
  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
  }

  if (fields.length === 0) {
    throw new Error("No fields to update");
  }

  // Auto-complete draft if all required fields are present
  const transaction = getTransactionById(id);
  if (transaction && transaction.status === "DRAFT") {
    const hasAmount = updates.amount !== undefined || transaction.amount !== null;
    const hasDescription = updates.description !== undefined || transaction.description !== null;
    const hasType = updates.type !== undefined || transaction.type !== null;

    if (hasAmount && hasDescription && hasType && updates.status === undefined) {
      fields.push("status = ?");
      values.push("COMPLETED");
    }
  }

  values.push(id);
  const sql = `UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`;
  const stmt = db.prepare(sql);
  return stmt.run(...values);
}

export function deleteTransaction(id: number) {
  const stmt = db.prepare("DELETE FROM transactions WHERE id = ?");
  return stmt.run(id);
}

// VAT Summary calculations
export interface VATSummary {
  totalIncome: number;
  totalExpenses: number;
  totalVATOnIncome: number;
  totalDeductibleVAT: number;
  vatToPay: number;
}

export function calculateVATSummary(
  userId: number,
  startDate: string,
  endDate: string
): VATSummary {
  const transactions = getTransactionsByDateRange(userId, startDate, endDate);

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalVATOnIncome = 0;
  let totalDeductibleVAT = 0;

  transactions.forEach((t) => {
    if (t.type === "income") {
      totalIncome += t.amount;
      totalVATOnIncome += t.vat_amount;
    } else if (t.type === "expense") {
      totalExpenses += t.amount;
      if (t.is_vat_deductible) {
        totalDeductibleVAT += t.vat_amount;
      }
    }
  });

  const vatToPay = totalVATOnIncome - totalDeductibleVAT;

  return {
    totalIncome,
    totalExpenses,
    totalVATOnIncome,
    totalDeductibleVAT,
    vatToPay,
  };
}
