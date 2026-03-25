"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Role, Division } from "@prisma/client";
import { roleLabel, divisionLabel } from "@/lib/he";
import { adminCreateUserAction } from "./actions";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface User {
  id: string;
  name: string;
  email: string;
  personalNumber: string | null;
  role: Role;
  active: boolean;
  onboardedAt: Date | null;
  createdAt: Date;
  _count: {
    assignments: number;
  };
  userDepartments: {
    department: {
      name: string;
      division?: Division;
    };
  }[];
}

interface UsersTableProps {
  users: User[];
}

type SortField = "name" | "email" | "role" | "assignments" | "createdAt";
type SortDir = "asc" | "desc";

export function UsersTable({ users }: UsersTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | "ALL">("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"active" | "inactive" | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Create-user modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPersonalNumber, setCreatePersonalNumber] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createFullNamePreview = useMemo(() => {
    const f = createFirstName.trim();
    const l = createLastName.trim();
    if (!f && !l) return "";
    return `${f} ${l}`.trim();
  }, [createFirstName, createLastName]);

  const resetCreateForm = () => {
    setCreateEmail(""); setCreatePersonalNumber("");
    setCreatePhone(""); setCreateFirstName(""); setCreateLastName("");
    setCreateError(null); setIsCreating(false);
  };

  const handleCreateUser = async () => {
    setIsCreating(true);
    setCreateError(null);
    const fd = new FormData();
    fd.append("firstName", createFirstName.trim());
    fd.append("lastName", createLastName.trim());
    fd.append("email", createEmail);
    if (createPersonalNumber.trim()) fd.append("personalNumber", createPersonalNumber.trim());
    if (createPhone.trim()) fd.append("phoneNumber", createPhone.trim());
    const res = await adminCreateUserAction(fd);
    setIsCreating(false);
    if (!res.success) {
      setCreateError(res.error || "אירעה שגיאה");
    } else {
      setShowCreateModal(false);
      resetCreateForm();
      router.refresh();
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter((user) => {
      const matchesSearch = !searchQuery || 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.personalNumber && user.personalNumber.includes(searchQuery));
      
      const matchesRole = selectedRole === "ALL" || user.role === selectedRole;
      const matchesStatus = selectedStatus === "ALL" || 
        (selectedStatus === "active" && user.active) ||
        (selectedStatus === "inactive" && !user.active);
      
      return matchesSearch && matchesRole && matchesStatus;
    });

    return filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "email":
          aVal = a.email;
          bVal = b.email;
          break;
        case "role":
          aVal = a.role;
          bVal = b.role;
          break;
        case "assignments":
          aVal = a._count.assignments;
          bVal = b._count.assignments;
          break;
        case "createdAt":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" 
          ? aVal.localeCompare(bVal, "he") 
          : bVal.localeCompare(aVal, "he");
      } else {
        return sortDir === "asc" 
          ? (aVal as number) - (bVal as number) 
          : (bVal as number) - (aVal as number);
      }
    });
  }, [users, searchQuery, selectedRole, selectedStatus, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-zinc-600">↕</span>;
    return sortDir === "asc" ? <span className="text-zinc-50">↑</span> : <span className="text-zinc-50">↓</span>;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search + Create */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="חיפוש לפי שם, אימייל או מספר אישי..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700"
        />
        <button
          onClick={() => { setShowCreateModal(true); resetCreateForm(); }}
          className="h-12 inline-flex items-center gap-2 px-5 rounded-xl bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-600 transition-all cursor-pointer whitespace-nowrap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          צור משתמש
        </button>
      </div>

      {/* Results Count */}
      {(searchQuery || selectedRole !== "ALL" || selectedStatus !== "ALL") && (
        <div className="text-sm text-zinc-400">
          מציג <span className="font-bold text-zinc-200">{filteredAndSortedUsers.length}</span> מתוך <span className="font-bold text-zinc-200">{users.length}</span> משתמשים
        </div>
      )}

      {/* Table */}
      {filteredAndSortedUsers.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
          לא נמצאו משתמשים
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:bg-zinc-900 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    שם <SortIcon field="name" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right cursor-pointer hover:bg-zinc-900 transition-colors"
                  onClick={() => handleSort("email")}
                >
                  <div className="flex items-center gap-2">
                    אימייל <SortIcon field="email" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="flex flex-col gap-1">
                    <span>תפקיד</span>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as Role | "ALL")}
                      className="mt-1 px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="ALL">הכל</option>
                      <option value={Role.SUPER_ADMIN}>{roleLabel(Role.SUPER_ADMIN)}</option>
                      <option value={Role.ADMIN}>{roleLabel(Role.ADMIN)}</option>
                      <option value={Role.USER}>{roleLabel(Role.USER)}</option>
                      <option value={Role.THEME_MASTER}>{roleLabel(Role.THEME_MASTER)}</option>
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="flex flex-col gap-1">
                    <span>סטטוס</span>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value as "active" | "inactive" | "ALL")}
                      className="mt-1 px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="ALL">הכל</option>
                      <option value="active">פעיל</option>
                      <option value="inactive">לא פעיל</option>
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 text-right">מחלקה</th>
                <th 
                  className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-900 transition-colors"
                  onClick={() => handleSort("assignments")}
                >
                  <div className="flex items-center justify-center gap-2">
                    ציוד משויך <SortIcon field="assignments" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.map((user) => (
                <tr 
                  key={user.id} 
                  className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-4 py-4 text-sm font-bold text-zinc-50">
                    <a 
                      href={`/admin/users/${user.id}`}
                      className="hover:underline decoration-zinc-500 underline-offset-2"
                    >
                      {user.name}
                    </a>
                    {user.personalNumber && (
                      <div className="text-xs text-zinc-500 mt-0.5">
                        מ״א: {user.personalNumber}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {user.email}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    <span className={`inline-flex px-2 py-1 rounded-full font-bold border ${
                      user.role === Role.SUPER_ADMIN
                        ? "bg-purple-900/20 text-purple-400 border-purple-900/40"
                        : user.role === Role.ADMIN
                        ? "bg-blue-900/20 text-blue-400 border-blue-900/40"
                        : user.role === Role.THEME_MASTER
                        ? "bg-fuchsia-900/20 text-fuchsia-400 border-fuchsia-900/40"
                        : "bg-zinc-900/20 text-zinc-400 border-zinc-700"
                    }`}>
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs">
                    <span className={`inline-flex px-2 py-1 rounded-full font-bold border ${
                      user.active
                        ? "bg-emerald-900/20 text-emerald-400 border-emerald-900/40"
                        : "bg-red-900/20 text-red-400 border-red-900/40"
                    }`}>
                      {user.active ? "פעיל" : "לא פעיל"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {user.userDepartments[0]?.department.name || "-"}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg border border-zinc-700 bg-zinc-800 text-sm font-bold text-zinc-50">
                      {user._count.assignments}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <a
                      href={`/admin/users/${user.id}`}
                      className="inline-flex h-9 items-center justify-center px-4 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-100 hover:bg-zinc-700 transition-all cursor-pointer"
                    >
                      ניהול
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Create User Modal */}
      {showCreateModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto overscroll-contain p-4">
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => !isCreating && setShowCreateModal(false)} />
            <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-zinc-50">יצירת משתמש חדש</h3>
                <button onClick={() => !isCreating && setShowCreateModal(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer" disabled={isCreating}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <p className="text-sm text-zinc-400 mb-6">
                שדות חובה: שם פרטי, שם משפחה ואימייל (של חשבון Google). המערכת יוצרת אוטומטית שם מלא לתצוגה. שאר השדות אופציונליים — המשתמש ישלים אותם בכניסה הראשונה.
              </p>
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 mb-1 block">שם פרטי <span className="text-red-500">*</span></label>
                    <input type="text" value={createFirstName} onChange={(e) => setCreateFirstName(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-400 mb-1 block">שם משפחה <span className="text-red-500">*</span></label>
                    <input type="text" value={createLastName} onChange={(e) => setCreateLastName(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all" required />
                  </div>
                </div>
                {createFullNamePreview && (
                  <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/50 px-4 py-3 text-sm">
                    <span className="text-zinc-500">שם מלא שיוצג במערכת: </span>
                    <span className="font-bold text-zinc-200">{createFullNamePreview}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-zinc-400 mb-1 block">אימייל (Google) <span className="text-red-500">*</span></label>
                  <input type="email" dir="ltr" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)}
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all text-left" required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 mb-1 block">מספר אישי</label>
                    <input type="text" value={createPersonalNumber} onChange={(e) => setCreatePersonalNumber(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-400 mb-1 block">טלפון</label>
                    <input type="tel" dir="ltr" value={createPhone} onChange={(e) => setCreatePhone(e.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all text-left" />
                  </div>
                </div>

                {createError && (
                  <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3 text-sm text-red-400">{createError}</div>
                )}

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={handleCreateUser}
                    disabled={isCreating || !createFirstName.trim() || !createLastName.trim() || !createEmail.trim()}
                    className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? <LoadingSpinner size="sm" /> : "צור משתמש"}
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreating}
                    className="flex-1 h-12 inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-800 text-sm font-bold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50"
                  >ביטול</button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

