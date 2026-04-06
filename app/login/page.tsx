"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { LogIn, Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="auth-card">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-600">
              <LogIn className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">כניסה למערכת</h1>
            <p className="text-gray-600">ניהול מע״מ לעוסק מורשה</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="auth-label">
                <Mail className="h-4 w-4" />
                כתובת אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="auth-input pe-12"
                  disabled={loading}
                  autoComplete="current-password"
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

            <div className="text-left">
              <Link href="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                שכחת סיסמה?
              </Link>
            </div>

            <button type="submit" disabled={loading} className="auth-btn-primary">
              {loading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  מתחבר...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  כניסה
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              עדיין אין לך חשבון?{" "}
              <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-800">
                הרשמה
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">מערכת מאובטחת לניהול מע״מ</p>
      </div>
    </div>
  );
}
