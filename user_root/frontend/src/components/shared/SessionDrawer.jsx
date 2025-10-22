import React from 'react';
import { format } from 'date-fns';
import { formatTime, formatTimeRange } from '../../services/api';

const SessionDrawer = ({ isOpen, onClose, selectedDate, sessions, onSelectSession }) => {
  if (!isOpen) return null;

  // If we have sessions, show the time slots from the first session
  const availableTimeSlots = sessions && sessions.length > 0 ? sessions : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gray-900 rounded-xl p-8 max-w-4xl w-full mx-4 shadow-2xl">
        <div className="flex gap-8">
          {/* Calendar Side */}
          <div className="flex-1">
            <div className="text-white mb-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {}}
                  className="text-gray-400 hover:text-white"
                  aria-label="Previous month"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-xl font-semibold">
                  {selectedDate && format(selectedDate, 'MMMM yyyy')}
                </h2>
                <button
                  onClick={() => {}}
                  className="text-gray-400 hover:text-white"
                  aria-label="Next month"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Week days */}
              <div className="grid grid-cols-7 gap-2 text-sm text-gray-400 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center py-1">{day}</div>
                ))}
              </div>

              {/* Calendar days - simplified placeholder */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({length: 30}, (_, i) => i + 1).map(day => {
                  const isSelected = selectedDate && day === selectedDate.getDate();
                  return (
                    <button
                      key={day}
                      className={`
                        py-2 px-1 text-sm rounded-md transition-colors
                        ${isSelected
                          ? 'bg-gray-700 text-white font-semibold'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        }
                      `}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Booking confirmation message */}
            {selectedDate && availableTimeSlots.length > 0 && (
              <div className="text-gray-300 text-sm mt-4">
                Your exam is scheduled for {format(selectedDate, 'EEEE, MMMM d')} at {formatTimeRange(availableTimeSlots[0])}.
              </div>
            )}
          </div>

          {/* Time Slots Side */}
          <div className="w-64">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableTimeSlots.length > 0 ? (
                availableTimeSlots.map((session) => (
                  <button
                    key={session.mock_exam_id}
                    onClick={() => onSelectSession(session)}
                    disabled={session.available_slots === 0}
                    className={`
                      w-full py-3 px-4 rounded-lg text-sm font-medium transition-all
                      ${session.available_slots > 0
                        ? 'bg-gray-700 text-white hover:bg-gray-600 active:scale-95'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span>{formatTimeRange(session)}</span>
                      {session.available_slots === 0 && (
                        <span className="text-xs text-red-400">Full</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {session.location} • {session.available_slots} slots
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-gray-400 text-center py-8">
                  No sessions available for this date
                </div>
              )}
            </div>

            {/* Continue Button */}
            <div className="mt-6 space-y-3">
              {availableTimeSlots.length > 0 && (
                <button
                  onClick={() => availableTimeSlots.length > 0 && onSelectSession(availableTimeSlots[0])}
                  className="w-full bg-white text-gray-900 py-3 px-4 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Continue
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full bg-gray-800 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDrawer;