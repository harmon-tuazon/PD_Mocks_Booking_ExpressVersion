import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';

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
    <div className={`min-h-screen bg-gradient-to-br from-coral-50 via-white to-coral-50 dark:from-dark-bg dark:via-dark-card dark:to-dark-bg ${className}`}>
      <div className="container-brand-sm py-12">
        {/* Header with Logo */}
        <div className="flex items-center justify-end mb-8">
          <Logo
            variant="horizontal"
            size="large"
            className="transition-opacity duration-300 hover:opacity-80"
            aria-label="PrepDoctors Logo"
          />
        </div>

        <div className="card-brand dark:bg-dark-card dark:border-dark-border text-center animate-fade-in">
          {/* Warning Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-coral-100 dark:bg-coral-900/30 rounded-full">
              <svg className="w-10 h-10 text-coral-600 dark:text-coral-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Main Message */}
          <h1 className="font-headline text-h2 font-bold text-coral-800 dark:text-coral-400 mb-4">
            Insufficient Tokens
          </h1>
          <p className="font-body text-lg text-coral-700 dark:text-coral-300 mb-8 leading-relaxed">
            You don't have enough tokens to book this {mockType}.
            <br />
            Please contact our academic advisors for assistance with your token requirements.
          </p>

          {/* Contact Information Section */}
          <div className="bg-coral-50 dark:bg-coral-900/20 rounded-lg p-6 mb-8 border border-coral-200 dark:border-coral-800">
            <h2 className="font-subheading text-lg font-semibold text-coral-800 dark:text-coral-300 mb-4">
              Need Help? Contact Us
            </h2>

            <div className="space-y-4">
              {/* Email Contact */}
              <button
                onClick={handleEmailClick}
                className="w-full bg-white dark:bg-dark-bg hover:bg-coral-50 dark:hover:bg-dark-hover border border-coral-200 dark:border-coral-800 hover:border-coral-300 dark:hover:border-coral-700 rounded-lg p-4 transition-all duration-200 group focus-coral"
                aria-label="Send email to PrepDoctors support"
              >
                <div className="flex items-center justify-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-coral-600 dark:text-coral-400 group-hover:text-coral-700 dark:group-hover:text-coral-300" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-subheading font-medium text-coral-800 dark:text-coral-300 group-hover:text-coral-900 dark:group-hover:text-coral-200">
                      Email Support
                    </p>
                    <p className="font-body text-sm text-coral-600 dark:text-coral-400 group-hover:text-coral-700 dark:group-hover:text-coral-300">
                      info@prepdoctors.com
                    </p>
                  </div>
                </div>
              </button>

              {/* Phone Contact */}
              <button
                onClick={handlePhoneClick}
                className="w-full bg-white dark:bg-dark-bg hover:bg-coral-50 dark:hover:bg-dark-hover border border-coral-200 dark:border-coral-800 hover:border-coral-300 dark:hover:border-coral-700 rounded-lg p-4 transition-all duration-200 group focus-coral"
                aria-label="Call PrepDoctors support"
              >
                <div className="flex items-center justify-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-coral-600 dark:text-coral-400 group-hover:text-coral-700 dark:group-hover:text-coral-300" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-subheading font-medium text-coral-800 dark:text-coral-300 group-hover:text-coral-900 dark:group-hover:text-coral-200">
                      Call Support
                    </p>
                    <p className="font-body text-sm text-coral-600 dark:text-coral-400 group-hover:text-coral-700 dark:group-hover:text-coral-300">
                      +1 855-397-7737
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Go Back Button */}
          <div className="mb-6">
            <button
              onClick={handleGoBack}
              className="btn-brand-secondary dark:bg-dark-hover dark:border-dark-border dark:text-gray-200 dark:hover:bg-dark-card w-full btn-large inline-flex items-center justify-center"
              aria-label="Go back to exam types selection"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go Back to Exam Types
            </button>
          </div>

          {/* Primary Action Button */}
          <div className="space-y-4 mb-8">
            <button
              onClick={handleContactRedirect}
              className="btn-brand-primary w-full btn-large text-white"
              aria-label="Visit academic advisors page for assistance"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
              Contact Academic Advisors
            </button>
          </div>

          {/* Additional Information */}
          <div className="pt-6 border-t border-coral-200 dark:border-coral-800">
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-subheading font-semibold text-primary-800 dark:text-primary-200 text-sm mb-1">
                    Why am I seeing this?
                  </h3>
                  <p className="font-body text-sm text-primary-700 dark:text-primary-300 leading-relaxed">
                    Your account doesn't have sufficient tokens for this {mockType.toLowerCase()}. Our academic advisors can help you understand your token balance and guide you through purchasing additional tokens if needed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="font-body text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
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