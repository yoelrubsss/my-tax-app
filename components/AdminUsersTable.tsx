"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export type AdminUserRow = {
  id: string;
  email: string;
  whatsappPhone: string | null;
  whatsappPhone2: string | null;
  createdAt: string;
  transactionCount: number;
};

interface AdminUsersTableProps {
  users: AdminUserRow[];
  currentAdminId: string;
}

export default function AdminUsersTable({
  users: initialUsers,
  currentAdminId,
}: AdminUsersTableProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, email: string) => {
    if (id === currentAdminId) {
      alert("לא ניתן למחוק את החשבון שלך בזמן שאתה מחובר.");
      return;
    }
    if (
      !window.confirm(
        `למחוק את המשתמש לצמיתות?\n\n${email}\n\nפעולה זו תמחק גם את כל העסקאות והנתונים הקשורים (מחיקה מדורגת).`
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(json.error || "מחיקה נכשלה");
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== id));
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("שגיאת רשת — נסה שוב.");
    } finally {
      setDeletingId(null);
    }
  };

  if (users.length === 0) {
    return (
      <p className="text-sm text-gray-500">אין משתמשים במערכת.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-right text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-700">
              מזהה
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-700">
              אימייל
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-700">
              WhatsApp
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-700">
              עסקאות
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-700">
              נוצר
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-700">
              פעולות
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u) => {
            const isSelf = u.id === currentAdminId;
            return (
              <tr key={u.id} className="hover:bg-gray-50/80">
                <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-gray-600" title={u.id}>
                  {u.id}
                </td>
                <td className="px-4 py-3 text-gray-900">{u.email}</td>
                <td className="px-4 py-3 text-gray-700" dir="ltr">
                  <span className="inline-block text-left">
                    {u.whatsappPhone ?? "—"}
                    {u.whatsappPhone2 ? (
                      <span className="block text-xs text-gray-500">
                        {u.whatsappPhone2}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-900">
                  {u.transactionCount}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {new Date(u.createdAt).toLocaleString("he-IL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={isSelf || deletingId === u.id}
                    onClick={() => handleDelete(u.id, u.email)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title={isSelf ? "לא ניתן למחוק את עצמך" : "מחק משתמש"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingId === u.id ? "…" : "מחק"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
