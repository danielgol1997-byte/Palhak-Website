"use client";

import { useState } from "react";
import { RequestType } from "@prisma/client";
import { RequestForm } from "./RequestForm";
import { NewEquipmentForm } from "./NewEquipmentForm";
import { TransferForm } from "./TransferForm";

interface EquipmentTabsProps {
  currentUserId: string;
  items: any[];
  unitTemplates: any[];
  userAssignments: any[];
  pendingDeclarationItems: { equipmentItemId: string; serialNumber: string | null; quantity: number }[];
  pendingTransferItems: { equipmentItemId: string; serialNumber: string | null; quantity: number }[];
  userSizes: {
    shirtSize: any;
    pantsSize: any;
    shoeSize: any;
  };
  allUsers: any[];
}

type TabType = "new" | "damaged" | "stolen" | "used" | "returns" | "transfers";

export function EquipmentTabs(props: EquipmentTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("new");

  const tabs = [
    {
      id: "new" as TabType,
      label: "ציוד חדש",
      icon: "➕",
      requestType: RequestType.NEW_EQUIPMENT,
      color: "from-green-900/20 to-green-800/10 border-green-900/40 text-green-400",
      activeColor: "bg-gradient-to-br from-green-900/40 to-green-800/20 border-green-900/60 text-green-300 shadow-lg shadow-green-900/20",
    },
    {
      id: "damaged" as TabType,
      label: "הצהרת בלאי",
      icon: "⚠️",
      requestType: RequestType.DAMAGED,
      color: "from-orange-900/20 to-orange-800/10 border-orange-900/40 text-orange-400",
      activeColor: "bg-gradient-to-br from-orange-900/40 to-orange-800/20 border-orange-900/60 text-orange-300 shadow-lg shadow-orange-900/20",
    },
    {
      id: "stolen" as TabType,
      label: "אבד/נגנב",
      icon: "🔴",
      requestType: RequestType.STOLEN,
      color: "from-red-900/20 to-red-800/10 border-red-900/40 text-red-400",
      activeColor: "bg-gradient-to-br from-red-900/40 to-red-800/20 border-red-900/60 text-red-300 shadow-lg shadow-red-900/20",
    },
    {
      id: "used" as TabType,
      label: "שומש",
      icon: "♻️",
      requestType: RequestType.USED,
      color: "from-yellow-900/20 to-yellow-800/10 border-yellow-900/40 text-yellow-400",
      activeColor: "bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 border-yellow-900/60 text-yellow-300 shadow-lg shadow-yellow-900/20",
    },
    {
      id: "returns" as TabType,
      label: "החזרת ציוד",
      icon: "↩️",
      requestType: RequestType.RETURN_EQUIPMENT,
      color: "from-blue-900/20 to-blue-800/10 border-blue-900/40 text-blue-400",
      activeColor: "bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-900/60 text-blue-300 shadow-lg shadow-blue-900/20",
    },
    {
      id: "transfers" as TabType,
      label: "העברת ציוד",
      icon: "🔄",
      requestType: null,
      color: "from-purple-900/20 to-purple-800/10 border-purple-900/40 text-purple-400",
      activeColor: "bg-gradient-to-br from-purple-900/40 to-purple-800/20 border-purple-900/60 text-purple-300 shadow-lg shadow-purple-900/20",
    },
  ];

  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative overflow-hidden rounded-2xl border-2 p-4 transition-all duration-300 cursor-pointer
                ${isActive 
                  ? `${tab.activeColor} scale-105 shadow-2xl` 
                  : `bg-gradient-to-br ${tab.color} hover:scale-105 opacity-70 hover:opacity-90`
                }
              `}
            >
              {/* Shimmer effect for active tab */}
              {isActive && (
                <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              )}
              
              <div className={`flex flex-col items-center gap-2 relative z-10 ${isActive ? '' : ''}`}>
                <span className={`text-2xl transition-all duration-300 ${isActive ? 'scale-110' : ''}`}>{tab.icon}</span>
                <span className={`text-xs font-bold text-center leading-tight transition-all duration-300 ${isActive ? 'scale-105' : ''}`}>{tab.label}</span>
              </div>
              
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-current opacity-50" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-sm">
        {activeTab === "transfers" ? (
          <TransferForm
            currentUserId={props.currentUserId}
            userAssignments={props.userAssignments}
            availableUnits={props.unitTemplates}
            allUsers={props.allUsers}
            pendingTransferItems={props.pendingTransferItems}
          />
        ) : activeTab === "new" ? (
          <NewEquipmentForm
            items={props.items}
            unitTemplates={props.unitTemplates}
            userSizes={props.userSizes}
          />
        ) : activeTab === "returns" ? (
          <RequestForm
            {...props}
            defaultRequestType={RequestType.RETURN_EQUIPMENT}
            hideRequestTypeSelector={true}
          />
        ) : (
          <RequestForm
            {...props}
            defaultRequestType={activeTabData?.requestType || RequestType.NEW_EQUIPMENT}
            hideRequestTypeSelector={true}
          />
        )}
      </div>
    </div>
  );
}

