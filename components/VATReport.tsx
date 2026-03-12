"use client";

import { useState, useEffect } from "react";
import { FileText, Copy, CheckCircle2 } from "lucide-react";

interface Transaction {
  id: string | number; // Support both CUID and legacy numeric IDs
  type: "income" | "expense";
  amount: number;
  vat_amount: number;
  recognized_vat_amount?: number; // CLAIMABLE VAT after category rules
  date: string;
  description: string;
  category?: string;
  is_vat_deductible: boolean;
}

interface VATCalculation {
  vatOnSales: number;
  vatOnInputs: number;
  finalBalance: number;
  periodStart: string;
  periodEnd: string;
  periodName: string;
}

interface VATReportProps {
  refreshTrigger: number;
}

export default function VATReport({ refreshTrigger }: VATReportProps) {
  const [calculation, setCalculation] = useState<VATCalculation | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchAndCalculateVAT();
  }, [refreshTrigger]);

  // Calculate current bi-monthly period
  const getCurrentBiMonthlyPeriod = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    // Determine which bi-monthly period we're in
    let periodStart: Date;
    let periodEnd: Date;
    let periodName: string;

    if (month <= 2) {
      // Jan-Feb
      periodStart = new Date(year, 0, 1);
      periodEnd = new Date(year, 1, 28);
      periodName = "ינואר-פברואר";
    } else if (month <= 4) {
      // Mar-Apr
      periodStart = new Date(year, 2, 1);
      periodEnd = new Date(year, 3, 30);
      periodName = "מרץ-אפריל";
    } else if (month <= 6) {
      // May-Jun
      periodStart = new Date(year, 4, 1);
      periodEnd = new Date(year, 5, 30);
      periodName = "מאי-יוני";
    } else if (month <= 8) {
      // Jul-Aug
      periodStart = new Date(year, 6, 1);
      periodEnd = new Date(year, 7, 31);
      periodName = "יולי-אוגוסט";
    } else if (month <= 10) {
      // Sep-Oct
      periodStart = new Date(year, 8, 1);
      periodEnd = new Date(year, 9, 31);
      periodName = "סספטמבר-אוקטובר";
    } else {
      // Nov-Dec
      periodStart = new Date(year, 10, 1);
      periodEnd = new Date(year, 11, 31);
      periodName = "נובמבר-דצמבר";
    }

    return {
      periodStart: periodStart.toISOString().split("T")[0],
      periodEnd: periodEnd.toISOString().split("T")[0],
      periodName: `${periodName} ${year}`,
    };
  };

  const fetchAndCalculateVAT = async () => {
    try {
      // IMPORTANT: Only fetch COMPLETED transactions (ignore DRAFT)
      const response = await fetch("/api/transactions?status=COMPLETED");
      const result = await response.json();

      if (result.success) {
        const transactions: Transaction[] = result.data;
        const period = getCurrentBiMonthlyPeriod();

        // Filter transactions for current bi-monthly period
        const periodTransactions = transactions.filter((t) => {
          return t.date >= period.periodStart && t.date <= period.periodEnd;
        });

        // Calculate VAT on Sales (עסקאות)
        const vatOnSales = periodTransactions
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + t.vat_amount, 0);

        // Calculate VAT on Inputs (תשומות) - only deductible expenses
        // CRITICAL FIX: Use RECOGNIZED VAT (not total VAT from receipts)
        const vatOnInputs = periodTransactions
          .filter((t) => t.type === "expense" && t.is_vat_deductible)
          .reduce((sum, t) => sum + (t.recognized_vat_amount || t.vat_amount), 0);

        // Calculate final balance (what needs to be paid)
        const finalBalance = vatOnSales - vatOnInputs;

        setCalculation({
          vatOnSales: parseFloat(vatOnSales.toFixed(2)),
          vatOnInputs: parseFloat(vatOnInputs.toFixed(2)),
          finalBalance: parseFloat(finalBalance.toFixed(2)),
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          periodName: period.periodName,
        });
      }
    } catch (error) {
      console.error("Error calculating VAT:", error);
    }
  };

  const copyToClipboard = async (value: number, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(value.toFixed(2));
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (!calculation) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold">דו״ח מע״מ דו-חודשי</h2>
          <p className="text-sm text-gray-600">{calculation.periodName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* VAT on Sales */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-green-800">
              מע״מ עסקאות
            </h3>
            <button
              onClick={() =>
                copyToClipboard(calculation.vatOnSales, "vatOnSales")
              }
              className="text-green-700 hover:text-green-900 transition-colors"
              title="העתק"
            >
              {copiedField === "vatOnSales" ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-green-700 mb-2">
            (מע״מ על הכנסות)
          </p>
          <div className="text-2xl font-bold text-green-900">
            ₪{calculation.vatOnSales.toFixed(2)}
          </div>
        </div>

        {/* VAT on Inputs */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-800">
              מע״מ תשומות
            </h3>
            <button
              onClick={() =>
                copyToClipboard(calculation.vatOnInputs, "vatOnInputs")
              }
              className="text-blue-700 hover:text-blue-900 transition-colors"
              title="העתק"
            >
              {copiedField === "vatOnInputs" ? (
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-blue-700 mb-2">
            (מע״מ ניתן לקיזוז)
          </p>
          <div className="text-2xl font-bold text-blue-900">
            ₪{calculation.vatOnInputs.toFixed(2)}
          </div>
        </div>

        {/* Final Balance */}
        <div
          className={`bg-gradient-to-br ${
            calculation.finalBalance >= 0
              ? "from-red-50 to-red-100 border-red-200"
              : "from-green-50 to-green-100 border-green-200"
          } border rounded-lg p-4`}
        >
          <div className="flex items-start justify-between mb-2">
            <h3
              className={`text-sm font-semibold ${
                calculation.finalBalance >= 0
                  ? "text-red-800"
                  : "text-green-800"
              }`}
            >
              {calculation.finalBalance >= 0 ? "לתשלום" : "להחזר"}
            </h3>
            <button
              onClick={() =>
                copyToClipboard(
                  Math.abs(calculation.finalBalance),
                  "finalBalance"
                )
              }
              className={`${
                calculation.finalBalance >= 0
                  ? "text-red-700 hover:text-red-900"
                  : "text-green-700 hover:text-green-900"
              } transition-colors`}
              title="העתק"
            >
              {copiedField === "finalBalance" ? (
                <CheckCircle2
                  className={`w-5 h-5 ${
                    calculation.finalBalance >= 0
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <p
            className={`text-xs ${
              calculation.finalBalance >= 0
                ? "text-red-700"
                : "text-green-700"
            } mb-2`}
          >
            (עסקאות - תשומות)
          </p>
          <div
            className={`text-2xl font-bold ${
              calculation.finalBalance >= 0
                ? "text-red-900"
                : "text-green-900"
            }`}
          >
            ₪{Math.abs(calculation.finalBalance).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Info message */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
        <p className="text-xs text-gray-600 text-center">
          לחץ על סמל ההעתקה ליד כל סכום כדי להעתיק לאתר רשות המיסים
        </p>
      </div>
    </div>
  );
}
