"use client";

import { useState, useMemo } from "react";
import { RequestType, RequestStatus, Priority, Division } from "@prisma/client";
import { requestTypeLabel, requestStatusLabel, priorityLabel, divisionLabel, requestItemStatusLabel } from "@/lib/he";
import { cancelRequestAction } from "../requests/actions";
import { ModalPortal } from "@/components/ui/ModalPortal";

interface RequestItem {
  id: string;
  type: RequestType;
  status: RequestStatus;
  priority: Priority;
  userNotes: string | null;
  adminNotes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requesterId: string;
  recipientId: string | null;
  items: {
    id: string;
    quantity: number;
    status: string;
    serialNumber: string | null;
    clothingSize: string | null;
    shoeSize: string | null;
    resolvedAt: Date | null;
    recipientAcceptedAt: Date | null;
    recipientNotes: string | null;
    resolvedBy: {
      id: string;
      name: string;
    } | null;
    equipmentItem: {
      id: string;
      name: string;
      isWeapon: boolean;
      isSight: boolean;
      isClothing: boolean;
      isShoe: boolean;
      category: {
        division: Division;
      };
    };
  }[];
  requester: {
    id: string;
    name: string;
  };
  recipient: {
    id: string;
    name: string;
  } | null;
  resolvedBy: {
    id: string;
    name: string;
  } | null;
}

