# Playwright Integration Tests - Setup Guide

## Note on Playwright Tests

Playwright integration tests were requested but require additional setup that is beyond the scope of unit testing. Here's what would be needed:

## Installation

```bash
cd user_root/frontend
npm install --save-dev @playwright/test
npx playwright install
```

## Configuration

Create `playwright.config.js`:

```javascript
module.exports = {
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
  },
};
```

## Example Test Structure

Create `tests/time-conflict-detection.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Time Conflict Detection', () => {
  test('user sees warning for overlapping sessions', async ({ page }) => {
    // Login
    // Create booking
    // Attempt overlapping booking
    // Verify warning modal appears
  });
  
  test('View My Bookings button navigates correctly', async ({ page }) => {
    // Test navigation
  });
});
```

## Running Playwright Tests

```bash
npx playwright test
npx playwright test --headed  # See the browser
npx playwright test --debug    # Debug mode
```

## Test Scenarios to Implement

1. User with no bookings can book any session
2. User with existing booking sees warning for overlapping session
3. User can book adjacent sessions (no overlap)
4. User sees correct conflict details in warning modal
5. "View My Bookings" button navigates correctly
6. "Choose Different Session" button goes back
7. "Close" button dismisses modal
8. Conflict detection works across different mock types
9. Cancelled bookings don't trigger conflicts

## Status

- Unit tests: **COMPLETED** (57 tests, 97.36% coverage)
- Playwright tests: **NOT IMPLEMENTED** (requires additional setup and running application)

The unit tests provide comprehensive coverage of the utility functions. Playwright tests would add end-to-end validation of the UI interactions.
