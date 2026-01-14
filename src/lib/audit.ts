import { Prisma } from "@prisma/client";
import type { AuditEntity } from "@prisma/client";

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string | null;
    entity: AuditEntity;
    entityId: string;
    action: string;
    beforeJson?: Prisma.InputJsonValue | null;
    afterJson?: Prisma.InputJsonValue | null;
    metadataJson?: Prisma.InputJsonValue | null;
  },
) {
  const beforeJson =
    input.beforeJson === undefined || input.beforeJson === null
      ? Prisma.JsonNull
      : input.beforeJson;
  const afterJson =
    input.afterJson === undefined || input.afterJson === null
      ? Prisma.JsonNull
      : input.afterJson;
  const metadataJson =
    input.metadataJson === undefined || input.metadataJson === null
      ? Prisma.JsonNull
      : input.metadataJson;

  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      beforeJson,
      afterJson,
      metadataJson,
    },
  });
}


