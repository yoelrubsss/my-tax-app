"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { User, Building2, Home, Users, Car, Save, ArrowRight, Phone, QrCode, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

interface SettingsForm {
  businessName: string;
  businessType: "OSEK_PATUR" | "OSEK_MURSHE" | "LTD";
  isHomeOffice: boolean;
  hasChildren: boolean;
  childrenCount: number;
  hasVehicle: boolean;
  whatsappPhone: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
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
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      const result = await response.json();

      console.log("📥 Settings API response:", result);

      if (result.success && result.data) {
        const data = result.data;

        // CRITICAL FIX: Handle both snake_case (from API response mapper) and camelCase (from Prisma)
        setForm({
          businessName: data.business_name || data.businessName || "",
          businessType: data.business_type || data.businessType || "OSEK_MURSHE",
          isHomeOffice: !!(data.is_home_office ?? data.isHomeOffice ?? false),
          hasChildren: !!(data.has_children ?? data.hasChildren ?? false),
          childrenCount: data.children_count ?? data.childrenCount ?? 0,
          hasVehicle: !!(data.has_vehicle ?? data.hasVehicle ?? false),
          whatsappPhone: data.whatsapp_phone || data.whatsappPhone || "",
        });

        console.log("✅ Settings form populated:", {
          businessName: data.business_name || data.businessName,
          businessType: data.business_type || data.businessType,
          isHomeOffice: data.is_home_office ?? data.isHomeOffice,
          hasChildren: data.has_children ?? data.hasChildren,
          childrenCount: data.children_count ?? data.childrenCount,
          hasVehicle: data.has_vehicle ?? data.hasVehicle,
        });
      } else {
        console.warn("⚠️ Settings API returned no data or failed:", result);
      }
    } catch (error) {
      console.error("❌ Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert("✅ ההגדרות נשמרו בהצלחה!");
      } else {
        alert("❌ שגיאה בשמירת ההגדרות: " + result.error);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("❌ שגיאה בשמירת ההגדרות");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">טוען הגדרות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
          חזרה לדף הראשי
        </button>

        <div className="bg-gradient-to-l from-blue-600 to-blue-700 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center gap-4">
            <User className="w-10 h-10" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">הגדרות פרופיל</h1>
              <p className="text-blue-100 text-sm md:text-base mt-1">
                עדכן את הפרטים שלך לשיפור דיוק המערכת
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Name */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              שם העסק
            </label>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="לדוגמה: סטודיו לעיצוב גרפי"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-2">
              שם העסק שלך (אופציונלי)
            </p>
          </div>

          {/* Business Type */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              סוג העסק
            </label>
            <select
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value as any })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            >
              <option value="OSEK_PATUR">עוסק פטור (מחזור עד 102,292 ₪)</option>
              <option value="OSEK_MURSHE">עוסק מורשה (מחזור מעל 102,292 ₪)</option>
              <option value="LTD">חברה בע״מ</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">
              סוג הרישוי העסקי שלך משפיע על חישובי המע״מ
            </p>
          </div>

          {/* Home Office */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Home className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    משרד ביתי
                  </label>
                  <p className="text-xs text-gray-500">
                    האם אתה עובד מהבית? (משפיע על ניכוי הוצאות משרד, חשמל, אינטרנט)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, isHomeOffice: !form.isHomeOffice })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  form.isHomeOffice ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out ${
                    form.isHomeOffice ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Children */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    יש לי ילדים
                  </label>
                  <p className="text-xs text-gray-500">
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
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out ${
                    form.hasChildren ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Children Count */}
            {form.hasChildren && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  מספר ילדים
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={form.childrenCount}
                  onChange={(e) => setForm({ ...form, childrenCount: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
            )}
          </div>

          {/* Vehicle */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Car className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    רכב עסקי
                  </label>
                  <p className="text-xs text-gray-500">
                    האם יש לך רכב? (משפיע על ניכוי דלק, חניה, תחזוקה)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, hasVehicle: !form.hasVehicle })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  form.hasVehicle ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out ${
                    form.hasVehicle ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* WhatsApp Integration */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <Phone className="w-5 h-5 text-green-600 mt-1" />
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  מספר טלפון לחיבור וואטסאפ
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  הזן את המספר שממנו תשלח קבלות (לדוגמה: 052-1234567)
                </p>
                <input
                  type="tel"
                  value={form.whatsappPhone}
                  onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
                  placeholder="052-1234567"
                  dir="ltr"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 text-left"
                />
              </div>
            </div>

            {/* Instructions - Show when phone is saved */}
            {form.whatsappPhone && (
              <div className="mt-4 pt-4 border-t border-gray-200">
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
                          💡 <strong>חשוב:</strong> רק הודעות מהמספר {form.whatsappPhone} יעובדו אוטומטית
                        </p>
                      </div>
                    </div>

                    {/* QR Code - Desktop Only */}
                    <div className="hidden md:flex flex-col items-center justify-center bg-white rounded-lg p-4 border border-green-300">
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
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-3 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? "שומר..." : "שמור הגדרות"}
          </button>
        </form>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-gray-700">
            <strong>💡 למה זה חשוב?</strong> המערכת משתמשת בפרטים האלה כדי לספק המלצות מדויקות יותר על ניכויים מס, קיזוז מע״מ, וניהול הוצאות.
          </p>
        </div>
      </div>
    </div>
  );
}
