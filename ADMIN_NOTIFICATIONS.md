# Admin Notification System

## Overview
This document describes the admin notification system that alerts all admins (ADMIN and SUPER_ADMIN roles) when new requests are created.

## Features

### 1. Real-time Notifications
- Automatically polls every 5 seconds for new notifications
- Displays as pop-up cards in the top-right corner (top-center on mobile)
- Shows request type, requester name, items summary, and timestamp

### 2. Color-coded by Request Type
Each notification is outlined with a color matching the request type:

- **NEW_EQUIPMENT**: Blue border (`border-blue-500`)
- **RETURN_EQUIPMENT**: Purple border (`border-purple-500`)
- **DAMAGED**: Yellow border (`border-yellow-500`)
- **STOLEN**: Red border (`border-red-500`)
- **MISSING**: Gray border (`border-zinc-500`)
- **USED**: Orange border (`border-orange-500`)
- **TRANSFER**: Green border (`border-green-500`)

### 3. Dismissal & Persistence
- Each notification has an "X" button to dismiss individually
- Dismissed notifications are stored in localStorage
- "Clear All" button with confirmation dialog to dismiss all at once
- Dismissed state syncs with database for consistency across devices

### 4. Mobile Responsive
- Full-width on mobile devices with appropriate padding
- Touch-friendly buttons and interactions
- Smooth animations

### 5. Exclusions
- **No notifications for ADMIN_ASSIGNMENT requests** (as requested)
- Only admins see notifications

## Technical Implementation

### Database Schema
```prisma
model AdminNotification {
  id           String   @id @default(cuid())
  requestId    String
  requestType  String
  requesterName String
  itemsSummary String
  createdAt    DateTime @default(now())
  dismissed    Boolean  @default(false)

  @@index([dismissed, createdAt(sort: Desc)])
  @@index([requestId])
}
```

### API Routes
1. `GET /api/admin/notifications` - Fetch undismissed notifications
2. `POST /api/admin/notifications/dismiss` - Dismiss a single notification
3. `POST /api/admin/notifications/dismiss-all` - Dismiss multiple notifications

### Components
- **AdminNotifications** (`src/app/(app)/admin/_components/AdminNotifications.tsx`)
  - Client component with polling logic
  - localStorage integration for dismissed state
  - Click notification to navigate to `/admin/requests`

### Integration Points
1. **Request Creation** (`src/app/(app)/requests/actions.ts`)
   - Creates notification in database when a request is made
   - Excludes ADMIN_ASSIGNMENT type
   
2. **App Layout** (`src/app/(app)/layout.tsx`)
   - Conditionally renders `<AdminNotifications />` for admin users only

## Usage

### For Admins
1. When a user creates any request (except ADMIN_ASSIGNMENT), a notification appears
2. Click the notification to go to the requests page
3. Click the "X" to dismiss individual notifications
4. Click "נקה הכל" (Clear All) to dismiss all, then confirm

### For Developers
To create a notification manually:
```typescript
await prisma.adminNotification.create({
  data: {
    requestId: "request_id",
    requestType: "NEW_EQUIPMENT",
    requesterName: "User Name",
    itemsSummary: "Item 1 (2), Item 2 (1)",
  },
});
```

## Testing
1. Log in as an admin user
2. Switch to a regular user account (or use another browser/incognito)
3. Create a request (equipment, return, declaration, or transfer)
4. Switch back to admin view
5. Notification should appear within 5 seconds
6. Test dismissal and clear all functionality

## Future Enhancements
- Real-time WebSocket/Server-Sent Events instead of polling
- Sound/browser notifications
- Notification history page
- Per-admin notification preferences
- Badge count on navigation
