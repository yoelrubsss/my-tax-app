/**
 * ✅ MIGRATED TO PRISMA DATABASE
 *
 * Database operations now use Prisma Client instead of better-sqlite3.
 * All functions maintain backward compatibility but work with Prisma's CUID strings.
 */

import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

// User operations
export interface User {
  id?: string; // Changed from number to string (CUID)
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
): Promise<string> {
  // Hash password
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      email,
      password: password_hash,
      name,
      dealerNumber: dealer_number,
      profile: business_name
        ? {
            create: {
              businessName: business_name,
            },
          }
        : undefined,
    },
  });

  return user.id;
}

// Get user by email (for login)
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  if (!user) return undefined;

  return {
    id: user.id,
    email: user.email,
    password_hash: user.password,
    name: user.name || "",
    dealer_number: user.dealerNumber || "",
    business_name: user.profile?.businessName || undefined,
    created_at: user.createdAt.toISOString(),
  };
}

// Get user by ID
export async function getUser(id: string | number): Promise<User | undefined> {
  // Handle both string (CUID) and number (legacy) IDs
  const userId = typeof id === "number" ? String(id) : id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) return undefined;

  return {
    id: user.id,
    email: user.email,
    password_hash: user.password,
    name: user.name || "",
    dealer_number: user.dealerNumber || "",
    business_name: user.profile?.businessName || undefined,
    created_at: user.createdAt.toISOString(),
  };
}

// Get all users
export async function getAllUsers(): Promise<User[]> {
  const users = await prisma.user.findMany({
    include: { profile: true },
    orderBy: { name: "asc" },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    password_hash: user.password,
    name: user.name || "",
    dealer_number: user.dealerNumber || "",
    business_name: user.profile?.businessName || undefined,
    created_at: user.createdAt.toISOString(),
  }));
}

// Get user profile
export async function getUserProfile(userId: string | number) {
  const userIdStr = typeof userId === "number" ? String(userId) : userId;

  const profile = await prisma.userProfile.findUnique({
    where: { userId: userIdStr },
  });

  return profile;
}

// Transaction operations
export interface Transaction {
  id?: string; // Changed from number to string (CUID)
  user_id: string | number;
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

export async function createTransaction(
  transaction: Omit<Transaction, "id" | "created_at">
) {
  const userIdStr =
    typeof transaction.user_id === "number"
      ? String(transaction.user_id)
      : transaction.user_id;

  const vatRate = 0.18;
  const amount = transaction.amount || 0;
  const vatAmount = amount > 0 ? (amount * vatRate) / (1 + vatRate) : 0;
  const netAmount = amount - vatAmount;

  const created = await prisma.transaction.create({
    data: {
      userId: userIdStr,
      type: transaction.type?.toUpperCase() as "INCOME" | "EXPENSE" || "EXPENSE",
      amount: amount,
      vatRate: vatRate,
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      netAmount: parseFloat(netAmount.toFixed(2)),
      recognizedVatAmount: parseFloat(vatAmount.toFixed(2)),
      date: transaction.date ? new Date(transaction.date) : new Date(),
      merchant: transaction.description || "Transaction",
      description: transaction.description || "",
      category: transaction.category || "Uncategorized",
      receiptUrl: transaction.document_path || null,
    },
  });

  return created.id;
}

export async function getTransactionsByUser(
  userId: string | number,
  status?: "DRAFT" | "COMPLETED"
): Promise<Transaction[]> {
  const userIdStr = typeof userId === "number" ? String(userId) : userId;

  // Build where clause
  const where: any = {
    userId: userIdStr,
  };

  // Apply status filter based on "Money Talks" rule
  if (status === "DRAFT") {
    where.amount = 0;
  } else if (status === "COMPLETED") {
    where.amount = { gt: 0 };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return transactions.map((tx) => ({
    id: tx.id,
    user_id: tx.userId,
    type: tx.type.toLowerCase() as "income" | "expense",
    amount: tx.amount,
    vat_amount: tx.vatAmount,
    date: tx.date.toISOString().split("T")[0],
    description: tx.description || tx.merchant,
    category: tx.category,
    is_vat_deductible: true,
    document_path: tx.receiptUrl || undefined,
    status: tx.amount === 0 ? "DRAFT" : "COMPLETED",
    created_at: tx.createdAt.toISOString(),
  }));
}

export async function getTransactionsByDateRange(
  userId: string | number,
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  const userIdStr = typeof userId === "number" ? String(userId) : userId;

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: userIdStr,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    orderBy: { date: "desc" },
  });

