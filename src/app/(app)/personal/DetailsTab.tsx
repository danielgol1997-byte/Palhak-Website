"use client";

import { useState, useEffect } from "react";
import { ClothingSize, ShoeSize, Weapon } from "@prisma/client";
import { updatePersonalDetailsAction } from "./actions";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface User {
  id: string;
  name: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  personalNumber?: string | null;
  phoneNumber?: string | null;
  shirtSize?: ClothingSize | null;
  pantsSize?: ClothingSize | null;
  shoeSize?: ShoeSize | null;
  weapon?: Weapon | null;
  weaponItemId?: string | null;
  userDepartments: Array<{
    department: {
      id: string;
      name: string;
    };
  }>;
  userPositions: Array<{
    position: {
      id: string;
      name: string;
    };
  }>;
}

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  departmentId: string;
}

interface WeaponItem {
  id: string;
  name: string;
}

interface DetailsTabProps {
  user: User;
  departments: Department[];
  positions: Position[];
  weaponItems: WeaponItem[];
}

export function DetailsTab({ user, departments, positions, weaponItems }: DetailsTabProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Form state
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || "");
  const [personalNumber, setPersonalNumber] = useState(user.personalNumber || "");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(user.userDepartments[0]?.department.id || "");
  const [selectedPositionId, setSelectedPositionId] = useState(user.userPositions[0]?.position.id || "");
  const [shirtSize, setShirtSize] = useState(user.shirtSize || "");
  const [pantsSize, setPantsSize] = useState(user.pantsSize || "");
  const [shoeSize, setShoeSize] = useState(user.shoeSize || "");
  const [weaponItemId, setWeaponItemId] = useState(user.weaponItemId || "");

  // Filter positions based on selected department
  const availablePositions = selectedDepartmentId
    ? positions.filter(pos => pos.departmentId === selectedDepartmentId)
    : [];

  // Track changes
  useEffect(() => {
    if (isEditing) {
      const changed = 
        firstName !== (user.firstName || "") ||
        lastName !== (user.lastName || "") ||
        phoneNumber !== (user.phoneNumber || "") ||
        personalNumber !== (user.personalNumber || "") ||
        selectedDepartmentId !== (user.userDepartments[0]?.department.id || "") ||
        selectedPositionId !== (user.userPositions[0]?.position.id || "") ||
        shirtSize !== (user.shirtSize || "") ||
        pantsSize !== (user.pantsSize || "") ||
        shoeSize !== (user.shoeSize || "") ||
        weaponItemId !== (user.weaponItemId || "");
      
      setHasUnsavedChanges(changed);
    }
  }, [isEditing, firstName, lastName, phoneNumber, personalNumber, selectedDepartmentId, selectedPositionId, shirtSize, pantsSize, shoeSize, weaponItemId, user]);

  // Warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm("יש שינויים שלא נשמרו. האם אתה בטוח שברצונך לבטל?")) {
        return;
      }
    }
    
    // Reset form to original values
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhoneNumber(user.phoneNumber || "");
    setPersonalNumber(user.personalNumber || "");
    setSelectedDepartmentId(user.userDepartments[0]?.department.id || "");
    setSelectedPositionId(user.userPositions[0]?.position.id || "");
    setShirtSize(user.shirtSize || "");
    setPantsSize(user.pantsSize || "");
    setShoeSize(user.shoeSize || "");
    setWeaponItemId(user.weaponItemId || "");
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setError(null);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("phoneNumber", phoneNumber);
    formData.append("personalNumber", personalNumber);
    formData.append("departmentId", selectedDepartmentId);
    formData.append("positionId", selectedPositionId);
    formData.append("shirtSize", shirtSize);
    formData.append("pantsSize", pantsSize);
    formData.append("shoeSize", shoeSize);
    formData.append("weaponItemId", weaponItemId);

    try {
      const result = await updatePersonalDetailsAction(formData);

      if (result.success) {
        setIsEditing(false);
        setHasUnsavedChanges(false);
        router.refresh();
      } else {
        setError(result.error || "שגיאה לא ידועה.");
      }
    } catch (err) {
      setError("אירעה שגיאה. נסה שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const departments_display = user.userDepartments.map((ud) => ud.department.name).join(", ") || "לא הוזן";
  const positions_display = user.userPositions.map((up) => up.position.name).join(", ") || "לא הוזן";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-50">פרטים אישיים</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {isEditing ? "ערוך את הפרטים האישיים שלך" : "הפרטים האישיים שלך"}
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="h-12 px-6 rounded-xl bg-zinc-50 text-zinc-950 font-bold text-sm hover:bg-zinc-200 transition-all cursor-pointer"
          >
            ערוך פרטים
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-900/20 border border-red-900/40 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        {/* Personal Details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold text-zinc-400 mb-2 block">שם פרטי *</label>
            {isEditing ? (
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
              />
            ) : (
              <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 flex items-center">
                {user.firstName || "לא הוזן"}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-bold text-zinc-400 mb-2 block">שם משפחה *</label>
            {isEditing ? (
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
              />
            ) : (
              <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 flex items-center">
                {user.lastName || "לא הוזן"}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold text-zinc-400 mb-2 block">אימייל</label>
            <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-400 flex items-center">
              {user.email}
              <span className="mr-2 text-xs text-zinc-600">(לא ניתן לעריכה)</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-zinc-400 mb-2 block">מספר טלפון *</label>
            {isEditing ? (
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                pattern="[0-9]{10}"
                required
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
                placeholder="0501234567"
              />
            ) : (
              <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 flex items-center">
                {user.phoneNumber || "לא הוזן"}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-zinc-400 mb-2 block">מספר אישי *</label>
          {isEditing ? (
            <input
              type="text"
              value={personalNumber}
              onChange={(e) => setPersonalNumber(e.target.value)}
              required
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
            />
          ) : (
            <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 flex items-center">
              {user.personalNumber || "לא הוזן"}
            </div>
          )}
        </div>

        {/* Unit Details */}
        <div className="pt-4 border-t border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-50 mb-4">פרטי יחידה</h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-zinc-400 mb-2 block">מחלקה *</label>
              {isEditing ? (
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => {
                    setSelectedDepartmentId(e.target.value);
                    setSelectedPositionId(""); // Reset position when department changes
                  }}
                  required
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
                >
                  <option value="">בחר מחלקה</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 flex items-center">
                  {departments_display}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-bold text-zinc-400 mb-2 block">תפקיד *</label>
              {isEditing ? (
                <select
                  value={selectedPositionId}
                  onChange={(e) => setSelectedPositionId(e.target.value)}
                  required
                  disabled={!selectedDepartmentId}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {selectedDepartmentId ? "בחר תפקיד" : "בחר מחלקה תחילה"}
                  </option>
                  {availablePositions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 flex items-center">
                  {positions_display}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Equipment Details */}
        <div className="pt-4 border-t border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-50 mb-4">פרטי ציוד</h3>
          
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-bold text-zinc-400 mb-2 block">מידת חולצה *</label>
              {isEditing ? (
                <select
                  value={shirtSize}
                  onChange={(e) => setShirtSize(e.target.value)}
                  required
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
                >
                  <option value="">בחר מידה</option>
                  <option value={ClothingSize.XS}>XS</option>
                  <option value={ClothingSize.S}>S</option>
                  <option value={ClothingSize.M}>M</option>
                  <option value={ClothingSize.L}>L</option>
                  <option value={ClothingSize.XL}>XL</option>
                  <option value={ClothingSize.XXL}>XXL</option>
                  <option value={ClothingSize.XXXL}>XXXL</option>
                </select>
              ) : (
                <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 flex items-center">
                  {user.shirtSize || "לא הוזן"}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-bold text-zinc-400 mb-2 block">מידת מכנס *</label>
              {isEditing ? (
                <select
                  value={pantsSize}
                  onChange={(e) => setPantsSize(e.target.value)}
                  required
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
                >
                  <option value="">בחר מידה</option>
                  <option value={ClothingSize.XS}>XS</option>
                  <option value={ClothingSize.S}>S</option>
                  <option value={ClothingSize.M}>M</option>
                  <option value={ClothingSize.L}>L</option>
                  <option value={ClothingSize.XL}>XL</option>
                  <option value={ClothingSize.XXL}>XXL</option>
                  <option value={ClothingSize.XXXL}>XXXL</option>
                </select>
              ) : (
                <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 flex items-center">
                  {user.pantsSize || "לא הוזן"}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-bold text-zinc-400 mb-2 block">מידת נעליים *</label>
              {isEditing ? (
                <select
                  value={shoeSize}
                  onChange={(e) => setShoeSize(e.target.value)}
                  required
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
                >
                  <option value="">בחר מידה</option>
                  <option value={ShoeSize.SIZE_36}>36</option>
                  <option value={ShoeSize.SIZE_37}>37</option>
                  <option value={ShoeSize.SIZE_38}>38</option>
                  <option value={ShoeSize.SIZE_39}>39</option>
                  <option value={ShoeSize.SIZE_40}>40</option>
                  <option value={ShoeSize.SIZE_41}>41</option>
                  <option value={ShoeSize.SIZE_42}>42</option>
                  <option value={ShoeSize.SIZE_43}>43</option>
                  <option value={ShoeSize.SIZE_44}>44</option>
                  <option value={ShoeSize.SIZE_45}>45</option>
                  <option value={ShoeSize.SIZE_46}>46</option>
                  <option value={ShoeSize.SIZE_47}>47</option>
                  <option value={ShoeSize.SIZE_48}>48</option>
                </select>
              ) : (
                <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 flex items-center">
                  {user.shoeSize ? user.shoeSize.replace('SIZE_', '') : "לא הוזן"}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm font-bold text-zinc-400 mb-2 block">נשק *</label>
            {isEditing ? (
              <select
                value={weaponItemId}
                onChange={(e) => setWeaponItemId(e.target.value)}
                required
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
              >
                <option value="">בחר נשק</option>
                {weaponItems.map((weapon) => (
                  <option key={weapon.id} value={weapon.id}>
                    {weapon.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 flex items-center">
                {weaponItems.find(w => w.id === user.weaponItemId)?.name || "לא הוזן"}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="pt-6 border-t border-zinc-800 flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSubmitting || !hasUnsavedChanges}
              className="flex-1 h-14 rounded-xl bg-zinc-50 text-zinc-950 font-bold text-base hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : "שמור שינויים"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1 h-14 rounded-xl border border-zinc-800 bg-zinc-800 text-zinc-50 font-bold text-base hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              ביטול
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
