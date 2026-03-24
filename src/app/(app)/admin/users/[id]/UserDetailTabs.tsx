"use client";

import { useState } from "react";
import { EquipmentTab } from "./EquipmentTab";
import { PersonalDetailsTab } from "./PersonalDetailsTab";

type TabType = "equipment" | "personal";

interface UserDetailTabsProps {
  user: any;
  departments: any[];
  positions: any[];
  availableEquipment: any[];
  unitTemplates: any[];
  boxTemplate: any;
  userBox: any;
  transferTargets: { id: string; name: string; personalNumber: string | null }[];
  yamahStockByItemId: Record<string, number>;
}

export function UserDetailTabs({
  user,
  departments,
  positions,
  availableEquipment,
  unitTemplates,
  boxTemplate,
  userBox,
  transferTargets,
  yamahStockByItemId,
}: UserDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("equipment");

  return (
    <div className="flex flex-col gap-6">
      {/* Tab Navigation */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab("equipment")}
            className={`flex-1 px-6 py-4 text-sm font-bold transition-all ${
              activeTab === "equipment"
                ? "bg-zinc-800 text-zinc-50 border-b-2 border-zinc-50"
                : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/50"
            }`}
          >
            ציוד משויך ({user.assignments.length})
          </button>
          <button
            onClick={() => setActiveTab("personal")}
            className={`flex-1 px-6 py-4 text-sm font-bold transition-all ${
              activeTab === "personal"
                ? "bg-zinc-800 text-zinc-50 border-b-2 border-zinc-50"
                : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/50"
            }`}
          >
            פרטים אישיים
          </button>
        </div>

        <div className="p-6">
          {activeTab === "equipment" && (
            <EquipmentTab
              user={user}
              availableEquipment={availableEquipment}
              unitTemplates={unitTemplates}
              boxTemplate={boxTemplate}
              userBox={userBox}
              transferTargets={transferTargets}
              yamahStockByItemId={yamahStockByItemId}
            />
          )}
          {activeTab === "personal" && (
            <PersonalDetailsTab 
              user={user}
              departments={departments}
              positions={positions}
            />
          )}
        </div>
      </div>
    </div>
  );
}

