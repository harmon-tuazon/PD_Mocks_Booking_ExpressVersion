with open('tests/unit/refund.test.js', 'r') as f:
    content = f.read()

# Replace the jest.mock line
old_mock = "jest.mock('../../api/_shared/hubspot');"
new_mock = """jest.mock('../../api/_shared/hubspot', () => {
  const mockApiCall = jest.fn();
  return {
    apiCall: mockApiCall,
    HUBSPOT_OBJECTS: {
      'contacts': '0-1',
      'bookings': '2-50158943'
    }
  };
});"""

content = content.replace(old_mock, new_mock)

with open('tests/unit/refund.test.js', 'w') as f:
    f.write(content)

print('Updated jest.mock')
