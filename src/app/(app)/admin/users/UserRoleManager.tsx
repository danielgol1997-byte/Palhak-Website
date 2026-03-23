"use client";

import { useState } from "react";
import { Role } from "@prisma/client";
import { roleLabel } from "@/lib/he";
import { superAdminUpdateUserRoleAction } from "./actions";

interface UserRoleManagerProps {
  userId: string;
  currentRole: Role;
  userName: string;
  isCurrentUser: boolean;
}

export function UserRoleManager({ userId, currentRole, userName, isCurrentUser }: UserRoleManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleChange = async (newRole: Role) => {
    if (isCurrentUser) {
      setError("לא ניתן לשנות את התפקיד שלך בעצמך");
      return;
    }

    if (!confirm(`האם אתה בטוח שברצונך לשנות את תפקיד ${userName} ל-${roleLabel(newRole)}?`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("role", newRole);
      await superAdminUpdateUserRoleAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message || "אירעה שגיאה בעדכון התפקיד");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleColor = (role: Role) => {
    switch (role) {
      case Role.SUPER_ADMIN:
        return "bg-purple-900/20 text-purple-400 border-purple-900/40";
      case Role.ADMIN:
        return "bg-blue-900/20 text-blue-400 border-blue-900/40";
      case Role.USER:
        return "bg-zinc-900/20 text-zinc-400 border-zinc-700";
      case Role.THEME_MASTER:
        return "bg-fuchsia-900/20 text-fuchsia-400 border-fuchsia-900/40";
      default:
        return "bg-zinc-900/20 text-zinc-400 border-zinc-700";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isCurrentUser || isSubmitting}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
          getRoleColor(currentRole)
        } ${
          isCurrentUser || isSubmitting
            ? "opacity-50 cursor-not-allowed"
            : "hover:opacity-80 cursor-pointer"
        }`}
        title={isCurrentUser ? "לא ניתן לשנות את התפקיד שלך" : "לחץ לשינוי תפקיד"}
      >
        {roleLabel(currentRole)}
        {!isCurrentUser && !isSubmitting && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {isOpen && !isCurrentUser && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-2 z-50 w-48 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl overflow-hidden">
            {Object.values(Role).map((role) => (
              <button
                key={role}
                onClick={() => handleRoleChange(role)}
                disabled={isSubmitting || role === currentRole}
                className={`w-full px-4 py-3 text-right text-sm font-medium transition-colors ${
                  role === currentRole
                    ? "bg-zinc-800 text-zinc-400 cursor-not-allowed"
                    : "text-zinc-50 hover:bg-zinc-800 cursor-pointer"
                } ${
                  isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{roleLabel(role)}</span>
                  {role === currentRole && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-emerald-400"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>
                {role === Role.SUPER_ADMIN && (
                  <div className="text-xs text-zinc-500 mt-1">
                    גישה מלאה לכל המערכת
                  </div>
                )}
                {role === Role.ADMIN && (
                  <div className="text-xs text-zinc-500 mt-1">
                    ניהול ציוד ובקשות
                  </div>
                )}
                {role === Role.USER && (
                  <div className="text-xs text-zinc-500 mt-1">
                    משתמש רגיל
                  </div>
                )}
                {role === Role.THEME_MASTER && (
                  <div className="text-xs text-fuchsia-500/70 mt-1">
                    ✨ יובל על חלל
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="absolute left-0 mt-2 w-64 rounded-xl border border-red-900/40 bg-red-900/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

