import React from 'react';
import { useNavigate } from 'react-router-dom';

const InsufficientTokensError = ({
  mockType = 'Mock Exam',
  onGoBack,
  className = ''
}) => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      navigate('/book/exam-types');
    }
  };

  const handleContactRedirect = () => {
    window.open('https://ca.prepdoctors.com/academic-advisors', '_blank');
  };

  const handleEmailClick = () => {
    window.location.href = 'mailto:info@prepdoctors.com';
  };

  const handlePhoneClick = () => {
    window.location.href = 'tel:+18553977737';
  };

  return (
    <div className={`min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12 ${className}`}>
      <div className="max-w-2xl w-full">
        {/* Main Card with Light Theme */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-8 text-center">
          {/* Warning Icon Circle */}
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-500"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl font-bold text-red-500 mb-4">
            Insufficient Tokens
          </h1>

          {/* Main Message */}
          <p className="text-gray-700 text-base mb-2 leading-relaxed">
            You don't have enough tokens to book this {mockType}.
          </p>
          <p className="text-gray-700 text-base mb-8 leading-relaxed">
            Please contact our academic advisors for assistance with your token requirements.
          </p>

          {/* Contact Information Section */}
          <div className="bg-red-50 border border-red-100 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Need Help? Contact Us
            </h2>

            <div className="space-y-4">
              {/* Email Contact */}
              <button
                onClick={handleEmailClick}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-lg p-4 transition-all duration-200 group"
                aria-label="Send email to PrepDoctors support"
              >
                <div className="flex items-center justify-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-500 group-hover:text-gray-700"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 group-hover:text-gray-900">
                      Email Support
                    </p>
                    <p className="text-sm text-gray-500 group-hover:text-gray-600">
                      info@prepdoctors.com
                    </p>
                  </div>
                </div>
              </button>

              {/* Phone Contact */}
              <button
                onClick={handlePhoneClick}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-lg p-4 transition-all duration-200 group"
                aria-label="Call PrepDoctors support"
              >
                <div className="flex items-center justify-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-500 group-hover:text-gray-700"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 group-hover:text-gray-900">
                      Call Support
                    </p>
                    <p className="text-sm text-gray-500 group-hover:text-gray-600">
                      +1 855-397-7737
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Go Back Button */}
            <button
              onClick={handleGoBack}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400 font-medium py-3 px-4 rounded-lg transition-all duration-200 inline-flex items-center justify-center"
              aria-label="Go back to exam types selection"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Go Back to Exam Types
            </button>

            {/* Primary Contact Button */}
            <button
              onClick={handleContactRedirect}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 inline-flex items-center justify-center shadow-lg hover:shadow-xl"
              aria-label="Visit academic advisors page for assistance"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
              Contact Academic Advisors
            </button>
          </div>

          {/* Additional Information */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg
                    className="w-5 h-5 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-blue-900 text-sm mb-1">
                    Why am I seeing this?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Your account doesn't have sufficient tokens for this {mockType.toLowerCase()}.
                    Our academic advisors can help you understand your token balance and guide you
                    through purchasing additional tokens if needed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-6 pt-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              Our support team is available Monday through Friday, 9 AM to 5 PM EST.
              <br />
              We typically respond to emails within 24 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsufficientTokensError;