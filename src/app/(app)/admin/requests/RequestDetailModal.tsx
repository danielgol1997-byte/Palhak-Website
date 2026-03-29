"use client";

import { useState, useEffect } from "react";
import { RequestType, RequestStatus, Priority, Division } from "@prisma/client";
import { requestTypeLabel, requestStatusLabel, priorityLabel, divisionLabel, requestItemStatusLabel } from "@/lib/he";
import {
  updateRequestPriorityAction,
  markRequestViewedAction,
  updateRequestNotesAction,
  handleRequestItemAction,
  handleRequestItemsBatchAction,
} from "./actions";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ModalPortal } from "@/components/ui/ModalPortal";

interface Request {
  id: string;
  type: RequestType;
  status: RequestStatus;
  priority: Priority;
  userNotes: string | null;
  adminNotes: string | null;
  viewedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requester: {
    id: string;
    name: string;
    assignments?: {
      equipmentItemId: string;
      serialNumber: string | null;
      status: string;
    }[];
  };
  recipient?: {
    id: string;
    name: string;
    personalNumber: string | null;
  } | null;
  resolvedBy: {
    id: string;
    name: string;
  } | null;
  items: {
    id: string;
    quantity: number;
    status: string;
    serialNumber: string | null;
    clothingSize: string | null;
    shoeSize: string | null;
    resolvedAt?: Date | null;
    resolvedById?: string | null;
    recipientNotes?: string | null;
    recipientAcceptedAt?: Date | null;
    resolvedBy?: {
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
}

export function RequestDetailModal({
  request: initialRequest,
  onClose,
}: {
  request: Request;
  onClose: () => void;
}) {
  const router = useRouter();
  const [request, setRequest] = useState(initialRequest);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState(request.priority);
  const [notes, setNotes] = useState(request.adminNotes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [quantityModal, setQuantityModal] = useState<{
    itemId: string;
    itemName: string;
    requestedQuantity: number;
    quantity: number;
    requiresSerialNumber: boolean;
    serialNumberLabel: string;
  } | null>(null);
  const [serialNumber, setSerialNumber] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkFulfillDrafts, setBulkFulfillDrafts] = useState<Record<string, { quantity: number; serial: string }>>({});
  const [bulkPanel, setBulkPanel] = useState<null | "fulfill">(null);

  // Check request type for appropriate action labels
  const isDeclaration = request.type === RequestType.DAMAGED || request.type === RequestType.STOLEN || request.type === RequestType.MISSING;
  const isReturn = request.type === RequestType.RETURN_EQUIPMENT;
  const isNewEquipment = request.type === RequestType.NEW_EQUIPMENT;
  const isAdminEquipmentTransfer = request.type === RequestType.ADMIN_EQUIPMENT_TRANSFER;
  
  // Get appropriate action labels based on request type
  const getApproveLabel = () => {
    if (isDeclaration) return "אישור הצהרה";
    if (isReturn) return "אישור החזרה";
    return "אישור";
  };
  
  const getDenyLabel = () => {
    if (isDeclaration) return "דחיית הצהרה";
    if (isReturn) return "דחיית החזרה";
    return "דחייה";
  };

  useEffect(() => {
    if (!request.viewedAt) {
      const formData = new FormData();
      formData.append("id", request.id);
      markRequestViewedAction(formData).catch(console.error);
    }
  }, [request.id, request.viewedAt]);

  useEffect(() => {
    setSelectedItemIds(new Set());
    setBulkPanel(null);
    setBulkFulfillDrafts({});
  }, [request.id]);

  const toggleItemSelect = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAllPendingItems = () => {
    setSelectedItemIds(new Set(request.items.filter((i) => i.status === "PENDING").map((i) => i.id)));
  };

  const clearItemSelection = () => {
    setSelectedItemIds(new Set());
    setBulkPanel(null);
  };

  const openBulkFulfillPanel = () => {
    const next: Record<string, { quantity: number; serial: string }> = {};
    for (const id of selectedItemIds) {
      const item = request.items.find((i) => i.id === id);
      if (!item || item.status !== "PENDING") continue;
      const reqSerial = item.equipmentItem.isWeapon || item.equipmentItem.isSight;
      let serial = "";
      if (reqSerial) {
        if (request.type === RequestType.TRANSFER) {
          serial = item.serialNumber || "";
        } else if (!isNewEquipment) {
          serial =
            request.requester.assignments?.find((a) => a.equipmentItemId === item.equipmentItem.id)?.serialNumber || "";
        }
      }
      next[id] = { quantity: item.quantity, serial };
    }
    setBulkFulfillDrafts(next);
    setBulkPanel("fulfill");
  };

  const runBulkDenyOrCancel = async (action: "DENY" | "CANCEL") => {
    const targets = request.items.filter((i) => selectedItemIds.has(i.id) && i.status === "PENDING");
    if (targets.length === 0) return;
    const verb = action === "DENY" ? "לדחות" : "לבטל";
    if (!confirm(`האם ל${verb} ${targets.length} פריטים?`)) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("requestId", request.id);
      formData.append(
        "operations",
        JSON.stringify(targets.map((t) => ({ requestItemId: t.id, action }))),
      );
      const result = await handleRequestItemsBatchAction(formData);
      if (result?.updatedRequest) setRequest(result.updatedRequest as typeof request);
      else router.refresh();
      clearItemSelection();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "שגיאה בפעולה מרובה");
    } finally {
      setIsProcessing(false);
    }
  };

