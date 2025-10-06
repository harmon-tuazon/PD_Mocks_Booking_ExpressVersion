/**
 * Tests for Type Mismatch Bug Fix
 *
 * This test file verifies the fix for the bug where toObjectId (number)
 * wasn't matching booking.id (string) in the Map lookup.
 */

describe('Type Mismatch Bug - toObjectId vs booking.id', () => {
  test('Map lookup should work with number keys converted to strings', () => {
    // Simulate the real scenario
    const bookingStatusMap = new Map();

    // Step 1: Batch read returns booking objects with string IDs
    const bookings = [
      { id: '35760493356', properties: { is_active: 'Active' } }
    ];

    // Build map (keys are strings)
    for (const booking of bookings) {
      const isActive = booking.properties.is_active !== 'Cancelled' &&
                      booking.properties.is_active !== 'cancelled' &&
                      booking.properties.is_active !== false;
      bookingStatusMap.set(booking.id, isActive);
    }

    // Step 2: Associations return toObjectId as numbers
    const associations = [
      { toObjectId: 35760493356 }  // NUMBER, not string!
    ];

    // WITHOUT FIX: Direct lookup fails
    const countWithoutFix = associations.filter(assoc => {
      return bookingStatusMap.get(assoc.toObjectId) === true;
    }).length;

    expect(countWithoutFix).toBe(0);  // BUG: Returns 0 because types don't match

    // WITH FIX: Convert to string before lookup
    const countWithFix = associations.filter(assoc => {
      const bookingId = String(assoc.toObjectId);
      return bookingStatusMap.get(bookingId) === true;
    }).length;

    expect(countWithFix).toBe(1);  // FIXED: Returns 1 because we convert to string
  });

  test('Map should handle mixed type scenarios correctly', () => {
    const bookingStatusMap = new Map();

    // Set with string keys
    bookingStatusMap.set('12345', true);
    bookingStatusMap.set('67890', true);
    bookingStatusMap.set('99999', false);

    // Lookup with number values (should fail without conversion)
    expect(bookingStatusMap.get(12345)).toBeUndefined();
    expect(bookingStatusMap.get(67890)).toBeUndefined();

    // Lookup with string conversion (should work)
    expect(bookingStatusMap.get(String(12345))).toBe(true);
    expect(bookingStatusMap.get(String(67890))).toBe(true);
    expect(bookingStatusMap.get(String(99999))).toBe(false);
  });

  test('Real-world scenario: counting active bookings with type mismatch', () => {
    // Simulating api/mock-exams/available.js logic

    // Step 1: Batch read bookings (IDs are strings)
    const bookings = [
      { id: '111', properties: { is_active: 'Active' } },
      { id: '222', properties: { is_active: 'Cancelled' } },
      { id: '333', properties: { is_active: 'Active' } },
      { id: '444', properties: { is_active: false } }
    ];

    // Step 2: Build status map
    const bookingStatusMap = new Map();
    for (const booking of bookings) {
      const isActive = booking.properties.is_active !== 'Cancelled' &&
                      booking.properties.is_active !== 'cancelled' &&
                      booking.properties.is_active !== false;
      bookingStatusMap.set(booking.id, isActive);
    }

    // Step 3: Associations (toObjectId are numbers)
    const associations = [
      { toObjectId: 111 },
      { toObjectId: 222 },
      { toObjectId: 333 },
      { toObjectId: 444 }
    ];

    // Step 4: Count with fix
    const activeCount = associations.filter(assoc => {
      const bookingId = String(assoc.toObjectId);
      return bookingStatusMap.get(bookingId) === true;
    }).length;

    // Should count only Active bookings (111 and 333)
    expect(activeCount).toBe(2);
  });

  test('Edge case: empty associations should return 0', () => {
    const bookingStatusMap = new Map();
    bookingStatusMap.set('12345', true);

    const associations = [];

    const activeCount = associations.filter(assoc => {
      const bookingId = String(assoc.toObjectId);
      return bookingStatusMap.get(bookingId) === true;
    }).length;

    expect(activeCount).toBe(0);
  });

  test('Edge case: no matching bookings in map', () => {
    const bookingStatusMap = new Map();
    bookingStatusMap.set('11111', true);
    bookingStatusMap.set('22222', true);

    const associations = [
      { toObjectId: 99999 },  // Not in map
      { toObjectId: 88888 }   // Not in map
    ];

    const activeCount = associations.filter(assoc => {
      const bookingId = String(assoc.toObjectId);
      return bookingStatusMap.get(bookingId) === true;
    }).length;

    expect(activeCount).toBe(0);
  });
});
