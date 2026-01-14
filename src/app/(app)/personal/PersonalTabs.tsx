"use client";

import { useState } from "react";

interface PersonalTabsProps {
  equipmentTab: React.ReactNode;
  requestsTab: React.ReactNode;
  detailsTab: React.ReactNode;
}

export function PersonalTabs({ equipmentTab, requestsTab, detailsTab }: PersonalTabsProps) {
  const [activeTab, setActiveTab] = useState<"equipment" | "requests" | "details">("details");

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs Navigation */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-2 flex gap-2">
        <button
          key="details"
          onClick={() => setActiveTab("details")}
          className={`flex-1 h-12 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "details"
              ? "bg-zinc-50 text-zinc-950"
              : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800"
          }`}
        >
          פרטים אישיים
        </button>
        <button
          key="equipment"
          onClick={() => setActiveTab("equipment")}
          className={`flex-1 h-12 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "equipment"
              ? "bg-zinc-50 text-zinc-950"
              : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800"
          }`}
        >
          ציוד מוקצה
        </button>
        <button
          key="requests"
          onClick={() => setActiveTab("requests")}
          className={`flex-1 h-12 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "requests"
              ? "bg-zinc-50 text-zinc-950"
              : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800"
          }`}
        >
          היסטוריית בקשות
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "equipment" && equipmentTab}
        {activeTab === "requests" && requestsTab}
        {activeTab === "details" && detailsTab}
      </div>
    </div>
  );
}

