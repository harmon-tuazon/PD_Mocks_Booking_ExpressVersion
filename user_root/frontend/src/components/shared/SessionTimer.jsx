import React, { useState, useEffect, useCallback } from 'react';

const SessionTimer = ({ expiryMinutes = 15, onExpire, onExtend }) => {
  const [timeLeft, setTimeLeft] = useState(expiryMinutes * 60); // in seconds
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onExpire]);

  useEffect(() => {
    // Show warning when less than 2 minutes left
    setShowWarning(timeLeft < 120 && timeLeft > 0);
  }, [timeLeft]);

  const handleExtend = useCallback(() => {
    setTimeLeft(expiryMinutes * 60);
    if (onExtend) onExtend();
  }, [expiryMinutes, onExtend]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!showWarning) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
      <div className="bg-warning-50 border border-warning-200 rounded-lg shadow-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-warning-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-warning-800">
              Session expiring soon
            </p>
            <p className="mt-1 text-sm text-warning-700">
              {formatTime(timeLeft)} remaining
            </p>
          </div>
          <button
            onClick={handleExtend}
            className="ml-3 px-3 py-1 text-sm font-medium text-warning-800 bg-warning-100 rounded-md hover:bg-warning-200 transition-colors"
          >
            Extend
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionTimer;