import type { AssignmentStatus, ClothingSize, Division, Priority, RequestStatus, RequestType, Role, TransferStatus, Weapon } from "@prisma/client";

export function divisionLabel(d: Division): string {
  switch (d) {
    case "COMBAT":
      return "ציוד קרבי";
    case "LOGISTICS":
      return "ציוד משקי";
    case "MEDICAL":
      return "ציוד רפואי";
  }
}

export function priorityLabel(p: Priority): string {
  switch (p) {
    case "LOW":
      return "נמוך";
    case "MEDIUM":
      return "בינוני";
    case "HIGH":
      return "גבוה";
    case "URGENT":
      return "דחוף";
  }
}

export function priorityColor(p: Priority): string {
  switch (p) {
    case "LOW":
      return "text-zinc-400 bg-zinc-900/20 border-zinc-700";
    case "MEDIUM":
      return "text-blue-400 bg-blue-900/20 border-blue-700";
    case "HIGH":
      return "text-amber-400 bg-amber-900/20 border-amber-700";
    case "URGENT":
      return "text-red-400 bg-red-900/20 border-red-700";
  }
}

export function requestTypeLabel(t: RequestType, userId?: string, requesterId?: string, recipientId?: string): string {
  switch (t) {
    case "NEW_EQUIPMENT":
      return "ציוד חדש";
    case "RETURN_EQUIPMENT":
      return "החזרת ציוד";
    case "MISSING":
      return "חסר";
    case "DAMAGED":
      return "בלאי";
    case "STOLEN":
      return "אבד/נגנב";
    case "USED":
      return "שומש";
    case "ADMIN_ASSIGNMENT":
      return "ניהול שרירותי";
    case "TRANSFER":
      // Context-aware label for transfers
      if (userId && recipientId && userId === recipientId) {
        return "קבלת ציוד";
      }
      return "העברת ציוד";
  }
}

export function requestStatusLabel(s: RequestStatus): string {
  switch (s) {
    case "OPEN":
      return "פתוח";
    case "IN_PROGRESS":
      return "בטיפול";
    case "FULFILLED":
      return "טופל";
    case "PARTIALLY_FULFILLED":
      return "טופל חלקית";
    case "DENIED":
      return "נדחה";
    case "CANCELLED":
      return "בוטל";
  }
}

export function requestItemStatusLabel(s: string, requestType?: RequestType): string {
  switch (s) {
    case "PENDING":
      return "ממתין";
    case "FULFILLED":
      // Context-aware labels based on request type
      if (requestType === "DAMAGED" || requestType === "STOLEN" || requestType === "MISSING" || requestType === "USED") {
        return "הוצהר";
      }
      if (requestType === "RETURN_EQUIPMENT") {
        return "הוחזר";
      }
      if (requestType === "TRANSFER") {
        return "הועבר";
      }
      return "אושר";
    case "DENIED":
      return "נדחה";
    case "CANCELLED":
      return "בוטל";
    case "AWAITING_ACCEPTANCE":
      return "ממתין לקליטה";
    case "ACCEPTED":
      return "נקלט";
    case "REJECTED_BY_RECIPIENT":
      return "נדחה על ידי מקבל";
    default:
      return s;
  }
}

export function transferStatusLabel(s: TransferStatus): string {
  switch (s) {
    case "PENDING_COMMANDER_APPROVAL":
      return "ממתין לאישור מפקד";
    case "PENDING_RECEIVER_CONFIRMATION":
      return "ממתין לאישור קבלה";
    case "COMPLETED":
      return "הושלם";
    case "REJECTED":
      return "נדחה";
    case "CANCELLED":
      return "בוטל";
  }
}

export function assignmentStatusLabel(s: AssignmentStatus): string {
  switch (s) {
    case "ASSIGNED":
      return "מוקצה";
    case "MISSING":
      return "חסר";
    case "DAMAGED":
      return "הוצהר כבלאי";
    case "STOLEN":
      return "הוצהר כאבוד/גנוב";
    case "USED":
      return "שומש";
    case "PENDING_APPROVAL":
      return "ממתין לאישור";
  }
}

export function roleLabel(r: Role): string {
  switch (r) {
    case "SUPER_ADMIN":
      return "מנהל על";
    case "ADMIN":
      return "מנהל";
    case "USER":
      return "משתמש";
  }
}

export function clothingSizeLabel(s: ClothingSize): string {
  return s; // S, M, L are universal
}

export function weaponLabel(w: Weapon): string {
  switch (w) {
    case "M16":
      return "M16";
    case "TAVOR":
      return "תבור";
  }
}


