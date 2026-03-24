import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { AssignmentStatus, RequestType, Role } from "@prisma/client";
import { isPrivilegedOperator } from "@/lib/rbac";
import { PersonalTabs } from "./PersonalTabs";
import { EquipmentTab } from "./EquipmentTab";
import { RequestsTab } from "./RequestsTab";
import { DetailsTab } from "./DetailsTab";

export const dynamic = "force-dynamic";

export default async function PersonalPage() {
  const session = await requireSession();
  const assignmentStatusFilter =
    session.user.role === Role.ADMIN ||
    isPrivilegedOperator(session.user.role)
      ? { in: [AssignmentStatus.ASSIGNED, AssignmentStatus.PENDING_APPROVAL] }
      : AssignmentStatus.ASSIGNED;

  const [assignments, sentRequests, receivedRequests, user, departments, positions, weaponItems] = await Promise.all([
    prisma.assignment.findMany({
      where: { 
        userId: session.user.id, 
        active: true,
        status: assignmentStatusFilter, // Admins see in-transit (PENDING_APPROVAL) too
      },
      orderBy: [{ equipmentItem: { name: "asc" } }],
      select: {
        id: true,
        quantity: true,
        status: true,
        serialNumber: true,
        equipmentItem: {
          select: {
            id: true,
            name: true,
            isWeapon: true,
            isSight: true,
            category: { select: { division: true } },
          },
        },
      },
    }),
    // Requests sent by the user
    prisma.request.findMany({
      where: {
        requesterId: session.user.id,
        type: { not: RequestType.ADMIN_EQUIPMENT_TRANSFER },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        userNotes: true,
        adminNotes: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        requesterId: true,
        recipientId: true,
        items: {
          select: {
            id: true,
            quantity: true,
            status: true,
            serialNumber: true,
            clothingSize: true,
            shoeSize: true,
            resolvedAt: true,
            recipientAcceptedAt: true,
            recipientNotes: true,
            resolvedBy: {
              select: {
                id: true,
                name: true,
              },
            },
            equipmentItem: {
              select: {
                id: true,
                name: true,
                isWeapon: true,
                isSight: true,
                isClothing: true,
                isShoe: true,
                category: { select: { division: true } },
              },
            },
          },
        },
        requester: {
          select: { 
            id: true,
            name: true 
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    // Requests received by the user (transfers to them)
    prisma.request.findMany({
      where: { 
        recipientId: session.user.id,
        type: "TRANSFER"
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        userNotes: true,
        adminNotes: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        requesterId: true,
        recipientId: true,
        items: {
          select: {
            id: true,
            quantity: true,
            status: true,
            serialNumber: true,
            clothingSize: true,
            shoeSize: true,
            resolvedAt: true,
            recipientAcceptedAt: true,
            recipientNotes: true,
            resolvedBy: {
              select: {
                id: true,
                name: true,
              },
            },
            equipmentItem: {
              select: {
                id: true,
                name: true,
                isWeapon: true,
                isSight: true,
                isClothing: true,
                isShoe: true,
                category: { select: { division: true } },
              },
            },
          },
        },
        requester: {
          select: { 
            id: true,
            name: true 
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        firstName: true,
        lastName: true,
        personalNumber: true,
        phoneNumber: true,
        shirtSize: true,
        pantsSize: true,
        shoeSize: true,
        weapon: true,
        weaponItemId: true,
        userDepartments: {
          select: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        userPositions: {
          select: {
            position: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.position.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        departmentId: true,
      },
    }),
    prisma.equipmentItem.findMany({
      where: { 
        active: true,
        isWeapon: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  if (!user) {
    throw new Error("משתמש לא נמצא.");
  }

  // Combine sent and received requests, sorted by creation date
  const allRequests = [...sentRequests, ...receivedRequests].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">אזור אישי</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          ניהול ציוד, בקשות ופרטים אישיים.
        </p>
      </section>

      <PersonalTabs
        equipmentTab={<EquipmentTab assignments={assignments} />}
        requestsTab={<RequestsTab requests={allRequests} currentUserId={session.user.id} />}
        detailsTab={<DetailsTab user={user} departments={departments} positions={positions} weaponItems={weaponItems} />}
      />
    </div>
  );
}

