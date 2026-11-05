"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { divisionLabel } from "@/lib/he";
import { handleTransferItemAction } from "../requests/transfer-actions";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Sheet, SheetActions } from "@/components/ui/Sheet";

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
  const [acceptQuantity, setAcceptQuantity] = useState<number>(1);

  if (pendingTransfers.length === 0) {
    return null;
  }

  const handleAccept = async () => {
    if (!acceptingItemId) return;
    const acceptingItem = selectedRequest?.items.find((item: any) => item.id === acceptingItemId);
    if (!acceptingItem) return;

    const requiresSerial = acceptingItem.equipmentItem.isWeapon || acceptingItem.equipmentItem.isSight || !!acceptingItem.serialNumber;
    const maxQuantity = acceptingItem.quantity ?? 1;
    const quantityToAccept = requiresSerial ? 1 : Math.max(1, Math.min(acceptQuantity, maxQuantity));

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("requestItemId", acceptingItemId);
      formData.append("action", "ACCEPT");
      formData.append("quantity", String(quantityToAccept));
      if (recipientNotes.trim()) {
        formData.append("recipientNotes", recipientNotes);
      }
      await handleTransferItemAction(formData);
      
      // Update local state to mark item as accepted
      if (selectedRequest) {
        const updatedItems = selectedRequest.items.map((item: any) =>
          item.id === acceptingItemId
            ? { ...item, status: "ACCEPTED", quantity: quantityToAccept }
            : item
        );
        setSelectedRequest({ ...selectedRequest, items: updatedItems });
      }
      
      setAcceptingItemId(null);
      setRecipientNotes("");
      setAcceptQuantity(1);
      
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
      setAcceptQuantity(1);
      
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

  const acceptingItem = selectedRequest?.items.find((item: any) => item.id === acceptingItemId) || null;
  const acceptingRequiresSerial = acceptingItem
    ? acceptingItem.equipmentItem.isWeapon || acceptingItem.equipmentItem.isSight || !!acceptingItem.serialNumber
    : false;

  // A nested accept/reject sheet is open: the details sheet underneath must ignore Escape/backdrop.
  const nestedOpen = !!acceptingItemId || !!rejectingItemId;

  const closeAccept = () => {
    setAcceptingItemId(null);
    setRecipientNotes("");
  };
  const closeReject = () => {
    setRejectingItemId(null);
    setRecipientNotes("");
  };

  return (
    <>
      {/* Notification Banner */}
      <div className="rounded-3xl border-2 border-amber-900/60 bg-gradient-to-br from-amber-900/30 to-amber-800/20 p-4 sm:p-6 shadow-lg">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0 text-3xl sm:text-4xl">📦</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-amber-300 mb-2">
              ציוד ממתין לקליטה
            </h2>
            <p className="text-amber-100/80 mb-4 text-sm sm:text-base">
              יש לך {totalPendingItems} פריטים ממתינים לאישור קבלה מ-{pendingTransfers.length} בקשות העברה
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {pendingTransfers.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setSelectedRequest(request)}
                  className="min-h-11 w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-500 transition-all shadow-md cursor-pointer text-start"
                >
                  העברה מ-{request.requester.name} ({request.items.filter((i: any) => i.status === "AWAITING_ACCEPTANCE").length} פריטים)
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Sheet */}
      {selectedRequest && (
        <Sheet
          open
          onClose={() => setSelectedRequest(null)}
          title="העברת ציוד"
          subtitle={`מ-${selectedRequest.requester.name} · ${new Date(selectedRequest.createdAt).toLocaleDateString("he-IL")}`}
          size="xl"
          dismissible={!isSubmitting && !nestedOpen}
          footer={
            <SheetActions>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                disabled={isSubmitting}
                className="h-12 w-full sm:w-auto px-6 rounded-xl bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50"
              >
                סגור
              </button>
            </SheetActions>
          }
        >
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-zinc-50 break-words">{item.equipmentItem.name}</span>
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

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAcceptingItemId(item.id);
                          setRecipientNotes("");
                          setAcceptQuantity(item.quantity ?? 1);
                        }}
                        disabled={isSubmitting}
                        className="h-11 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        קלוט
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingItemId(item.id);
                          setRecipientNotes("");
                        }}
                        disabled={isSubmitting}
                        className="h-11 px-4 rounded-xl border border-red-900/50 bg-red-950/20 text-red-400 text-sm font-bold hover:bg-red-950/40 transition-all cursor-pointer disabled:opacity-50"
                      >
                        דחה
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </Sheet>
      )}

      {/* Accept Sheet (stacked above the details sheet) */}
      {acceptingItemId && (
        <Sheet
          open
          onClose={closeAccept}
          title="קליטת פריט"
          subtitle="אתה עומד לקלוט פריט זה לציוד שלך. ניתן להוסיף הערות (אופציונלי)"
          size="sm"
          zIndex={210}
          dismissible={!isSubmitting}
          footer={
            <SheetActions>
              <button
                type="button"
                onClick={handleAccept}
                disabled={isSubmitting}
                className="h-12 w-full sm:w-auto px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : "קלוט פריט"}
              </button>
              <button
                type="button"
                onClick={closeAccept}
                disabled={isSubmitting}
                className="h-12 w-full sm:w-auto px-6 inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50"
              >
                ביטול
              </button>
            </SheetActions>
          }
        >
          {acceptingItem && acceptingItem.quantity > 1 && !acceptingRequiresSerial && (
            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2">כמות לקליטה</label>
              <input
                type="number"
                min={1}
                max={acceptingItem.quantity}
                step={1}
                value={acceptQuantity}
                onChange={(e) => setAcceptQuantity(Number(e.target.value))}
                className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-500 transition-all"
              />
              <div className="mt-2 text-xs text-zinc-500">מתוך {acceptingItem.quantity}</div>
            </div>
          )}
          
          <textarea
            value={recipientNotes}
            onChange={(e) => setRecipientNotes(e.target.value)}
            rows={4}
            placeholder="הערות (אופציונלי)..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none"
          />
        </Sheet>
      )}

      {/* Reject Sheet (stacked above the details sheet) */}
      {rejectingItemId && (
        <Sheet
          open
          onClose={closeReject}
          title="דחיית פריט"
          subtitle="יש להוסיף הערות המסבירות מדוע אתה דוחה פריט זה"
          size="sm"
          zIndex={210}
          dismissible={!isSubmitting}
          footer={
            <SheetActions>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting || !recipientNotes.trim()}
                className="h-12 w-full sm:w-auto px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : "דחה פריט"}
              </button>
              <button
                type="button"
                onClick={closeReject}
                disabled={isSubmitting}
                className="h-12 w-full sm:w-auto px-6 inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700 hover:text-zinc-50 transition-all cursor-pointer disabled:opacity-50"
              >
                ביטול
              </button>
            </SheetActions>
          }
        >
          <textarea
            value={recipientNotes}
            onChange={(e) => setRecipientNotes(e.target.value)}
            rows={4}
            placeholder="למה אתה דוחה פריט זה?..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-500 transition-all resize-none"
          />
        </Sheet>
      )}
    </>
  );
}
