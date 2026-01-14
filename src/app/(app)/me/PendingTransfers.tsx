"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RequestType, ClothingSize, ShoeSize } from "@prisma/client";
import { requestTypeLabel, divisionLabel, requestItemStatusLabel } from "@/lib/he";
import { handleTransferItemAction } from "../requests/transfer-actions";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface PendingTransfersProps {
  pendingTransfers: any[];
}

export function PendingTransfers({ pendingTransfers }: PendingTransfersProps) {
  const router = useRouter();
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [acceptingItemId, setAcceptingItemId] = useState<string | null>(null);
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);
  const [recipientNotes, setRecipientNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (pendingTransfers.length === 0) {
    return null;
  }

  const handleAccept = async () => {
    if (!acceptingItemId) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("requestItemId", acceptingItemId);
      formData.append("action", "ACCEPT");
      if (recipientNotes.trim()) {
        formData.append("recipientNotes", recipientNotes);
      }
      await handleTransferItemAction(formData);
      
      // Update local state to mark item as accepted
      if (selectedRequest) {
        const updatedItems = selectedRequest.items.map((item: any) =>
          item.id === acceptingItemId ? { ...item, status: "ACCEPTED" } : item
        );
        setSelectedRequest({ ...selectedRequest, items: updatedItems });
      }
      
      setAcceptingItemId(null);
      setRecipientNotes("");
      
      // Refresh server data
      router.refresh();
    } catch (error: any) {
      alert(error.message || "אירעה שגיאה");
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingItemId) return;
    if (!recipientNotes.trim()) {
      alert("יש להוסיף הערות בעת דחיית פריט");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("requestItemId", rejectingItemId);
      formData.append("action", "REJECT");
      formData.append("recipientNotes", recipientNotes);
      await handleTransferItemAction(formData);
      
      // Update local state to mark item as rejected
      if (selectedRequest) {
        const updatedItems = selectedRequest.items.map((item: any) =>
          item.id === rejectingItemId ? { ...item, status: "REJECTED_BY_RECIPIENT" } : item
        );
        setSelectedRequest({ ...selectedRequest, items: updatedItems });
      }
      
      setRejectingItemId(null);
      setRecipientNotes("");
      
      // Refresh server data
      router.refresh();
    } catch (error: any) {
      alert(error.message || "אירעה שגיאה");
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPendingItems = pendingTransfers.reduce((sum, req) => 
    sum + req.items.filter((i: any) => i.status === "AWAITING_ACCEPTANCE").length, 
    0
  );

  return (
    <>
      {/* Notification Banner */}
      <div className="rounded-3xl border-2 border-amber-900/60 bg-gradient-to-br from-amber-900/30 to-amber-800/20 p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 text-4xl">📦</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-amber-300 mb-2">
              ציוד ממתין לקליטה
            </h2>
            <p className="text-amber-100/80 mb-4">
              יש לך {totalPendingItems} פריטים ממתינים לאישור קבלה מ-{pendingTransfers.length} בקשות העברה
            </p>
            <div className="flex flex-wrap gap-3">
              {pendingTransfers.map((request) => (
                <button
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-500 transition-all shadow-md cursor-pointer"
                >
                  העברה מ-{request.requester.name} ({request.items.filter((i: any) => i.status === "AWAITING_ACCEPTANCE").length} פריטים)
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm" onClick={() => !isSubmitting && setSelectedRequest(null)} />
          <div className="relative w-full max-w-4xl rounded-3xl bg-zinc-900 p-8 shadow-2xl overflow-hidden border border-zinc-800 max-h-[90vh] overflow-y-auto scrollbar-hide">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-zinc-50">העברת ציוד</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  מ-{selectedRequest.requester.name} · {new Date(selectedRequest.createdAt).toLocaleDateString("he-IL")}
                </p>
              </div>
              <button
                onClick={() => !isSubmitting && setSelectedRequest(null)}
                disabled={isSubmitting}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-50 cursor-pointer disabled:opacity-50"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* User Notes */}
            {selectedRequest.userNotes && (
              <div className="mb-6 rounded-2xl border border-blue-900/40 bg-blue-900/10 p-4">
                <div className="font-bold text-blue-400 mb-1">הערות מהמעביר</div>
                <div className="text-blue-300 text-sm whitespace-pre-line">{selectedRequest.userNotes}</div>
              </div>
            )}

            {/* Items List */}
            <div className="space-y-4">
              <h4 className="font-bold text-zinc-400 text-sm">פריטים להעברה</h4>
              {selectedRequest.items
                .filter((item: any) => item.status === "AWAITING_ACCEPTANCE")
                .map((item: any) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-zinc-50">{item.equipmentItem.name}</span>
                          {(item.equipmentItem.isWeapon || item.equipmentItem.isSight) && (
                            <span className="px-2 py-0.5 rounded-full bg-orange-900/20 text-orange-400 border border-orange-900/40 text-xs font-bold">
                              צ
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-zinc-400 space-y-1">
                          <div>כמות: {item.quantity}</div>
                          {item.serialNumber && (
                            <div>מספר סידורי: {item.serialNumber}</div>
                          )}
                          {item.clothingSize && (
                            <div>מידה: {item.clothingSize}</div>
                          )}
                          {item.shoeSize && (
                            <div>מידת נעליים: {item.shoeSize.replace("SIZE_", "")}</div>
                          )}
                          <div className="text-xs text-zinc-500">
                            {divisionLabel(item.equipmentItem.category.division)}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setAcceptingItemId(item.id);
                            setRecipientNotes("");
                          }}
                          disabled={isSubmitting}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          קלוט
                        </button>
                        <button
                          onClick={() => {
                            setRejectingItemId(item.id);
                            setRecipientNotes("");
                          }}
                          disabled={isSubmitting}
                          className="px-4 py-2 rounded-xl border border-red-900/50 bg-red-950/20 text-red-400 text-sm font-bold hover:bg-red-950/40 transition-all cursor-pointer disabled:opacity-50"
                        >
                          דחה
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Accept Modal */}
      {acceptingItemId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm" onClick={() => !isSubmitting && setAcceptingItemId(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800">
            <h3 className="text-2xl font-bold text-zinc-50 mb-4">קליטת פריט</h3>
            <p className="text-zinc-400 text-sm mb-4">
              אתה עומד לקלוט פריט זה לציוד שלך. ניתן להוסיף הערות (אופציונלי)
            </p>
            
            <textarea
              value={recipientNotes}
              onChange={(e) => setRecipientNotes(e.target.value)}
              rows={4}
              placeholder="הערות (אופציונלי)..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                disabled={isSubmitting}
                className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : "קלוט פריט"}
              </button>
              <button
                onClick={() => {
                  setAcceptingItemId(null);
                  setRecipientNotes("");
                }}
                disabled={isSubmitting}
                className="flex-1 h-12 inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItemId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm" onClick={() => !isSubmitting && setRejectingItemId(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800">
            <h3 className="text-2xl font-bold text-zinc-50 mb-4">דחיית פריט</h3>
            <p className="text-zinc-400 text-sm mb-4">
              יש להוסיף הערות המסבירות מדוע אתה דוחה פריט זה
            </p>
            
            <textarea
              value={recipientNotes}
              onChange={(e) => setRecipientNotes(e.target.value)}
              rows={4}
              placeholder="למה אתה דוחה פריט זה?..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={isSubmitting || !recipientNotes.trim()}
                className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : "דחה פריט"}
              </button>
              <button
                onClick={() => {
                  setRejectingItemId(null);
                  setRecipientNotes("");
                }}
                disabled={isSubmitting}
                className="flex-1 h-12 inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

