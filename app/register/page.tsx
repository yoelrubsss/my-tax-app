"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { UserPlus, Mail, Lock, User, Building, FileText, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    dealer_number: "",
    business_name: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    if (formData.password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }

    if (!/^\d{9}$/.test(formData.dealer_number)) {
      setError("מספר עוסק מורשה חייב להכיל 9 ספרות");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          dealer_number: formData.dealer_number,
          business_name: formData.business_name || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "ההרשמה נכשלה");
        setLoading(false);
        return;
      }

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const loginData = await loginResponse.json();

      if (loginData.success) {
        await refreshUser();
        router.push("/");
      } else {
        router.push("/login");
      }
    } catch (err) {
      setError("שגיאה בהרשמה. אנא נסה שנית.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="auth-card">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-600">
              <UserPlus className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">הרשמה למערכת</h1>
            <p className="text-gray-600">צור חשבון חדש לניהול מע״מ</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="auth-label">
                  <User className="h-4 w-4" />
                  שם מלא
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="ישראל ישראלי"
                  className="auth-input"
                  disabled={loading}
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="auth-label">
                  <Mail className="h-4 w-4" />
                  כתובת אימייל
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="your@email.com"
                  className="auth-input"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="auth-label">
                  <Lock className="h-4 w-4" />
                  סיסמה
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="לפחות 6 תווים"
                    className="auth-input pe-12"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-800"
                    disabled={loading}
                    aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="auth-label">
                  <CheckCircle className="h-4 w-4" />
                  אימות סיסמה
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="הזן סיסמה שנית"
                    className="auth-input pe-12"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-800"
                    disabled={loading}
                    aria-label={showConfirmPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="auth-label">
                  <FileText className="h-4 w-4" />
                  מספר עוסק מורשה
                </label>
                <input
                  type="text"
                  name="dealer_number"
                  value={formData.dealer_number}
                  onChange={handleChange}
                  required
                  placeholder="9 ספרות"
                  maxLength={9}
                  pattern="\d{9}"
                  className="auth-input"
                  disabled={loading}
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="auth-label">
                  <Building className="h-4 w-4" />
                  שם העסק (אופציונלי)
                </label>
                <input
                  type="text"
                  name="business_name"
                  value={formData.business_name}
                  onChange={handleChange}
                  placeholder="שם העסק שלך"
                  className="auth-input"
                  disabled={loading}
                  autoComplete="organization"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="auth-btn-primary mt-6">
              {loading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  נרשם...
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  הרשמה
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              כבר יש לך חשבון?{" "}
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-800">
                כניסה
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">מערכת מאובטחת לניהול מע״מ • כל הנתונים מוצפנים</p>
      </div>
    </div>
  );
}
