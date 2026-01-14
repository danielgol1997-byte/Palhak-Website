"use client";

import { useState } from "react";
import { RequestType, RequestStatus, Priority, Division } from "@prisma/client";
import { requestTypeLabel, requestStatusLabel, priorityLabel, divisionLabel, requestItemStatusLabel } from "@/lib/he";
import { cancelRequestAction } from "./actions";

interface RequestItem {
  id: string;
  type: RequestType;
  status: RequestStatus;
  priority: Priority;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    quantity: number;
    status: string;
    equipmentItem: {
      id: string;
      name: string;
      category: {
        division: Division;
      };
    };
  }[];
  requester: {
    name: string;
  };
}

export function RequestHistory({ requests }: { requests: RequestItem[] }) {
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async (requestId: string) => {
    setIsCancelling(true);
    const formData = new FormData();
    formData.append("id", requestId);
    try {
      await cancelRequestAction(formData);
      setSelectedRequest(null);
    } catch (error) {
      console.error("Failed to cancel request:", error);
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case RequestStatus.OPEN:
        return "bg-blue-900/20 text-blue-400 border-blue-900/40";
      case RequestStatus.IN_PROGRESS:
        return "bg-yellow-900/20 text-yellow-400 border-yellow-900/40";
      case RequestStatus.FULFILLED:
        return "bg-green-900/20 text-green-400 border-green-900/40";
      case RequestStatus.PARTIALLY_FULFILLED:
        return "bg-amber-900/20 text-amber-400 border-amber-900/40";
      case RequestStatus.DENIED:
        return "bg-red-900/20 text-red-400 border-red-900/40";
      case RequestStatus.CANCELLED:
        return "bg-zinc-800/50 text-zinc-500 border-zinc-800";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-800";
    }
  };

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case "FULFILLED":
        return "bg-green-900/20 text-green-400 border-green-900/40";
      case "DENIED":
        return "bg-red-900/20 text-red-400 border-red-900/40";
      case "CANCELLED":
        return "bg-zinc-800/50 text-zinc-500 border-zinc-800";
      case "PENDING":
      default:
        return "bg-blue-900/20 text-blue-400 border-blue-900/40";
    }
  };

  const getTotalQuantity = (req: RequestItem) => {
    return req.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getItemsSummary = (req: RequestItem) => {
    if (req.items.length === 1) {
      return req.items[0].equipmentItem.name;
    }
    return `${req.items.length} פריטים`;
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {requests.map((req) => {
          const fulfilledCount = req.items.filter(i => i.status === "FULFILLED").length;
          const deniedCount = req.items.filter(i => i.status === "DENIED").length;
          const cancelledCount = req.items.filter(i => i.status === "CANCELLED").length;
          const pendingCount = req.items.filter(i => i.status === "PENDING").length;

          return (
            <div
              key={req.id}
              onClick={() => setSelectedRequest(req)}
              className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-inner transition-all hover:border-zinc-700 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-zinc-50 truncate">{getItemsSummary(req)}</h3>
                  <div className="mt-1 text-sm text-zinc-400">
                    {requestTypeLabel(req.type)} · כמות כוללת: {getTotalQuantity(req)}
                  </div>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {fulfilledCount > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-900/20 text-green-400 border border-green-900/40">
                        ✓ {fulfilledCount} אושר
                      </span>
                    )}
                    {deniedCount > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-900/20 text-red-400 border border-red-900/40">
                        ✗ {deniedCount} נדחה
                      </span>
                    )}
                    {cancelledCount > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-zinc-800 text-zinc-500 border border-zinc-700">
                        ⊘ {cancelledCount} בוטל
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-blue-900/20 text-blue-400 border border-blue-900/40">
                        ⏳ {pendingCount} ממתין
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {new Date(req.createdAt).toLocaleDateString("he-IL", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(req.status)}`}
                  >
                    {requestStatusLabel(req.status)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {requests.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-3xl border border-zinc-800 border-dashed">
            אין בקשות
          </div>
        )}
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => setSelectedRequest(null)}
          />
          <div className="relative w-full max-w-2xl rounded-3xl bg-zinc-900 p-8 shadow-2xl overflow-hidden border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-zinc-50">פרטי בקשה</h3>
                <div className="mt-1 text-sm text-zinc-400">
                  {requestTypeLabel(selectedRequest.type)} · {selectedRequest.items.length} פריטים
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid gap-4">
              {/* Items List */}
              <div>
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">פריטים</div>
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        <th className="px-4 py-3 text-right">שם פריט</th>
                        <th className="px-4 py-3 text-right">קטגוריה</th>
                        <th className="px-4 py-3 text-center">כמות</th>
                        <th className="px-4 py-3 text-center">סטטוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.items.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-800">
                          <td className="px-4 py-3 text-sm font-medium text-zinc-50">
                            {item.equipmentItem.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-400">
                            {divisionLabel(item.equipmentItem.category.division)}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-50 text-center font-bold">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold border ${getItemStatusColor(item.status)}`}>
                              {requestItemStatusLabel(item.status, selectedRequest.type)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Admin Notes */}
              {selectedRequest.adminNotes && (
                <div className="rounded-xl border border-amber-900/40 bg-amber-900/10 p-4">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">הערות מנהל</div>
                  <div className="text-sm text-zinc-50 whitespace-pre-wrap">{selectedRequest.adminNotes}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">סטטוס</div>
                  <div
                    className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(selectedRequest.status)}`}
                  >
                    {requestStatusLabel(selectedRequest.status)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">עדיפות</div>
                  <div className="text-sm font-medium text-zinc-50">{priorityLabel(selectedRequest.priority)}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">תאריך יצירה</div>
                <div className="text-sm font-medium text-zinc-50">
                  {new Date(selectedRequest.createdAt).toLocaleDateString("he-IL", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              {selectedRequest.updatedAt.getTime() !== selectedRequest.createdAt.getTime() && (
                <div>
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">תאריך עדכון אחרון</div>
                  <div className="text-sm font-medium text-zinc-50">
                    {new Date(selectedRequest.updatedAt).toLocaleDateString("he-IL", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              )}

              {(selectedRequest.status === RequestStatus.OPEN ||
                selectedRequest.status === RequestStatus.IN_PROGRESS) && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <button
                    onClick={() => handleCancel(selectedRequest.id)}
                    disabled={isCancelling}
                    className="w-full h-12 inline-flex items-center justify-center rounded-xl bg-red-900/20 text-red-400 font-bold hover:bg-red-900/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCancelling ? "מבטל..." : "ביטול בקשה"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