  const submitBulkFulfill = async () => {
    const entries = Object.entries(bulkFulfillDrafts);
    if (entries.length === 0) return;
    for (const [itemId, draft] of entries) {
      const item = request.items.find((i) => i.id === itemId);
      if (!item) continue;
      const needsSerial = item.equipmentItem.isWeapon || item.equipmentItem.isSight;
      if (needsSerial && !draft.serial.trim()) {
        alert(`נדרש מספר סידורי עבור ${item.equipmentItem.name}`);
        return;
      }
      if (draft.quantity < 1 || draft.quantity > item.quantity) {
        alert(`כמות לא תקינה עבור ${item.equipmentItem.name}`);
        return;
      }
    }
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("requestId", request.id);
      formData.append(
        "operations",
        JSON.stringify(
          entries.map(([requestItemId, d]) => ({
            requestItemId,
            action: "FULFILL" as const,
            quantity: d.quantity,
            serialNumber: d.serial.trim() || undefined,
          })),
        ),
      );
      const result = await handleRequestItemsBatchAction(formData);
      if (result?.updatedRequest) setRequest(result.updatedRequest as typeof request);
      else router.refresh();
      clearItemSelection();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "שגיאה באישור מרובה");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePriorityChange = async (newPriority: Priority) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("id", request.id);
    formData.append("priority", newPriority);
    try {
      await updateRequestPriorityAction(formData);
      setSelectedPriority(newPriority);
      router.refresh();
    } catch (error: any) {
      alert(error.message || "שגיאה בעת עדכון עדיפות");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveNotes = async () => {
    if (notes === (request.adminNotes || "")) return; // No changes
    
    setIsSavingNotes(true);
    const formData = new FormData();
    formData.append("id", request.id);
    formData.append("notes", notes);
    try {
      await updateRequestNotesAction(formData);
      router.refresh();
    } catch (error: any) {
      alert(error.message || "שגיאה בעת שמירת הערות");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleItemAction = async (itemId: string, action: "FULFILL" | "DENY" | "CANCEL" | "RESET", quantity?: number, serialNum?: string) => {
    // For FULFILL, show quantity modal first if quantity not provided
    if (action === "FULFILL" && quantity === undefined) {
      const item = request.items.find((i) => i.id === itemId);
      if (!item) return;
      const requiresSerialNumber = item.equipmentItem.isWeapon || item.equipmentItem.isSight;
      const serialNumberLabel = item.equipmentItem.isWeapon 
        ? "צ׳ של הנשק" 
        : item.equipmentItem.isSight 
          ? "צ של הצלמ" 
          : "";
      
      // Get the existing serial number based on request type
      let existingSerialNumber = null;
      if (requiresSerialNumber) {
        if (request.type === RequestType.TRANSFER) {
          // For transfers, serial number is already on the request item
          existingSerialNumber = item.serialNumber;
        } else if (!isNewEquipment) {
          // For returns/declarations, get from user's assignment
          existingSerialNumber = request.requester.assignments?.find(a => a.equipmentItemId === item.equipmentItem.id)?.serialNumber;
        }
      }
      
      // If quantity is 1 and no serial number required, approve directly
      if (item.quantity === 1 && !requiresSerialNumber) {
        // Proceed with approval directly
        quantity = 1;
        serialNum = "";
      } else {
        // Show modal for quantity selection and/or serial number input
        setQuantityModal({
          itemId: item.id,
          itemName: item.equipmentItem.name,
          requestedQuantity: item.quantity,
          quantity: item.quantity,
          requiresSerialNumber,
          serialNumberLabel,
        });
        // Pre-populate with existing serial number if available
        setSerialNumber(existingSerialNumber || "");
        return;
      }
    }

    const actionText = 
      action === "FULFILL" ? "לספק" : 
      action === "DENY" ? "לדחות" : 
      action === "CANCEL" ? "לבטל" : 
      "לאפס למצב ממתין";
    
    if (action !== "FULFILL" && !confirm(`האם אתה בטוח שברצונך ${actionText} פריט זה?`)) return;
    
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("requestId", request.id);
    formData.append("requestItemId", itemId);
    formData.append("action", action);
    if (quantity !== undefined) {
      formData.append("quantity", quantity.toString());
    }
    if (serialNum) {
      formData.append("serialNumber", serialNum);
    }
    try {
      const result = await handleRequestItemAction(formData);
      
      // Update local state with the result
      if (result && result.updatedRequest) {
        setRequest(result.updatedRequest);
      } else {
        router.refresh();
      }
    } catch (error: any) {
      alert(error.message || "שגיאה בעת עדכון פריט");
    } finally {
      setIsProcessing(false);
      setQuantityModal(null);
    }
  };

  const handleConfirmQuantity = () => {
    if (!quantityModal) return;
    if (quantityModal.requiresSerialNumber && !serialNumber.trim()) {
      alert(`נדרש להזין ${quantityModal.serialNumberLabel}`);
      return;
    }
    handleItemAction(quantityModal.itemId, "FULFILL", quantityModal.quantity, serialNumber);
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.URGENT:
        return "bg-red-900/20 text-red-400 border-red-900/40 hover:bg-red-900/40";
      case Priority.HIGH:
        return "bg-orange-900/20 text-orange-400 border-orange-900/40 hover:bg-orange-900/40";
      case Priority.MEDIUM:
        return "bg-yellow-900/20 text-yellow-400 border-yellow-900/40 hover:bg-yellow-900/40";
      case Priority.LOW:
        return "bg-zinc-800/50 text-zinc-400 border-zinc-800 hover:bg-zinc-700";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-800 hover:bg-zinc-700";
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

  const getTotalQuantity = () => {
    return request.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const hasPendingItems = request.items.some((item) => item.status === "PENDING");
  const pendingItems = request.items.filter((item) => item.status === "PENDING");
  const selectedPendingCount = pendingItems.filter((i) => selectedItemIds.has(i.id)).length;
  
  const hasWeaponsOrSights = request.items.some((item) => 
    (item.equipmentItem.isWeapon || item.equipmentItem.isSight) && item.status === "PENDING"
  );

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto overscroll-contain p-2 sm:p-4">
      <div
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl rounded-2xl sm:rounded-3xl bg-zinc-900 p-4 sm:p-8 shadow-2xl overflow-hidden border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-xl sm:text-2xl font-bold text-zinc-50 truncate">פרטי בקשה</h3>
            <div className="mt-1 text-xs sm:text-sm text-zinc-400">
              {requestTypeLabel(request.type)} · {request.items.length} פריטים
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer flex-shrink-0"
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

        <div className="grid gap-4 sm:gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                {isAdminEquipmentTransfer && request.recipient ? "נמען (אליו הועבר)" : "מבקש"}
              </div>
              <div className="text-sm font-medium text-zinc-50 break-words">{request.requester.name}</div>
              {isAdminEquipmentTransfer && request.recipient && (
                <div className="mt-3">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">מאת</div>
                  <div className="text-sm font-medium text-zinc-300 break-words">{request.recipient.name}</div>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">כמות כוללת</div>
              <div className="text-sm font-medium text-zinc-50">{getTotalQuantity()}</div>
            </div>
          </div>

          {/* Transfer Timeline Documentation */}
          {request.type === RequestType.TRANSFER && (
            <div className="rounded-2xl border border-blue-900/40 bg-blue-900/10 p-4">
              <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">תיעוד העברה</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</div>
                  <div className="flex-1">
                    <div className="text-zinc-300">
                      <span className="font-bold text-zinc-50">{request.requester.name}</span> שלח בקשת העברה
                    </div>
                    <div className="text-xs text-zinc-500">{new Date(request.createdAt).toLocaleString("he-IL")}</div>
                  </div>
                </div>
                
                {request.recipient && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">→</div>
                    <div className="flex-1">
                      <div className="text-zinc-300">
                        מיועד ל-<span className="font-bold text-zinc-50">{request.recipient.name}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {request.resolvedBy && request.resolvedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</div>
                    <div className="flex-1">
                      <div className="text-zinc-300">
                        <span className="font-bold text-zinc-50">{request.resolvedBy.name}</span> (מנהל) אישר
                      </div>
                      <div className="text-xs text-zinc-500">{new Date(request.resolvedAt).toLocaleString("he-IL")}</div>
                    </div>
                  </div>
                )}
                
                {request.items.some(i => i.recipientAcceptedAt) && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</div>
                    <div className="flex-1">
                      <div className="text-zinc-300">
                        <span className="font-bold text-zinc-50">{request.recipient?.name}</span> קלט פריטים
                      </div>
                      <div className="text-xs text-zinc-500">
                        {request.items.filter(i => i.recipientAcceptedAt).length} מתוך {request.items.length} פריטים נקלטו
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {isAdminEquipmentTransfer && (
            <div className="rounded-2xl border border-sky-900/40 bg-sky-950/20 p-4">
              <div className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">העברה ניהולית</div>
              <p className="text-sm text-zinc-300">
                ציוד הועבר ישירות על ידי מנהל המערכת
                {request.resolvedBy && (
                  <>
                    : <span className="font-bold text-zinc-50">{request.resolvedBy.name}</span>
                  </>
                )}
                {request.resolvedAt && (
                  <span className="block text-xs text-zinc-500 mt-1">
                    {new Date(request.resolvedAt).toLocaleString("he-IL")}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Items List with Individual Actions - Mobile Responsive */}
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">פריטים</div>
              {!isAdminEquipmentTransfer && pendingItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-zinc-500">
                    נבחרו {selectedPendingCount}/{pendingItems.length} ממתינים
                  </span>
                  <button
                    type="button"
                    onClick={selectAllPendingItems}
                    disabled={isProcessing}
                    className="px-2 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    בחר הכל הממתינים
                  </button>
                  <button
                    type="button"
                    onClick={clearItemSelection}
                    disabled={isProcessing || selectedItemIds.size === 0}
                    className="px-2 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    נקה
                  </button>
                  <button
                    type="button"
                    onClick={openBulkFulfillPanel}
                    disabled={isProcessing || selectedPendingCount === 0}
                    className="px-2 py-1 rounded-lg bg-green-900/30 text-green-400 border border-green-900/50 hover:bg-green-900/50 disabled:opacity-50"
                  >
                    אשר נבחרים…
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulkDenyOrCancel("DENY")}
                    disabled={isProcessing || selectedPendingCount === 0}
                    className="px-2 py-1 rounded-lg bg-red-900/30 text-red-400 border border-red-900/50 hover:bg-red-900/50 disabled:opacity-50"
                  >
                    דחה נבחרים
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulkDenyOrCancel("CANCEL")}
                    disabled={isProcessing || selectedPendingCount === 0}
                    className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-600 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    בטל נבחרים
                  </button>
                </div>
              )}
            </div>

            {bulkPanel === "fulfill" && Object.keys(bulkFulfillDrafts).length > 0 && (
              <div className="mb-4 rounded-xl border border-green-900/40 bg-green-950/20 p-4 space-y-3">
                <div className="text-xs font-bold text-green-400 uppercase tracking-wider">
                  אישור מרובה — כוונן כמות ומספר סידורי לפני שליחה
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {Object.entries(bulkFulfillDrafts).map(([itemId, draft]) => {
                    const item = request.items.find((i) => i.id === itemId);
                    if (!item) return null;
                    const needsSerial = item.equipmentItem.isWeapon || item.equipmentItem.isSight;
                    const serialLabel = item.equipmentItem.isWeapon ? "צ׳ נשק" : "צ׳ צלמ";
                    return (
                      <div key={itemId} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end border-b border-zinc-800/80 pb-3">
                        <div className="text-sm text-zinc-200 font-medium">{item.equipmentItem.name}</div>
                        <div>
                          <label className="block text-[10px] text-zinc-500 mb-1">כמות (עד {item.quantity})</label>
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={draft.quantity}
                            onChange={(e) => {
                              const v = Math.max(1, Math.min(item.quantity, parseInt(e.target.value, 10) || 1));
                              setBulkFulfillDrafts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], quantity: v } }));
                            }}
                            className="w-full h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100"
                          />
                        </div>
                        {needsSerial ? (
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-1">{serialLabel}</label>
                            <input
                              type="text"
                              value={draft.serial}
                              onChange={(e) =>
                                setBulkFulfillDrafts((prev) => ({
                                  ...prev,
                                  [itemId]: { ...prev[itemId], serial: e.target.value },
                                }))
                              }
                              className="w-full h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100 font-mono"
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-600 sm:self-center">ללא צ׳</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setBulkPanel(null)}
                    disabled={isProcessing}
                    className="px-3 py-2 rounded-lg border border-zinc-600 text-zinc-300 text-sm"
                  >
                    סגור
                  </button>
                  <button
                    type="button"
                    onClick={submitBulkFulfill}
                    disabled={isProcessing}
                    className="px-3 py-2 rounded-lg bg-green-900/40 text-green-300 border border-green-800 text-sm font-bold disabled:opacity-50"
                  >
                    {isProcessing ? "מעבד…" : `אשר ${Object.keys(bulkFulfillDrafts).length} פריטים`}
                  </button>
                </div>
              </div>
            )}

            {/* Desktop Table */}
            <div className="hidden sm:block rounded-xl border border-zinc-800 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-950 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    {!isAdminEquipmentTransfer && pendingItems.length > 0 && (
                      <th className="px-2 py-3 w-10 text-center">בחירה</th>
                    )}
                    <th className="px-4 py-3 text-right">שם פריט</th>
                    <th className="px-4 py-3 text-right">קטגוריה</th>
                    <th className="px-4 py-3 text-center">כמות</th>
                    <th className="px-4 py-3 text-center">פרטים</th>
                    <th className="px-4 py-3 text-center">סטטוס</th>
                    <th className="px-4 py-3 text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {request.items.map((item) => (
                    <tr key={item.id} className="border-t border-zinc-800">
                      {!isAdminEquipmentTransfer && pendingItems.length > 0 && (
                        <td className="px-2 py-3 text-center align-middle">
                          {item.status === "PENDING" ? (
                            <input
                              type="checkbox"
                              checked={selectedItemIds.has(item.id)}
                              onChange={() => toggleItemSelect(item.id)}
                              disabled={isProcessing}
                              className="h-4 w-4 rounded border-zinc-600 accent-green-600 cursor-pointer"
                            />
                          ) : (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                      )}
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
                        <div className="text-xs text-zinc-400 space-y-1">
                          {item.clothingSize && (
                            <div className="text-zinc-300">
                              מידת בגד: <span className="font-bold">{item.clothingSize}</span>
                            </div>
                          )}
                          {item.shoeSize && (
                            <div className="text-zinc-300">
                              מידת נעליים: <span className="font-bold">{item.shoeSize.replace('SIZE_', '')}</span>
                            </div>
                          )}
                          {(item.serialNumber || 
                            (item.equipmentItem.isWeapon || item.equipmentItem.isSight) && 
                            request.type !== RequestType.NEW_EQUIPMENT) && (
                            <div className="text-zinc-300">
                              מספר סידורי: <span className="font-bold font-mono">
                                {(() => {
                                  const foundAssignment = request.requester.assignments?.find(a => a.equipmentItemId === item.equipmentItem.id);
                                  return item.serialNumber || foundAssignment?.serialNumber || "לא זמין";
                                })()}
                              </span>
                            </div>
                          )}
                          {request.type === RequestType.TRANSFER && (
                            <>
                              {item.resolvedAt && item.resolvedBy && (
                                <div className="text-amber-300 border-t border-zinc-800 pt-1 mt-1">
                                  אושר ע״י {item.resolvedBy.name}
                                  <div className="text-zinc-500 text-[10px]">
                                    {new Date(item.resolvedAt).toLocaleString("he-IL")}
                                  </div>
                                </div>
                              )}
                              {item.recipientAcceptedAt && (
                                <div className="text-emerald-300 border-t border-zinc-800 pt-1 mt-1">
                                  נקלט ע״י {request.recipient?.name}
                                  <div className="text-zinc-500 text-[10px]">
                                    {new Date(item.recipientAcceptedAt).toLocaleString("he-IL")}
                                  </div>
                                </div>
                              )}
                              {item.recipientNotes && (
                                <div className="text-blue-300 border-t border-zinc-800 pt-1 mt-1">
                                  הערות מקבל: {item.recipientNotes}
                                </div>
                              )}
                            </>
                          )}
                          {!item.clothingSize && !item.shoeSize && !item.serialNumber && 
                           !(item.equipmentItem.isWeapon || item.equipmentItem.isSight) && 
                           request.type !== RequestType.TRANSFER && <span>-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold border ${getItemStatusColor(item.status)}`}>
                          {requestItemStatusLabel(item.status, request.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!isAdminEquipmentTransfer ? (
                          <div className="flex gap-1 justify-center">
                            {item.status !== "FULFILLED" && (
                              <button
                                onClick={() => handleItemAction(item.id, "FULFILL")}
                                disabled={isProcessing}
                                className={`px-2 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                                  item.status === "FULFILLED"
                                    ? "bg-green-900/40 text-green-300 border-green-900/60"
                                    : "bg-green-900/20 text-green-400 border-green-900/40 hover:bg-green-900/40"
                                }`}
                                title={getApproveLabel()}
                              >
                                ✓
                              </button>
                            )}
                            {item.status !== "DENIED" && (
                              <button
                                onClick={() => handleItemAction(item.id, "DENY")}
                                disabled={isProcessing}
                                className={`px-2 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                                  item.status === "DENIED"
                                    ? "bg-red-900/40 text-red-300 border-red-900/60"
                                    : "bg-red-900/20 text-red-400 border-red-900/40 hover:bg-red-900/40"
                                }`}
                                title={getDenyLabel()}
                              >
                                ✗
                              </button>
                            )}
                            {item.status !== "CANCELLED" && (
                              <button
                                onClick={() => handleItemAction(item.id, "CANCEL")}
                                disabled={isProcessing}
                                className={`px-2 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                                  item.status === "CANCELLED"
                                    ? "bg-zinc-700 text-zinc-400 border-zinc-600"
                                    : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                                }`}
                                title="ביטול"
                              >
                                ⊘
                              </button>
                            )}
                            {item.status !== "PENDING" && (
                              <button
                                onClick={() => handleItemAction(item.id, "RESET")}
                                disabled={isProcessing}
                                className="px-2 py-1 rounded-md text-xs font-bold bg-blue-900/20 text-blue-400 border border-blue-900/40 hover:bg-blue-900/40 transition-all cursor-pointer disabled:opacity-50"
                                title="איפוס לממתין"
                              >
                                ↺
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500 block text-center">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Card Layout */}
            <div className="sm:hidden space-y-3">
              {request.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    {!isAdminEquipmentTransfer && pendingItems.length > 0 && item.status === "PENDING" && (
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => toggleItemSelect(item.id)}
                        disabled={isProcessing}
                        className="mt-1 h-4 w-4 rounded border-zinc-600 accent-green-600 cursor-pointer flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-zinc-50 break-words">{item.equipmentItem.name}</div>
                      <div className="text-xs text-zinc-400 mt-1">{divisionLabel(item.equipmentItem.category.division)}</div>
                    </div>
                    <div className="flex-shrink-0 mr-2">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold border ${getItemStatusColor(item.status)}`}>
                        {requestItemStatusLabel(item.status, request.type)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500">כמות:</span>
                      <span className="text-zinc-50 font-bold mr-1">{item.quantity}</span>
                    </div>
                    {item.clothingSize && (
                      <div>
                        <span className="text-zinc-500">מידת בגד:</span>
                        <span className="text-zinc-50 font-bold mr-1">{item.clothingSize}</span>
                      </div>
                    )}
                    {item.shoeSize && (
                      <div>
                        <span className="text-zinc-500">מידת נעליים:</span>
                        <span className="text-zinc-50 font-bold mr-1">{item.shoeSize.replace('SIZE_', '')}</span>
                      </div>
                    )}
                    {(item.serialNumber || 
                      (item.equipmentItem.isWeapon || item.equipmentItem.isSight) && 
                      request.type !== RequestType.NEW_EQUIPMENT) && (
                      <div className="col-span-2">
                        <span className="text-zinc-500">מספר סידורי:</span>
                        <span className="text-zinc-50 font-bold font-mono mr-1">
                          {(() => {
                            const foundAssignment = request.requester.assignments?.find(a => a.equipmentItemId === item.equipmentItem.id);
                            return item.serialNumber || foundAssignment?.serialNumber || "לא זמין";
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {request.type === RequestType.TRANSFER && (
                    <div className="pt-2 border-t border-zinc-800 space-y-2 text-xs">
                      {item.resolvedAt && item.resolvedBy && (
                        <div className="text-amber-300">
                          אושר ע״י {item.resolvedBy.name}
                          <div className="text-zinc-500 text-[10px]">
                            {new Date(item.resolvedAt).toLocaleString("he-IL")}
                          </div>
                        </div>
                      )}
                      {item.recipientAcceptedAt && (
                        <div className="text-emerald-300">
                          נקלט ע״י {request.recipient?.name}
                          <div className="text-zinc-500 text-[10px]">
                            {new Date(item.recipientAcceptedAt).toLocaleString("he-IL")}
                          </div>
                        </div>
                      )}
                      {item.recipientNotes && (
                        <div className="text-blue-300">
                          הערות מקבל: {item.recipientNotes}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!isAdminEquipmentTransfer && (
                    <div className="flex gap-2 pt-2 border-t border-zinc-800 flex-wrap">
                      {item.status !== "FULFILLED" && (
                        <button
                          onClick={() => handleItemAction(item.id, "FULFILL")}
                          disabled={isProcessing}
                          className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                            item.status === "FULFILLED"
                              ? "bg-green-900/40 text-green-300 border-green-900/60"
                              : "bg-green-900/20 text-green-400 border-green-900/40 hover:bg-green-900/40"
                          }`}
                        >
                          {getApproveLabel()}
                        </button>
                      )}
                      {item.status !== "DENIED" && (
                        <button
                          onClick={() => handleItemAction(item.id, "DENY")}
                          disabled={isProcessing}
                          className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                            item.status === "DENIED"
                              ? "bg-red-900/40 text-red-300 border-red-900/60"
                              : "bg-red-900/20 text-red-400 border-red-900/40 hover:bg-red-900/40"
                          }`}
                        >
                          {getDenyLabel()}
                        </button>
                      )}
                      {item.status !== "CANCELLED" && (
                        <button
                          onClick={() => handleItemAction(item.id, "CANCEL")}
                          disabled={isProcessing}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                            item.status === "CANCELLED"
                              ? "bg-zinc-700 text-zinc-400 border-zinc-600"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                          }`}
                        >
                          ביטול
                        </button>
                      )}
                      {item.status !== "PENDING" && (
                        <button
                          onClick={() => handleItemAction(item.id, "RESET")}
                          disabled={isProcessing}
                          className="px-3 py-2 rounded-lg text-xs font-bold bg-blue-900/20 text-blue-400 border border-blue-900/40 hover:bg-blue-900/40 transition-all cursor-pointer disabled:opacity-50"
                        >
                          ↺
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* User Notes (Read-only) */}
          {request.userNotes && (
            <div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                הערות המשתמש
              </div>
              <div className="rounded-xl border border-blue-900/40 bg-blue-900/10 px-4 py-3 text-sm text-zinc-50">
                {request.userNotes}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          <div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
              הערות מנהל
              {isSavingNotes && <span className="text-zinc-600 mr-2">(שומר...)</span>}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="הוסף הערות לבקשה (המשתמש יראה הערות אלה)"
              className="w-full h-24 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all placeholder:text-zinc-700 resize-none"
            />
          </div>

          {/* Priority Selection */}
          <div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">עדיפות</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 overflow-x-auto">
              {Object.values(Priority).map((priority) => (
                <button
                  key={priority}
                  onClick={() => handlePriorityChange(priority)}
                  disabled={isProcessing}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedPriority === priority
                      ? getPriorityColor(priority)
                      : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700"
                  }`}
                >
                  {priorityLabel(priority)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">תאריך יצירה</div>
            <div className="text-sm font-medium text-zinc-50">
              {new Date(request.createdAt).toLocaleDateString("he-IL", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          {request.updatedAt.getTime() !== request.createdAt.getTime() && (
            <div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">תאריך עדכון אחרון</div>
              <div className="text-sm font-medium text-zinc-50">
                {new Date(request.updatedAt).toLocaleDateString("he-IL", {
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
          {request.resolvedAt && request.resolvedBy && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">תאריך סגירה</div>
                <div className="text-sm font-medium text-zinc-50">
                  {new Date(request.resolvedAt).toLocaleDateString("he-IL", {
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
                <div className="text-sm font-medium text-zinc-50">{request.resolvedBy.name}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quantity Modal */}
      {quantityModal && (
        <div className="absolute inset-0 flex items-center justify-center z-50 p-4">
          <div
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => setQuantityModal(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl sm:rounded-3xl bg-zinc-900 p-4 sm:p-8 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-zinc-50 mb-2">
                {quantityModal.requiresSerialNumber 
                  ? getApproveLabel()
                  : `כמות ל${isDeclaration ? "אישור" : isReturn ? "אישור" : "אישור"}`
                }
              </h3>
              <p className="text-sm text-zinc-400">
                {quantityModal.itemName}
              </p>
            </div>

            <div className="mb-6 space-y-4">
              {quantityModal.requestedQuantity > 1 && (
                <div>
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                    {isDeclaration ? "כמות מוצהרת" : "כמות מבוקשת"}: {quantityModal.requestedQuantity}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        setQuantityModal((prev) =>
                          prev ? { ...prev, quantity: Math.max(1, prev.quantity - 1) } : null
                        )
                      }
                      className="h-12 w-12 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer flex items-center justify-center text-2xl font-bold"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={quantityModal.requestedQuantity}
                      value={quantityModal.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setQuantityModal((prev) =>
                          prev
                            ? { ...prev, quantity: Math.max(1, Math.min(val, prev.requestedQuantity)) }
                            : null
                        );
                      }}
                      className="flex-1 h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-center text-2xl font-bold text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
                    />
                    <button
                      onClick={() =>
                        setQuantityModal((prev) =>
                          prev
                            ? { ...prev, quantity: Math.min(prev.requestedQuantity, prev.quantity + 1) }
                            : null
                        )
                      }
                      className="h-12 w-12 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer flex items-center justify-center text-2xl font-bold"
                    >
                      +
                    </button>
                  </div>
                  {quantityModal.quantity < quantityModal.requestedQuantity && (
                    <div className="mt-3 text-xs text-amber-400">
                      ⚠️ אישור חלקי: יאושרו {quantityModal.quantity} מתוך {quantityModal.requestedQuantity}
                    </div>
                  )}
                </div>
              )}

              {quantityModal.requiresSerialNumber && (
                <div>
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                    {quantityModal.serialNumberLabel} *
                  </div>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="הזן מספר סידורי"
                    className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
                    required
                    autoFocus
                  />
                </div>
              )}

              {quantityModal.requestedQuantity === 1 && !quantityModal.requiresSerialNumber && (
                <div className="text-sm text-zinc-400 text-center py-4">
                  {getApproveLabel()} לפריט אחד
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setQuantityModal(null)}
                className="h-12 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 font-bold transition-all cursor-pointer"
              >
                ביטול
              </button>
              <button
                onClick={handleConfirmQuantity}
                disabled={isProcessing}
                className="h-12 rounded-xl bg-green-900/20 text-green-400 font-bold border border-green-900/40 hover:bg-green-900/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? <LoadingSpinner size="sm" /> : getApproveLabel()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ModalPortal>
  );
}
