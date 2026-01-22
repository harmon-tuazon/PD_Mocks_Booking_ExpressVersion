# Token Refund System - Manual Test Plan

## Test Scenarios

### Scenario 1: Happy Path
1. Cancel 3 bookings with refund toggle ON
2. Verify tokens refunded
3. Check audit log

### Scenario 2: Cancel Without Refund
1. Cancel bookings with toggle OFF
2. Verify no tokens refunded

### Scenario 3: Mixed Token Types
1. Cancel bookings with different token types
2. Verify each type refunded correctly

### Scenario 4: Idempotency
1. Try to cancel already-cancelled bookings
2. Verify no double-refund

### Scenario 5: Large Batch (100 bookings)
1. Cancel 100 bookings
2. Verify completes in < 10 seconds

## Validation Checklist
- [ ] UI updates correctly
- [ ] Toast notifications accurate
- [ ] HubSpot data updated
- [ ] Audit log created
- [ ] No console errors