  return transactions.map((tx) => ({
    id: tx.id,
    user_id: tx.userId,
    type: tx.type.toLowerCase() as "income" | "expense",
    amount: tx.amount,
    vat_amount: tx.vatAmount,
    date: tx.date.toISOString().split("T")[0],
    description: tx.description || tx.merchant,
    category: tx.category,
    is_vat_deductible: true,
    document_path: tx.receiptUrl || undefined,
    status: tx.amount === 0 ? "DRAFT" : "COMPLETED",
    created_at: tx.createdAt.toISOString(),
  }));
}

export async function getTransactionById(
  id: string | number
): Promise<Transaction | undefined> {
  const txId = typeof id === "number" ? String(id) : id;

  const tx = await prisma.transaction.findUnique({
    where: { id: txId },
  });

  if (!tx) return undefined;

  return {
    id: tx.id,
    user_id: tx.userId,
    type: tx.type.toLowerCase() as "income" | "expense",
    amount: tx.amount,
    vat_amount: tx.vatAmount,
    date: tx.date.toISOString().split("T")[0],
    description: tx.description || tx.merchant,
    category: tx.category,
    is_vat_deductible: true,
    document_path: tx.receiptUrl || undefined,
    status: tx.amount === 0 ? "DRAFT" : "COMPLETED",
    created_at: tx.createdAt.toISOString(),
  };
}

export async function updateTransactionDocument(
  id: string | number,
  documentPath: string
) {
  const txId = typeof id === "number" ? String(id) : id;

  const updated = await prisma.transaction.update({
    where: { id: txId },
    data: { receiptUrl: documentPath },
  });

  return { changes: 1 }; // For backward compatibility
}

export async function updateTransaction(
  id: string | number,
  updates: Partial<Omit<Transaction, "id" | "user_id" | "created_at">>
) {
  const txId = typeof id === "number" ? String(id) : id;

  const data: any = {};

  if (updates.type !== undefined) {
    data.type = updates.type.toUpperCase();
  }
  if (updates.amount !== undefined) {
    const vatRate = 0.18;
    const amount = updates.amount;
    const vatAmount = amount > 0 ? (amount * vatRate) / (1 + vatRate) : 0;
    const netAmount = amount - vatAmount;

    data.amount = amount;
    data.vatAmount = parseFloat(vatAmount.toFixed(2));
    data.netAmount = parseFloat(netAmount.toFixed(2));
    data.recognizedVatAmount = parseFloat(vatAmount.toFixed(2));
  }
  if (updates.vat_amount !== undefined) {
    data.vatAmount = updates.vat_amount;
  }
  if (updates.date !== undefined) {
    data.date = new Date(updates.date);
  }
  if (updates.description !== undefined) {
    data.description = updates.description;
    data.merchant = updates.description;
  }
  if (updates.category !== undefined) {
    data.category = updates.category || "Uncategorized";
  }
  if (updates.document_path !== undefined) {
    data.receiptUrl = updates.document_path || null;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No fields to update");
  }

  const updated = await prisma.transaction.update({
    where: { id: txId },
    data,
  });

  return { changes: 1 }; // For backward compatibility
}

export async function deleteTransaction(id: string | number) {
  const txId = typeof id === "number" ? String(id) : id;

  await prisma.transaction.delete({
    where: { id: txId },
  });

  return { changes: 1 }; // For backward compatibility
}

// VAT Summary calculations
export interface VATSummary {
  totalIncome: number;
  totalExpenses: number;
  totalVATOnIncome: number;
  totalDeductibleVAT: number;
  vatToPay: number;
}

export async function calculateVATSummary(
  userId: string | number,
  startDate: string,
  endDate: string
): Promise<VATSummary> {
  const transactions = await getTransactionsByDateRange(
    userId,
    startDate,
    endDate
  );

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalVATOnIncome = 0;
  let totalDeductibleVAT = 0;

  transactions.forEach((t) => {
    if (t.type === "income") {
      totalIncome += t.amount || 0;
      totalVATOnIncome += t.vat_amount || 0;
    } else if (t.type === "expense") {
      totalExpenses += t.amount || 0;
      if (t.is_vat_deductible) {
        totalDeductibleVAT += t.vat_amount || 0;
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
