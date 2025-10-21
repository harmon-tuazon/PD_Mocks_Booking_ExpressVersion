import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // You can also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Optionally reload the page
    window.location.href = '/book/exam-types';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-4">
          <div className="card dark:bg-dark-card dark:border-dark-border max-w-2xl w-full">
            <div className="text-center">
              {/* Error Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 bg-error-100 dark:bg-error-900/30 rounded-full mb-4">
                <svg className="w-8 h-8 text-error-600 dark:text-error-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>

              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Oops! Something went wrong
              </h1>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We encountered an unexpected error. Please try again or contact support if the problem persists.
              </p>

              {/* Show error details in development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mb-6 bg-gray-50 dark:bg-dark-hover rounded-lg p-4">
                  <summary className="cursor-pointer font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Error Details (Development Only)
                  </summary>
                  <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={this.handleReset}
                  className="btn-primary"
                >
                  Go to Home
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-outline dark:border-dark-border dark:text-gray-300 dark:hover:bg-dark-hover"
                >
                  Reload Page
                </button>
              </div>

              {/* Support Info */}
              <div className="mt-8 pt-8 border-t dark:border-dark-border text-sm text-gray-500 dark:text-gray-400">
                <p>
                  If you continue to experience issues, please contact support at{' '}
                  <a href="mailto:support@prepdoctors.com" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                    support@prepdoctors.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;