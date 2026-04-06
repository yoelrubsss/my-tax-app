"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { User as UserIcon, Building2, Home, Users, Car, Save, ArrowRight, Phone, QrCode, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import ThemeToggle from "@/components/ThemeToggle";
import { devLog } from "@/lib/dev-log";

interface SettingsForm {
  businessName: string;
  businessType: "OSEK_PATUR" | "OSEK_MURSHE" | "LTD";
  isHomeOffice: boolean;
  hasChildren: boolean;
  childrenCount: number;
  hasVehicle: boolean;
  whatsappPhone: string;
  whatsappPhone2: string;
}

const BUSINESS_TYPES = ["OSEK_PATUR", "OSEK_MURSHE", "LTD"] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Safe string for display/alerts — never passes through raw Event objects. */
function formatUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "number" || typeof err === "boolean") return String(err);
  // Avoid [object Event] / [object Object] in UI
  if (typeof Event !== "undefined" && err instanceof Event) {
    return "Something went wrong (invalid event).";
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function parseSettingsData(raw: unknown): Partial<SettingsForm> | null {
  if (!isRecord(raw)) return null;
  const d = raw;
  const bt = d.business_type ?? d.businessType;
  const businessType =
    typeof bt === "string" && (BUSINESS_TYPES as readonly string[]).includes(bt)
      ? (bt as SettingsForm["businessType"])
      : "OSEK_MURSHE";

  const childrenRaw = d.children_count ?? d.childrenCount;
  let childrenCount = 0;
  if (typeof childrenRaw === "number" && Number.isFinite(childrenRaw)) {
    childrenCount = Math.max(0, Math.min(20, Math.floor(childrenRaw)));
  } else if (typeof childrenRaw === "string" && childrenRaw.trim() !== "") {
    const n = parseInt(childrenRaw, 10);
    if (!Number.isNaN(n)) childrenCount = Math.max(0, Math.min(20, n));
  }

  const str = (v: unknown) => (typeof v === "string" ? v : v != null ? String(v) : "");

  return {
    businessName: str(d.business_name ?? d.businessName).trim(),
    businessType,
    isHomeOffice: Boolean(d.is_home_office ?? d.isHomeOffice),
    hasChildren: Boolean(d.has_children ?? d.hasChildren),
    childrenCount,
    hasVehicle: Boolean(d.has_vehicle ?? d.hasVehicle),
    whatsappPhone: str(d.whatsapp_phone ?? d.whatsappPhone).trim(),
    whatsappPhone2: str(d.whatsapp_phone_2 ?? d.whatsappPhone2).trim(),
  };
}

export default function SettingsPage() {
  const { refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SettingsForm>({
    businessName: "",
    businessType: "OSEK_MURSHE",
    isHomeOffice: false,
    hasChildren: false,
    childrenCount: 0,
    hasVehicle: false,
    whatsappPhone: "",
    whatsappPhone2: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        console.error("❌ Settings API returned non-JSON");
        return;
      }

      devLog("📥 Settings API response:", result);

      if (!isRecord(result) || !result.success) {
        console.warn("⚠️ Settings API returned no data or failed:", result);
        return;
      }

      const parsed = parseSettingsData(result.data);
      if (!parsed) {
        console.warn("⚠️ Settings API data shape unexpected:", result.data);
        return;
      }

      setForm((prev) => ({
        ...prev,
        ...parsed,
        businessName: parsed.businessName ?? "",
        businessType: parsed.businessType ?? "OSEK_MURSHE",
        isHomeOffice: parsed.isHomeOffice ?? false,
        hasChildren: parsed.hasChildren ?? false,
        childrenCount: parsed.childrenCount ?? 0,
        hasVehicle: parsed.hasVehicle ?? false,
        whatsappPhone: parsed.whatsappPhone ?? "",
        whatsappPhone2: parsed.whatsappPhone2 ?? "",
      }));

      devLog("✅ Settings form populated");
    } catch (error) {
      console.error("❌ Error fetching settings:", formatUnknownError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    setSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: form.businessName,
          business_type: form.businessType,
          is_home_office: form.isHomeOffice,
          has_children: form.hasChildren,
          children_count: form.hasChildren ? form.childrenCount : 0,
          has_vehicle: form.hasVehicle,
          whatsapp_phone: form.whatsappPhone || null,
          whatsapp_phone_2: form.whatsappPhone2 || null,
        }),
      });

      let result: unknown;
      try {
        result = await response.json();
      } catch {
        alert("❌ שגיאה בשמירת ההגדרות: תגובה לא תקינה מהשרת");
        return;
      }

      if (isRecord(result) && result.success) {
        try {
          await refreshUser();
        } catch (refreshErr) {
          console.error("refreshUser failed:", formatUnknownError(refreshErr));
        }
        router.replace("/");
      } else {
        const errMsg = isRecord(result) ? result.error : undefined;
        const text =
          typeof errMsg === "string"
            ? errMsg
            : errMsg != null
              ? formatUnknownError(errMsg)
              : "שמירה נכשלה";
        alert("❌ שגיאה בשמירת ההגדרות: " + text);
      }
    } catch (error) {
      console.error("Error saving settings:", formatUnknownError(error));
      alert("❌ שגיאה בשמירת ההגדרות: " + formatUnknownError(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ui-surface flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-text-muted">טוען הגדרות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-surface min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="mx-auto mb-6 max-w-3xl">
        <button
          onClick={() => router.push("/")}
          className="mb-4 flex items-center gap-2 text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowRight className="h-5 w-5" />
          חזרה לדף הראשי
        </button>

        <div className="rounded-lg border border-blue-500/30 bg-gradient-to-l from-blue-600 to-blue-700 p-6 text-white shadow-sm dark:border-blue-900/70 dark:from-blue-900 dark:to-blue-950">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <UserIcon className="h-10 w-10" />
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">הגדרות פרופיל</h1>
                <p className="mt-1 text-sm text-blue-100 md:text-base">
                  עדכן את הפרטים שלך לשיפור דיוק המערכת
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="mx-auto max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Name */}
          <div className="ui-card p-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
              <Building2 className="w-5 h-5 text-blue-600" />
              שם העסק
            </label>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="לדוגמה: סטודיו לעיצוב גרפי"
              className="ui-input px-4 py-3"
            />
            <p className="mt-2 text-xs text-text-muted">
              שם העסק שלך (אופציונלי)
            </p>
          </div>

          {/* Business Type */}
          <div className="ui-card p-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
              <Building2 className="w-5 h-5 text-blue-600" />
              סוג העסק
            </label>
            <select
              value={form.businessType}
              onChange={(e) => {
                const v = e.target.value;
                if ((BUSINESS_TYPES as readonly string[]).includes(v)) {
                  setForm({ ...form, businessType: v as SettingsForm["businessType"] });
                }
              }}
              className="ui-input px-4 py-3"
            >
              <option value="OSEK_PATUR">עוסק פטור (מחזור עד 102,292 ₪)</option>
              <option value="OSEK_MURSHE">עוסק מורשה (מחזור מעל 102,292 ₪)</option>
              <option value="LTD">חברה בע״מ</option>
            </select>
            <p className="mt-2 text-xs text-text-muted">
              סוג הרישוי העסקי שלך משפיע על חישובי המע״מ
            </p>
          </div>

          {/* Home Office */}
          <div className="ui-card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Home className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    משרד ביתי
                  </label>
                  <p className="text-xs text-text-muted">
                    האם אתה עובד מהבית? (משפיע על ניכוי הוצאות משרד, חשמל, אינטרנט)
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isHomeOffice}
                onClick={() => setForm({ ...form, isHomeOffice: !form.isHomeOffice })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  form.isHomeOffice ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`pointer-events-none absolute top-1 size-4 rounded-full bg-white shadow transition-all duration-200 ease-in-out ${
                    form.isHomeOffice ? "start-[calc(100%-1.25rem)]" : "start-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Children */}
          <div className="ui-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    יש לי ילדים
                  </label>
                  <p className="text-xs text-text-muted">
                    משפיע על נקודות זיכוי במס הכנסה
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, hasChildren: !form.hasChildren, childrenCount: !form.hasChildren ? 1 : 0 })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  form.hasChildren ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`pointer-events-none absolute top-1 size-4 rounded-full bg-white shadow transition-all duration-200 ease-in-out ${
                    form.hasChildren ? "start-[calc(100%-1.25rem)]" : "start-1"
                  }`}
                />
              </button>
            </div>

            {/* Children Count */}
            {form.hasChildren && (
              <div className="mt-4 border-t border-border pt-4">
                <label className="mb-2 block text-sm font-medium text-text">
                  מספר ילדים
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={form.childrenCount}
                  onChange={(e) => setForm({ ...form, childrenCount: parseInt(e.target.value) || 0 })}
                  className="ui-input px-4 py-3"
                />
              </div>
            )}
          </div>

          {/* Vehicle */}
          <div className="ui-card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Car className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    רכב עסקי
                  </label>
                  <p className="text-xs text-text-muted">
                    האם יש לך רכב? (משפיע על ניכוי דלק, חניה, תחזוקה)
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.hasVehicle}
                onClick={() => setForm({ ...form, hasVehicle: !form.hasVehicle })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  form.hasVehicle ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`pointer-events-none absolute top-1 size-4 rounded-full bg-white shadow transition-all duration-200 ease-in-out ${
                    form.hasVehicle ? "start-[calc(100%-1.25rem)]" : "start-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* WhatsApp Integration */}
          <div className="ui-card p-6">
            <div className="flex items-start gap-3 mb-4">
              <Phone className="w-5 h-5 text-green-600 mt-1" />
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-text">
                  מספר טלפון לחיבור וואטסאפ
                </label>
                <p className="mb-3 text-xs text-text-muted">
                  הזן את המספר שממנו תשלח קבלות (לדוגמה: 052-1234567)
                </p>
                <input
                  type="tel"
                  value={form.whatsappPhone}
                  onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
                  placeholder="052-1234567"
                  dir="ltr"
                  className="ui-input px-4 py-3 text-left"
                />
                <label className="mb-1 mt-4 block text-sm font-medium text-text">
                  מספר נוסף (אופציונלי)
                </label>
                <p className="mb-2 text-xs text-text-muted">
                  אופציונלי: מספר נוסף לקבלות (למשל מכשיר או עובד).
                </p>
                <input
                  type="tel"
                  value={form.whatsappPhone2}
                  onChange={(e) => setForm({ ...form, whatsappPhone2: e.target.value })}
                  placeholder="052-9876543"
                  dir="ltr"
                  className="ui-input px-4 py-3 text-left"
                />
              </div>
            </div>

            {/* Instructions - Show when phone is saved */}
            {(form.whatsappPhone || form.whatsappPhone2) && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-900 mb-3 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    כיצד לשלוח קבלות דרך וואטסאפ?
                  </p>

                  <div className="grid md:grid-cols-[1fr_auto] gap-4">
                    {/* Instructions */}
                    <div className="space-y-3">
                      <ol className="text-sm text-green-800 space-y-2 list-decimal list-inside">
                        <li>
                          לחץ על המספר או סרוק את הקוד:{" "}
                          <a
                            href="https://wa.me/15551426760"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-green-700 hover:text-green-900 underline underline-offset-2 inline-flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            +1 (555) 142-6760
                          </a>
                        </li>
                        <li>שלח הודעת WhatsApp עם תמונה של הקבלה</li>
                        <li>הקבלה תעובד אוטומטית ותופיע בתיבת הטיוטות תוך שניות!</li>
                      </ol>

                      {/* Mobile: Quick Connect Button */}
                      <a
                        href="https://wa.me/15551426760"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="md:hidden inline-flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-md"
                      >
                        <MessageCircle className="w-5 h-5" />
                        פתח WhatsApp
                      </a>

                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs text-green-700">
                          💡 <strong>חשוב:</strong> רק הודעות מהמספרים
                          {form.whatsappPhone && (
                            <span className="font-mono font-semibold"> {form.whatsappPhone}</span>
                          )}
                          {form.whatsappPhone2 && (
                            <span className="font-mono font-semibold">
                              {form.whatsappPhone ? " / " : " "}
                              {form.whatsappPhone2}
                            </span>
                          )}{" "}
                          יעובדו אוטומטית
                        </p>
                      </div>
                    </div>

                    {/* QR Code - Desktop Only */}
                    <div className="hidden md:flex flex-col items-center justify-center rounded-lg border border-green-300 bg-card p-4">
                      <div className="mb-2">
                        <QRCodeSVG
                          value="https://wa.me/15551426760"
                          size={120}
                          level="M"
                          includeMargin={true}
                        />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-green-700">
                        <QrCode className="w-3 h-3" />
                        <span>סרוק עם המצלמה</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[3.25rem] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all duration-200 inline-flex items-center justify-center gap-3 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5 shrink-0" />
            {saving ? "שומר..." : "שמור הגדרות"}
          </button>
        </form>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-text">
            <strong>💡 למה זה חשוב?</strong> המערכת משתמשת בפרטים האלה כדי לספק המלצות מדויקות יותר על ניכויים מס, קיזוז מע״מ, וניהול הוצאות.
          </p>
        </div>
      </div>
    </div>
  );
}
