"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { completeOnboardingAction } from "./actions";
import { ClothingSize, ShoeSize } from "@prisma/client";

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

export function OnboardingForm({
  departments,
  positions,
  weaponItems,
}: {
  departments: Department[];
  positions: Position[];
  weaponItems: WeaponItem[];
}) {
  const router = useRouter();
  const { update } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");

  // Filter positions based on selected department
  const availablePositions = selectedDepartmentId
    ? positions.filter(pos => pos.departmentId === selectedDepartmentId)
    : [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await completeOnboardingAction(formData);

      if (result.success) {
        // Update the session to reflect the new onboardedAt value
        await update();
        router.push("/me");
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

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {error && (
        <div className="rounded-xl bg-red-900/20 border border-red-900/40 p-4 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Personal Details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="block text-sm font-bold text-zinc-400 mb-2">
            שם פרטי *
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            required
            className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
            placeholder="לדוגמה: דוד"
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-bold text-zinc-400 mb-2">
            שם משפחה *
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            required
            className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
            placeholder="לדוגמה: כהן"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-bold text-zinc-400 mb-2">
            מספר טלפון *
          </label>
          <input
            type="tel"
            id="phoneNumber"
            name="phoneNumber"
            required
            pattern="[0-9]{10}"
            className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
            placeholder="0501234567"
          />
        </div>

        <div>
          <label htmlFor="personalNumber" className="block text-sm font-bold text-zinc-400 mb-2">
            מספר אישי *
          </label>
          <input
            type="text"
            id="personalNumber"
            name="personalNumber"
            required
            className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
            placeholder="לדוגמה: 1234567"
          />
        </div>
      </div>

      {/* Unit Details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="departmentId" className="block text-sm font-bold text-zinc-400 mb-2">
            מחלקה *
          </label>
          <select
            id="departmentId"
            name="departmentId"
            required
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
          >
            <option value="">בחר מחלקה</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="positionId" className="block text-sm font-bold text-zinc-400 mb-2">
            תפקיד *
          </label>
          <select
            id="positionId"
            name="positionId"
            required
            disabled={!selectedDepartmentId}
            className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      </div>

      {/* Clothing Sizes */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="shirtSize" className="block text-sm font-bold text-zinc-400 mb-2">
            מידת חולצה *
          </label>
          <select
            id="shirtSize"
            name="shirtSize"
            required
            className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
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
        </div>

        <div>
          <label htmlFor="pantsSize" className="block text-sm font-bold text-zinc-400 mb-2">
            מידת מכנס *
          </label>
          <select
            id="pantsSize"
            name="pantsSize"
            required
            className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
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
        </div>

        <div>
          <label htmlFor="shoeSize" className="block text-sm font-bold text-zinc-400 mb-2">
            מידת נעליים *
          </label>
          <select
            id="shoeSize"
            name="shoeSize"
            required
            className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
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
        </div>
      </div>

      {/* Weapon */}
      <div>
        <label htmlFor="weaponItemId" className="block text-sm font-bold text-zinc-400 mb-2">
          נשק *
        </label>
        <select
          id="weaponItemId"
          name="weaponItemId"
          required
          className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
        >
          <option value="">בחר נשק</option>
          {weaponItems.map((weapon) => (
            <option key={weapon.id} value={weapon.id}>
              {weapon.name}
            </option>
          ))}
        </select>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-14 w-full rounded-xl bg-zinc-50 text-zinc-950 font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "שומר..." : "המשך"}
      </button>
    </form>
  );
}

