import React from 'react';

/**
 * Reusable component to display logged-in user information
 * @param {Object} userSession - User session data
 * @param {string} userSession.studentName - User's full name
 * @param {string} userSession.studentId - User's student ID
 * @param {string} userSession.email - User's email address
 * @param {string} className - Additional CSS classes
 */
const LoggedInUserCard = ({ userSession, className = "" }) => {
  if (!userSession) {
    return null;
  }

  return (
    <div className={`card-brand-primary ${className}`}>
      <h2 className="text-lg font-headline font-semibold text-primary-900 mb-2">Logged in as</h2>
      <div className="space-brand-small text-sm font-body text-primary-700">
        <div className="form-field-even">
          <span className="font-medium">Name:</span>
          <span>{userSession.studentName}</span>
        </div>
        <div className="form-field-even">
          <span className="font-medium">Student ID:</span>
          <span>{userSession.studentId}</span>
        </div>
        <div className="form-field-even">
          <span className="font-medium">Email:</span>
          <span className="break-words">{userSession.email}</span>
        </div>
      </div>
    </div>
  );
};

export default LoggedInUserCard;