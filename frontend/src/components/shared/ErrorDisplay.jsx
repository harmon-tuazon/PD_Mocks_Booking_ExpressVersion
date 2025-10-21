import React from 'react';
import { useNavigate } from 'react-router-dom';
import { parseErrorMessage, getErrorActionHandler } from '../../utils/errorMessages';

const ErrorDisplay = ({
  error,
  onDismiss,
  variant = 'error',
  className = '',
  showAction = true
}) => {
  const navigate = useNavigate();

  if (!error) return null;

  // Parse error to get user-friendly message
  const errorInfo = parseErrorMessage(error);

  // FIX: Log error parsing for debugging
  console.log('🔍 ErrorDisplay received:', {
    rawError: error,
    parsedErrorInfo: errorInfo,
    hasAction: !!errorInfo.action,
    actionType: errorInfo.actionType
  });

  // Override variant if severity is provided in error info
  const displayVariant = errorInfo.severity || variant;

  const variants = {
    error: {
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      titleColor: 'text-red-900 dark:text-red-200',
      textColor: 'text-red-800 dark:text-red-300',
      iconColor: 'text-red-400 dark:text-red-400',
      buttonColor: 'bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900/70 text-red-900 dark:text-red-200',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )
    },
    warning: {
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      titleColor: 'text-yellow-900 dark:text-yellow-200',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      iconColor: 'text-yellow-400 dark:text-yellow-400',
      buttonColor: 'bg-yellow-100 dark:bg-yellow-900/50 hover:bg-yellow-200 dark:hover:bg-yellow-900/70 text-yellow-900 dark:text-yellow-200',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    },
    info: {
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      titleColor: 'text-blue-900 dark:text-blue-200',
      textColor: 'text-blue-800 dark:text-blue-300',
      iconColor: 'text-blue-400 dark:text-blue-400',
      buttonColor: 'bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-900/70 text-blue-900 dark:text-blue-200',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      )
    }
  };

  const style = variants[displayVariant] || variants.error;

  // Get action handler if action is available
  const handleAction = showAction && errorInfo.actionType
    ? getErrorActionHandler(errorInfo.actionType, navigate)
    : null;

  return (
    <div className={`rounded-md ${style.bgColor} ${style.borderColor} border p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <div className={style.iconColor}>
            {style.icon}
          </div>
        </div>
        <div className="ml-3 flex-1">
          {/* Error Title */}
          {errorInfo.title && (
            <h3 className={`text-sm font-medium ${style.titleColor} mb-1`}>
              {errorInfo.title}
            </h3>
          )}

          {/* Error Message */}
          <p className={`text-sm ${style.textColor}`}>
            {errorInfo.message || 'An error occurred'}
          </p>

          {/* Action Button */}
          {showAction && errorInfo.action && handleAction && (
            <div className="mt-3">
              <button
                onClick={handleAction}
                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md ${style.buttonColor} transition-colors duration-200`}
              >
                {errorInfo.action}
                {errorInfo.actionType === 'support' && (
                  <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
                {errorInfo.actionType === 'back' && (
                  <svg className="ml-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                )}
                {errorInfo.actionType === 'retry' && (
                  <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={onDismiss}
                className={`inline-flex rounded-md p-1.5 ${style.iconColor} hover:${style.bgColor} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-${style.bgColor} focus:ring-${style.borderColor} transition-colors duration-200`}
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;