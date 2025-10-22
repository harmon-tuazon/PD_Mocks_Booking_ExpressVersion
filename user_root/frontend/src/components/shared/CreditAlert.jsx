import React from 'react';

const CreditAlert = ({ credits, creditBreakdown, mockType, variant = 'info' }) => {
  if (credits === null || credits === undefined || !creditBreakdown) {
    return null;
  }

  const variants = {
    success: {
      container: 'bg-success-50 border-success-200',
      icon: 'text-success-600',
      text: 'text-success-800',
    },
    warning: {
      container: 'bg-warning-50 border-warning-200',
      icon: 'text-warning-600',
      text: 'text-warning-800',
    },
    error: {
      container: 'bg-error-50 border-error-200',
      icon: 'text-error-600',
      text: 'text-error-800',
    },
    info: {
      container: 'bg-primary-50 border-primary-200',
      icon: 'text-primary-600',
      text: 'text-primary-800',
    },
  };

  const styles = variants[variant] || variants.info;

  const getIcon = () => {
    switch (variant) {
      case 'success':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  // Get token type names based on mock type
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

  const { specific_credits = 0, shared_credits = 0 } = creditBreakdown;
  const specificTokenName = getSpecificTokenName(mockType);

  return (
    <div className={`border rounded-lg overflow-hidden ${styles.container}`}>
      <div className="p-3">
        <div className="flex">
          <div className={`flex-shrink-0 ${styles.icon}`}>
            {getIcon()}
          </div>
          <div className="ml-2 flex-1">
            <h3 className={`font-subheading text-sm font-medium ${styles.text}`}>
              {credits > 0 ? 'Token Verification Successful' : 'Insufficient Tokens'}
            </h3>
            <div className={`mt-2 ${styles.text}`}>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <tbody className="divide-y divide-gray-200">
                    {mockType !== 'Mock Discussion' && (
                      <tr className="bg-white">
                        <td className="px-2 py-1.5 text-xs font-medium text-gray-900">
                          {specificTokenName}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                            specific_credits > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {specific_credits}
                          </span>
                        </td>
                      </tr>
                    )}
                    {mockType !== 'Mini-mock' && mockType !== 'Mock Discussion' && (
                      <tr className="bg-gray-50">
                        <td className="px-2 py-1.5 text-xs font-medium text-gray-900">
                          Shared Mock Tokens
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                            shared_credits > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {shared_credits}
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr className="bg-gray-50 font-medium">
                      <td className="px-2 py-1.5 text-xs font-bold text-gray-900">
                        Total for {mockType}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right">
                        <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                          credits > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {credits}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {credits > 0 && (
                <p className="mt-2 font-body text-xs text-gray-600">
                  You have sufficient tokens to book this exam.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditAlert;