import React, { useState } from 'react';
import { useInstructorSchedule } from '../../hooks/useInstructorPortalData';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';

const InstructorSchedule = () => {
  const [days, setDays] = useState(30);
  const { data: scheduleRes, isLoading, error } = useInstructorSchedule({ days, limit: 50 });
  const schedule = scheduleRes?.data?.schedule || [];
  const totalSessions = scheduleRes?.data?.total_sessions || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Schedule</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your instruction sessions for the next {days} days
            {!isLoading && <span> &middot; {totalSessions} sessions</span>}
          </p>
        </div>

        {/* Days filter */}
        <div className="flex items-center gap-2">
          {[7, 14, 30, 60].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Schedule List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load schedule. Please try again.
        </div>
      ) : schedule.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <CalendarDaysIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No upcoming sessions in the next {days} days</p>
        </div>
      ) : (
        <div className="space-y-4">
          {schedule.map((day) => (
            <div key={day.date} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Day Header */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">
                  {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>
              </div>

              {/* Sessions for this day */}
              <div className="divide-y divide-gray-50">
                {day.sessions.map((session, sessionIdx) => (
                  <div key={sessionIdx} className="px-5 py-3">
                    {session.time && (
                      <p className="text-xs font-medium text-gray-400 mb-1">
                        {session.time}
                        {session.duration_minutes && (
                          <span> &middot; {session.duration_minutes} min</span>
                        )}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {session.groups.map((group) => (
                        <div
                          key={group.group_id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-md"
                        >
                          <span className="text-sm font-medium text-blue-800">
                            {group.group_name || group.group_id}
                          </span>
                          {group.time_period && (
                            <span className="text-xs text-blue-500">{group.time_period}</span>
                          )}
                          <span className="text-xs text-blue-400">
                            {group.student_count} students
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstructorSchedule;
