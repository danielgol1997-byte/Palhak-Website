"use client";

import { useState } from "react";
import { Division } from "@prisma/client";
import { WeaponsTable } from "./WeaponsTable";
import { SightsTable } from "./SightsTable";

interface Assignment {
  id: string;
  quantity: number;
  serialNumber: string | null;
  assignedAt: Date;
  status: string;
  user: {
    id: string;
    name: string;
    personalNumber: string | null;
  };
  equipmentItem: {
    id: string;
    name: string;
    category: {
      division: Division;
    };
  };
  assignedBy: {
    id: string;
    name: string;
  } | null;
}

type TabType = "weapons" | "sights";

export function WeaponsAndSightsTabs({
  weaponAssignments,
  sightAssignments,
}: {
  weaponAssignments: Assignment[];
  sightAssignments: Assignment[];
}) {
  const [activeTab, setActiveTab] = useState<TabType>("weapons");

  const tabs = [
    { id: "weapons" as TabType, label: "נשקים", count: weaponAssignments.length },
    { id: "sights" as TabType, label: "צלמים", count: sightAssignments.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-bold transition-all cursor-pointer relative ${
              activeTab === tab.id
                ? "text-zinc-50"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  activeTab === tab.id
                    ? "bg-zinc-50 text-zinc-950"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-50" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "weapons" && <WeaponsTable assignments={weaponAssignments} />}
        {activeTab === "sights" && <SightsTable assignments={sightAssignments} />}
      </div>
    </div>
  );
}

