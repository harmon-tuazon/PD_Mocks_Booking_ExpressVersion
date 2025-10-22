import React from 'react';

const TokenCard = ({ creditBreakdown, mockType, compact = false, className = "", isAfterBooking = false }) => {
  if (!creditBreakdown) {
    return null;
  }

  // For Mock Discussion, credit structure is simpler (just available_credits)
  const isMockDiscussion = mockType === 'Mock Discussion';
  const { specific_credits = 0, shared_credits = 0, available_credits } = creditBreakdown;

  // Get the specific token type name based on mock type
  const getSpecificTokenName = (type) => {
    switch (type) {
      case 'Situational Judgment':
        return 'SJ Tokens';
      case 'Clinical Skills':
        return 'CS Tokens';
      case 'Mini-mock':
        return 'Mini-Mock Tokens';
      case 'Mock Discussion':
        return 'Mock Discussion Tokens';
      default:
        return 'Specific Tokens';
    }
  };

  // Handle token data based on type
  let tokenData;
  let total;

  if (isMockDiscussion) {
    // Mock Discussion only has a single token type
    tokenData = [
      {
        type: getSpecificTokenName(mockType),
        amount: available_credits || 0,
      },
    ];
    total = available_credits || 0;
  } else {
    // Regular exam tokens with specific and shared credits
    tokenData = [
      {
        type: getSpecificTokenName(mockType),
        amount: specific_credits,
      },
    ];

    // Only add shared mock tokens for non-mini-mock types
    if (mockType !== 'Mini-mock') {
      tokenData.push({
        type: 'Shared Mock Tokens',
        amount: shared_credits,
      });
    }

    total = specific_credits + (mockType !== 'Mini-mock' ? shared_credits : 0);
  }

  if (compact) {
    return (
      <div className={`bg-white dark:bg-dark-card border dark:border-dark-border rounded-lg overflow-hidden shadow-sm ${className}`}>
        <div className="px-3 py-2 border-b dark:border-dark-border">
          <h3 className="font-subheading text-sm font-medium text-primary-900 dark:text-gray-100">
            {isAfterBooking ? 'Remaining Tokens' : 'Available Tokens'}
          </h3>
          <p className="font-body text-xs text-primary-600 dark:text-gray-400 mt-0.5">
            {isAfterBooking ? 'Your current balance after booking' : 'Your current balance'}
          </p>
        </div>
        <div className="p-3">
          <div className="space-y-1.5">
            {tokenData.map((token, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="font-body text-sm text-gray-700 dark:text-gray-300">{token.type}</span>
                <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                  token.amount > 0
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-dark-hover text-gray-800 dark:text-gray-300'
                }`}>
                  {token.amount}
                </span>
              </div>
            ))}
            <div className="pt-1.5 mt-1.5 border-t dark:border-dark-border flex justify-between items-center">
              <span className="font-body text-sm font-medium text-gray-900 dark:text-gray-100">Total</span>
              <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                total > 0
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
              }`}>
                {total}
              </span>
            </div>
          </div>
        </div>
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-dark-bg text-xs text-gray-500 dark:text-gray-400">
          Tokens deducted automatically
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-dark-card border dark:border-dark-border rounded-lg overflow-hidden shadow-sm ${className}`}>
      <div className="px-3 py-2 border-b dark:border-dark-border">
        <h3 className="font-subheading text-sm font-medium text-primary-900 dark:text-gray-100">Remaining Tokens</h3>
        <p className="font-body text-xs text-primary-600 dark:text-gray-400 mt-0.5">Your current balance after booking</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-dark-bg">
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Token Type
              </th>
              <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
            {tokenData.map((token, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-dark-card' : 'bg-gray-50 dark:bg-dark-bg/50'}>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                    {token.type}
                  </div>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                  <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                    token.amount > 0
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-dark-hover text-gray-800 dark:text-gray-300'
                  }`}>
                    {token.amount}
                  </span>
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 dark:bg-dark-bg/50 font-medium">
              <td className="px-2 py-1.5 whitespace-nowrap">
                <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  Total Available
                </div>
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap text-center">
                <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                  total > 0
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                }`}>
                  {total}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-2 py-1 bg-gray-50 dark:bg-dark-bg text-xs text-gray-500 dark:text-gray-400">
        Tokens are automatically deducted when you book an exam.
      </div>
    </div>
  );
};

export default TokenCard;
