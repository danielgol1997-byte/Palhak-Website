import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { EquipmentTabs } from "./EquipmentTabs";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const session = await requireSession();

  const [items, unitTemplates, userAssignments, pendingDeclarations, pendingTransfers, userData, allUsers] = await Promise.all([
    prisma.equipmentItem.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        isClothing: true,
        isShoe: true,
        isWeapon: true,
        isSight: true,
        category: { 
          select: { 
            division: true,
            name: true,  // Added for EquipmentSelector search functionality
          } 
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.unitTemplate.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        items: {
          select: {
            equipmentItemId: true,
            quantityRequired: true,
            equipmentItem: {
              select: {
                id: true,
                name: true,
                isWeapon: true,
                isSight: true,
                isClothing: true,
                isShoe: true,
                category: { 
                  select: { 
                    division: true,
                    name: true,
                  } 
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.assignment.findMany({
      where: {
        userId: session.user.id,
        active: true,
        status: "ASSIGNED",
      },
      select: {
        equipmentItemId: true,
        quantity: true,
        serialNumber: true,
        clothingSize: true,
        shoeSize: true,
        equipmentItem: {
          select: {
            id: true,
            name: true,
            isWeapon: true,
            isSight: true,
            isClothing: true,
            isShoe: true,
            category: {
              select: {
                division: true,
              },
            },
          },
        },
      },
    }),
    // Get pending declarations (DAMAGED/STOLEN/USED requests that are still open)
    prisma.request.findMany({
      where: {
        requesterId: session.user.id,
        type: { in: ["DAMAGED", "STOLEN", "USED", "RETURN_EQUIPMENT"] },
        status: { in: ["OPEN", "IN_PROGRESS", "PARTIALLY_FULFILLED"] },
      },
      select: {
        items: {
          where: {
            status: "PENDING",
          },
          select: {
            equipmentItemId: true,
            serialNumber: true,
            quantity: true,
          },
        },
      },
    }),
    // Get pending transfer requests to prevent duplicate transfers
    prisma.request.findMany({
      where: {
        requesterId: session.user.id,
        type: "TRANSFER",
        status: { in: ["OPEN", "IN_PROGRESS", "PARTIALLY_FULFILLED"] },
      },
      select: {
        items: {
          where: {
            status: { in: ["PENDING", "AWAITING_ACCEPTANCE"] },
          },
          select: {
            equipmentItemId: true,
            serialNumber: true,
            quantity: true,
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        shirtSize: true,
        pantsSize: true,
        shoeSize: true,
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        personalNumber: true,
        role: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Create a list of pending declarations with serial numbers and quantities
  const pendingDeclarationItems = pendingDeclarations.flatMap(req => 
    req.items.map(item => ({
      equipmentItemId: item.equipmentItemId,
      serialNumber: item.serialNumber,
      quantity: item.quantity,
    }))
  );

  // Create a list of pending transfer items to prevent duplicate transfers
  const pendingTransferItems = pendingTransfers.flatMap(req => 
    req.items.map(item => ({
      equipmentItemId: item.equipmentItemId,
      serialNumber: item.serialNumber,
      quantity: item.quantity,
    }))
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-sm">
        <h1 className="text-3xl font-black text-zinc-50 tracking-tight">ציוד</h1>
        <p className="mt-2 text-zinc-400">בקש ציוד חדש, הצהר על בלאי או אובדן, החזר או העבר ציוד</p>
      </section>

      <EquipmentTabs
        currentUserId={session.user.id}
        items={items}
        unitTemplates={unitTemplates}
        userAssignments={userAssignments}
        pendingDeclarationItems={pendingDeclarationItems}
        pendingTransferItems={pendingTransferItems}
        userSizes={{
          shirtSize: userData?.shirtSize || null,
          pantsSize: userData?.pantsSize || null,
          shoeSize: userData?.shoeSize || null,
        }}
        allUsers={allUsers}
      />
    </div>
  );
}
