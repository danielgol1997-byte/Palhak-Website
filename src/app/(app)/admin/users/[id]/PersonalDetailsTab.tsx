"use client";

import { useState, useMemo } from "react";
import { Role, ClothingSize, ShoeSize } from "@prisma/client";
import { roleLabel } from "@/lib/he";
import { adminUpdateUserPersonalDetailsAction } from "./personal-actions";

interface PersonalDetailsTabProps {
  user: any;
  departments: any[];
  positions: any[];
}

export function PersonalDetailsTab({ user, departments, positions }: PersonalDetailsTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    user.userDepartments?.[0]?.departmentId || ""
  );
  const [selectedPositionId, setSelectedPositionId] = useState<string>(
    user.userPositions?.[0]?.positionId || ""
  );
  const [selectedRole, setSelectedRole] = useState<Role>(user.role);
  const [selectedActive, setSelectedActive] = useState<boolean>(user.active);
  const [selectedShirtSize, setSelectedShirtSize] = useState<string>(user.shirtSize || "");
  const [selectedPantsSize, setSelectedPantsSize] = useState<string>(user.pantsSize || "");
  const [selectedShoeSize, setSelectedShoeSize] = useState<string>(user.shoeSize || "");

  // Filter positions based on selected department
  const filteredPositions = useMemo(() => {
    if (!selectedDepartmentId) return [];
    return positions.filter(pos => pos.departmentId === selectedDepartmentId);
  }, [positions, selectedDepartmentId]);

  // Reset position when department changes to a different one
  const handleDepartmentChange = (newDeptId: string) => {
    setSelectedDepartmentId(newDeptId);
    setHasUnsavedChanges(true);
    
    // If the new department is different, check if current position is still valid
    if (newDeptId) {
      const isPositionValid = positions.some(
        pos => pos.id === selectedPositionId && pos.departmentId === newDeptId
      );
      if (!isPositionValid) {
        setSelectedPositionId(""); // Reset position if not valid for new department
      }
    } else {
      setSelectedPositionId(""); // Clear position if no department
    }
  };

  const handleSubmit = async (formData: FormData) => {
    if (!confirm("האם לשמור את השינויים?")) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      await adminUpdateUserPersonalDetailsAction(formData);
      setIsEditing(false);
      setHasUnsavedChanges(false);
      // Note: Page will refresh due to revalidatePath, so selectedDepartmentId will reset naturally
    } catch (err: any) {
      setError(err.message || "אירעה שגיאה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges && !confirm("יש שינויים שלא נשמרו. האם לבטל?")) {
      return;
    }
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setError(null);
    setSelectedDepartmentId(user.userDepartments?.[0]?.departmentId || "");
    setSelectedPositionId(user.userPositions?.[0]?.positionId || "");
    setSelectedRole(user.role);
    setSelectedActive(user.active);
    setSelectedShirtSize(user.shirtSize || "");
    setSelectedPantsSize(user.pantsSize || "");
    setSelectedShoeSize(user.shoeSize || "");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Edit/Save Buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-zinc-50">פרטים אישיים</h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-zinc-800 text-zinc-50 font-bold hover:bg-zinc-700 transition-all cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            עריכה
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => document.getElementById("personal-details-form")?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {isSubmitting ? "שומר..." : "שמירה"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50"
            >
              ביטול
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {hasUnsavedChanges && isEditing && (
        <div className="rounded-xl border border-orange-900/40 bg-orange-900/10 p-4 text-sm text-orange-400">
          ⚠️ יש שינויים שלא נשמרו
        </div>
      )}

      <form 
        id="personal-details-form"
        action={handleSubmit}
        onChange={() => setHasUnsavedChanges(true)}
        className="grid gap-6 sm:grid-cols-2"
      >
        <input type="hidden" name="userId" value={user.id} />

        {/* Name */}
        <div className="sm:col-span-2">
          <label className="text-sm font-bold text-zinc-400 mb-2 block">שם מלא</label>
          {isEditing ? (
            <input
              name="name"
              type="text"
              defaultValue={user.name}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
              required
            />
          ) : (
            <div className="h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-50">
              {user.name}
            </div>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">אימייל</label>
          {isEditing ? (
            <input
              name="email"
              type="email"
              defaultValue={user.email}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
              required
            />
          ) : (
            <div className="h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-50">
              {user.email}
            </div>
          )}
        </div>

        {/* Personal Number */}
        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">מספר אישי</label>
          {isEditing ? (
            <input
              name="personalNumber"
              type="text"
              defaultValue={user.personalNumber || ""}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
            />
          ) : (
            <div className="h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-50">
              {user.personalNumber || "-"}
            </div>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">טלפון</label>
          {isEditing ? (
            <input
              name="phoneNumber"
              type="text"
              defaultValue={user.phoneNumber || ""}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
            />
          ) : (
            <div className="h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-50">
              {user.phoneNumber || "-"}
            </div>
          )}
        </div>

        {/* Role */}
        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">תפקיד מערכת</label>
          {isEditing ? (
            <select
              name="role"
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value as Role);
                setHasUnsavedChanges(true);
              }}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
            >
              <option value={Role.USER}>{roleLabel(Role.USER)}</option>
              <option value={Role.ADMIN}>{roleLabel(Role.ADMIN)}</option>
              <option value={Role.SUPER_ADMIN}>{roleLabel(Role.SUPER_ADMIN)}</option>
              <option value={Role.THEME_MASTER}>{roleLabel(Role.THEME_MASTER)}</option>
            </select>
          ) : (
            <div className="h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-50">
              {roleLabel(user.role)}
            </div>
          )}
        </div>

        {/* Active Status */}
        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">סטטוס</label>
          {isEditing ? (
            <select
              name="active"
              value={String(selectedActive)}
              onChange={(e) => {
                setSelectedActive(e.target.value === "true");
                setHasUnsavedChanges(true);
              }}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
            >
              <option value="true">פעיל</option>
              <option value="false">לא פעיל</option>
            </select>
          ) : (
            <div className={`h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm font-bold ${user.active ? "text-emerald-400" : "text-red-400"}`}>
              {user.active ? "פעיל" : "לא פעיל"}
            </div>
          )}
        </div>

        {/* Sizes Section */}
        <div className="sm:col-span-2">
          <div className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 mt-4">מידות</div>
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Shirt Size */}
            <div>
              <label className="text-sm font-bold text-zinc-400 mb-2 block">מידת חולצה</label>
              {isEditing ? (
                <select
                  name="shirtSize"
                  value={selectedShirtSize}
                  onChange={(e) => {
                    setSelectedShirtSize(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                >
                  <option value="">לא צוין</option>
                  <option value={ClothingSize.XS}>XS</option>
                  <option value={ClothingSize.S}>S</option>
                  <option value={ClothingSize.M}>M</option>
                  <option value={ClothingSize.L}>L</option>
                  <option value={ClothingSize.XL}>XL</option>
                  <option value={ClothingSize.XXL}>XXL</option>
                  <option value={ClothingSize.XXXL}>XXXL</option>
                </select>
              ) : (
                <div className="h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-50">
                  {user.shirtSize || "-"}
                </div>
              )}
            </div>

            {/* Pants Size */}
            <div>
              <label className="text-sm font-bold text-zinc-400 mb-2 block">מידת מכנסיים</label>
              {isEditing ? (
                <select
                  name="pantsSize"
                  value={selectedPantsSize}
                  onChange={(e) => {
                    setSelectedPantsSize(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                >
                  <option value="">לא צוין</option>
                  <option value={ClothingSize.XS}>XS</option>
                  <option value={ClothingSize.S}>S</option>
                  <option value={ClothingSize.M}>M</option>
                  <option value={ClothingSize.L}>L</option>
                  <option value={ClothingSize.XL}>XL</option>
                  <option value={ClothingSize.XXL}>XXL</option>
                  <option value={ClothingSize.XXXL}>XXXL</option>
                </select>
              ) : (
                <div className="h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-50">
                  {user.pantsSize || "-"}
                </div>
              )}
            </div>

            {/* Shoe Size */}
            <div>
              <label className="text-sm font-bold text-zinc-400 mb-2 block">מידת נעליים</label>
              {isEditing ? (
                <select
                  name="shoeSize"
                  value={selectedShoeSize}
                  onChange={(e) => {
                    setSelectedShoeSize(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
                >
                  <option value="">לא צוין</option>
                  {Object.values(ShoeSize).map((size) => (
                    <option key={size} value={size}>{size.replace("SIZE_", "")}</option>
                  ))}
                </select>
              ) : (
                <div className="h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-50">
                  {user.shoeSize ? user.shoeSize.replace("SIZE_", "") : "-"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Department */}
        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">מחלקה</label>
          {isEditing ? (
            <select
              name="departmentId"
              value={selectedDepartmentId}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none"
            >
              <option value="">לא משויך</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          ) : (
            <div className="h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-50">
              {user.userDepartments?.[0]?.department?.name || "-"}
            </div>
          )}
        </div>

        {/* Position */}
        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">תפקיד</label>
          {isEditing ? (
            <select
              name="positionId"
              value={selectedPositionId}
              onChange={(e) => {
                setSelectedPositionId(e.target.value);
                setHasUnsavedChanges(true);
              }}
              disabled={!selectedDepartmentId}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedDepartmentId ? "לא משויך" : "בחר מחלקה תחילה"}
              </option>
              {filteredPositions.map((pos) => (
                <option key={pos.id} value={pos.id}>{pos.name}</option>
              ))}
            </select>
          ) : (
            <div className="h-12 flex items-center px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-50">
              {user.userPositions?.[0]?.position?.name || "-"}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