export function RequestsTab({ requests, currentUserId }: { requests: RequestItem[]; currentUserId: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<RequestType | "ALL">("ALL");
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | "ALL">("ALL");
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

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch = !searchQuery || 
        req.items.some(item => item.equipmentItem.name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = selectedType === "ALL" || req.type === selectedType;
      const matchesStatus = selectedStatus === "ALL" || req.status === selectedStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [requests, searchQuery, selectedType, selectedStatus]);

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
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        {/* Search and Filters */}
        <div className="mb-6 flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="חיפוש לפי שם פריט..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700"
          />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as RequestType | "ALL")}
            className="h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all cursor-pointer min-w-[140px]"
          >
            <option value="ALL">כל הסוגים</option>
            {Object.values(RequestType).filter(t => t !== "MISSING").map((t) => (
              <option key={t} value={t}>
                {requestTypeLabel(t)}
              </option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as RequestStatus | "ALL")}
            className="h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all cursor-pointer min-w-[140px]"
          >
            <option value="ALL">כל הסטטוסים</option>
            {Object.values(RequestStatus).map((s) => (
              <option key={s} value={s}>
                {requestStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {filteredRequests.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800 border-dashed">
            אין בקשות
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  <th className="px-4 py-3 text-right">פריטים</th>
                  <th className="px-4 py-3 text-right">סוג</th>
                  <th className="px-4 py-3 text-center">כמות כוללת</th>
                  <th className="px-4 py-3 text-right">תאריך</th>
                  <th className="px-4 py-3 text-center">סטטוס</th>
                  <th className="px-4 py-3 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const fulfilledCount = req.items.filter(i => i.status === "FULFILLED").length;
                  const deniedCount = req.items.filter(i => i.status === "DENIED").length;
                  const cancelledCount = req.items.filter(i => i.status === "CANCELLED").length;
                  const pendingCount = req.items.filter(i => i.status === "PENDING").length;

                  return (
                    <tr key={req.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="text-sm font-bold text-zinc-50 mb-1">{getItemsSummary(req)}</div>
                        <div className="flex gap-1 flex-wrap">
                          {fulfilledCount > 0 && (
                            <span key="fulfilled" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-900/20 text-green-400 border border-green-900/40">
                              ✓ {fulfilledCount}
                            </span>
                          )}
                          {deniedCount > 0 && (
                            <span key="denied" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-900/20 text-red-400 border border-red-900/40">
                              ✗ {deniedCount}
                            </span>
                          )}
                          {cancelledCount > 0 && (
                            <span key="cancelled" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-zinc-800 text-zinc-500 border border-zinc-700">
                              ⊘ {cancelledCount}
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span key="pending" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-900/20 text-blue-400 border border-blue-900/40">
                              ⏳ {pendingCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-400">
                        {requestTypeLabel(req.type, currentUserId, req.requesterId, req.recipientId || undefined)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-sm font-bold text-zinc-50">
                          {getTotalQuantity(req)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-zinc-500">
                        {new Date(req.createdAt).toLocaleDateString("he-IL", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(req.status)}`}>
                          {requestStatusLabel(req.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer"
                        >
                          פרטים
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal - Reusing existing logic */}
      {selectedRequest && (
        <ModalPortal>
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto overscroll-contain p-4">
          <div
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => setSelectedRequest(null)}
          />
          <div className="relative w-full max-w-2xl rounded-3xl bg-zinc-900 p-8 shadow-2xl overflow-hidden border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-zinc-50">פרטי בקשה</h3>
                <div className="mt-1 text-sm text-zinc-400">
                  {requestTypeLabel(selectedRequest.type, currentUserId, selectedRequest.requesterId, selectedRequest.recipientId || undefined)} · {selectedRequest.items.length} פריטים
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
              {/* Transfer Timeline Documentation */}
              {selectedRequest.type === RequestType.TRANSFER && (
                <div className="rounded-2xl border border-blue-900/40 bg-blue-900/10 p-4">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">תיעוד העברה</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</div>
                      <div className="flex-1">
                        <div className="text-zinc-300">
                          <span className="font-bold text-zinc-50">{selectedRequest.requester.name}</span> שלח בקשת העברה
                        </div>
                        <div className="text-xs text-zinc-500">{new Date(selectedRequest.createdAt).toLocaleString("he-IL")}</div>
                      </div>
                    </div>
                    
                    {selectedRequest.recipient && (
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">→</div>
                        <div className="flex-1">
                          <div className="text-zinc-300">
                            מיועד ל-<span className="font-bold text-zinc-50">{selectedRequest.recipient.name}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {selectedRequest.resolvedBy && selectedRequest.resolvedAt && (
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</div>
                        <div className="flex-1">
                          <div className="text-zinc-300">
                            <span className="font-bold text-zinc-50">{selectedRequest.resolvedBy.name}</span> (מנהל) אישר
                          </div>
                          <div className="text-xs text-zinc-500">{new Date(selectedRequest.resolvedAt).toLocaleString("he-IL")}</div>
                        </div>
                      </div>
                    )}
                    
                    {selectedRequest.items.some(i => i.recipientAcceptedAt) && (
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</div>
                        <div className="flex-1">
                          <div className="text-zinc-300">
                            <span className="font-bold text-zinc-50">{selectedRequest.recipient?.name}</span> קלט פריטים
                          </div>
                          <div className="text-xs text-zinc-500">
                            {selectedRequest.items.filter(i => i.recipientAcceptedAt).length} מתוך {selectedRequest.items.length} פריטים נקלטו
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                        <th className="px-4 py-3 text-right">פרטים</th>
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
                          <td className="px-4 py-3 text-xs text-zinc-400">
                            <div className="space-y-1">
                              {(item.equipmentItem.isWeapon || item.equipmentItem.isSight) && item.serialNumber && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-500">צ:</span>
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-50 font-mono">
                                    {item.serialNumber}
                                  </span>
                                </div>
                              )}
                              {item.equipmentItem.isClothing && item.clothingSize && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-500">מידה:</span>
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-50">
                                    {item.clothingSize}
                                  </span>
                                </div>
                              )}
                              {item.equipmentItem.isShoe && item.shoeSize && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-500">מידה:</span>
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-50">
                                    {item.shoeSize}
                                  </span>
                                </div>
                              )}
                              
                              {/* Transfer item documentation */}
                              {selectedRequest.type === RequestType.TRANSFER && (
                                <>
                                  {item.resolvedAt && item.resolvedBy && (
                                    <div key={`resolved-${item.id}`} className="text-amber-300 border-t border-zinc-800 pt-1 mt-1">
                                      אושר ע״י {item.resolvedBy.name}
                                      <div className="text-zinc-500 text-[10px]">
                                        {new Date(item.resolvedAt).toLocaleString("he-IL")}
                                      </div>
                                    </div>
                                  )}
                                  {item.recipientAcceptedAt && (
                                    <div key={`accepted-${item.id}`} className="text-emerald-300 border-t border-zinc-800 pt-1 mt-1">
                                      נקלט ע״י {selectedRequest.recipient?.name}
                                      <div className="text-zinc-500 text-[10px]">
                                        {new Date(item.recipientAcceptedAt).toLocaleString("he-IL")}
                                      </div>
                                    </div>
                                  )}
                                  {item.recipientNotes && (
                                    <div key={`notes-${item.id}`} className="text-blue-300 border-t border-zinc-800 pt-1 mt-1">
                                      הערות: {item.recipientNotes}
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {!item.serialNumber && !item.clothingSize && !item.shoeSize && 
                               selectedRequest.type !== RequestType.TRANSFER && (
                                <span className="text-zinc-600">-</span>
                              )}
                            </div>
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

              {/* User Notes */}
              {selectedRequest.userNotes && (
                <div className="rounded-xl border border-blue-900/40 bg-blue-900/10 p-4">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">ההערות שלי</div>
                  <div className="text-sm text-zinc-50 whitespace-pre-wrap">{selectedRequest.userNotes}</div>
                </div>
              )}

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

              {/* Resolved By Info for Closed Requests */}
              {selectedRequest.resolvedAt && selectedRequest.resolvedBy && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">תאריך סגירה</div>
                    <div className="text-sm font-medium text-zinc-50">
                      {new Date(selectedRequest.resolvedAt).toLocaleDateString("he-IL", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">טופל על ידי</div>
                    <div className="text-sm font-medium text-zinc-50">{selectedRequest.resolvedBy.name}</div>
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
        </ModalPortal>
      )}
    </>
  );
}

