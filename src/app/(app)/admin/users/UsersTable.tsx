"use client";

import { useState, useMemo } from "react";
import { Role, Division } from "@prisma/client";
import { roleLabel, divisionLabel } from "@/lib/he";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | "ALL">("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"active" | "inactive" | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="חיפוש לפי שם, אימייל או מספר אישי..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700"
        />
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
    </div>
  );
}

