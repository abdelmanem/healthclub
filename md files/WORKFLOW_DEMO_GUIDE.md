# Reservation Status Workflow - Check-Out Button Visibility

## Status Flow and Available Actions

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   BOOKED     │───▶│  CHECKED_IN  │───▶│ IN_SERVICE   │
└──────────────┘    └──────────────┘    └──────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
   [Check In]          [Start Service]        [Complete]
   [Cancel]                                   
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │  COMPLETED   │ ← CHECK-OUT BUTTON APPEARS HERE!
                                         └──────────────┘
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │ CHECKED_OUT  │
                                         └──────────────┘
```

## Component Logic

In `ReservationActions.tsx`, the check-out button appears in the `'completed'` case:

```typescript
case 'completed':
  actions.push(
    <Button
      key="check-out"
      variant="contained"
      size="small"
      startIcon={<Logout />}
      onClick={() => setCheckOutDialogOpen(true)}
      disabled={processing}
    >
      Check Out
    </Button>
  );
  break;
```

## How to Test

1. **Navigate to**: Appointments → Workflow Demo
2. **Click "Next Status"** until you reach "COMPLETED"
3. **You will see**: A blue "Check Out" button
4. **Click "Check Out"**: Opens the CheckOutDialog with options

## Demo Page Features

- **Interactive Status Flow**: Click "Next Status" to progress
- **Visual Status Indicators**: Color-coded chips show current status
- **Action Buttons**: Shows appropriate actions for each status
- **Check-Out Dialog**: Full workflow with invoice creation option
- **Reset Function**: Start over from "booked" status

## Navigation

- **Direct URL**: `http://localhost:3000/workflow-demo`
- **Via Menu**: Appointments → Workflow Demo
