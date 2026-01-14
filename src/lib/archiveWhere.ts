import type { Prisma } from "@prisma/client";
import type { TableFilter } from "@/lib/tableQuery";

function asDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function applyFiltersToWhere<T extends Prisma.TransferWhereInput | Prisma.RequestWhereInput | Prisma.AuditLogWhereInput>(
  base: T,
  filters: TableFilter[],
): T {
  const and: any[] = [];

  for (const f of filters) {
    const { id, op, value } = f;

    // Common date filters
    if (id === "createdAt" || id === "createdAtFrom" || id === "createdAtTo") {
      const d = asDate(value);
      if (!d) continue;
      if (id === "createdAtFrom" || op === "gte") and.push({ createdAt: { gte: d } });
      else if (id === "createdAtTo" || op === "lte") and.push({ createdAt: { lte: d } });
      continue;
    }

    // Transfer fields
    if (id === "status") {
      if (typeof value === "string") and.push({ status: value });
      continue;
    }
    if (id === "fromUserId") {
      if (typeof value === "string") and.push({ fromUserId: value });
      continue;
    }
    if (id === "toUserId") {
      if (typeof value === "string") and.push({ toUserId: value });
      continue;
    }

    // Request fields
    if (id === "priority") {
      if (typeof value === "string") and.push({ priority: value });
      continue;
    }
    if (id === "type") {
      if (typeof value === "string") and.push({ type: value });
      continue;
    }
    if (id === "requesterId") {
      if (typeof value === "string") and.push({ requesterId: value });
      continue;
    }
    if (id === "equipmentItemId") {
      if (typeof value === "string") and.push({ equipmentItemId: value });
      continue;
    }

    // AuditLog fields
    if (id === "entity") {
      if (typeof value === "string") and.push({ entity: value });
      continue;
    }
    if (id === "actorId") {
      if (typeof value === "string") and.push({ actorId: value });
      continue;
    }
    if (id === "action") {
      if (typeof value === "string") {
        if (op === "contains") and.push({ action: { contains: value, mode: "insensitive" } });
        else and.push({ action: value });
      }
      continue;
    }
  }

  if (!and.length) return base;
  return { ...(base as any), AND: [...(((base as any).AND as any[]) ?? []), ...and] };
}


