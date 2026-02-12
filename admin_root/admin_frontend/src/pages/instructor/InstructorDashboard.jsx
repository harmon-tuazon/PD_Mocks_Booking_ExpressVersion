/**
 * InstructorDashboard - Single-page instructor portal
 * Combines stats, groups, and schedule into one dashboard
 * Uses admin dashboard styling (dark mode support)
 */

import React, { useState } from 'react';
import {
  useInstructorProfile,
  useInstructorDashboardStats,
  useInstructorGroups,
  useInstructorGroupDetail,
  useInstructorSchedule
} from '../../hooks/useInstructorPortalData';
import {
  UserGroupIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

// ─── Stat Card ───────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-gray-900/50 border border-gray-200 dark:border-dark-border p-5">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value ?? '-'}</p>
      </div>
    </div>
  </div>
);

// ─── Expandable Group Card ───────────────────────────────────
const GroupCard = ({ group }) => {
  const [expanded, setExpanded] = useState(false);
  const { data: detailRes, isLoading: detailLoading } = useInstructorGroupDetail(
    expanded ? group.group_id : null
  );
  const detail = detailRes?.data;

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-gray-900/50 border border-gray-200 dark:border-dark-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {group.group_name || group.group_id}
            </h3>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              group.status === 'active'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
              {group.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {group.time_period || '-'}
            {group.start_date && (
              <span>
                {' '}&middot; {new Date(group.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {group.end_date && (
                  <span> - {new Date(group.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                )}
              </span>
            )}
            {' '}&middot; {group.student_count} students
          </p>
        </div>
        {expanded ? (
          <ChevronDownIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRightIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-dark-border px-5 py-4">
          {detailLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {detail.students && detail.students.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Students</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-dark-border">
                          <th className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">#</th>
                          <th className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Name</th>
                          <th className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.students.map((student, idx) => (
                          <tr key={student.student_id || idx} className="border-b border-gray-50 dark:border-gray-800">
                            <td className="py-2 pr-4 text-gray-400 dark:text-gray-500">{idx + 1}</td>
                            <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">
                              {[student.firstname, student.lastname].filter(Boolean).join(' ') || student.student_id}
                            </td>
                            <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{student.email || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No students enrolled in this group</p>
              )}

              {detail.instruction_dates && detail.instruction_dates.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Upcoming Instruction Dates</h4>
                  <div className="flex flex-wrap gap-2">
                    {detail.instruction_dates.map((d, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-medium"
                      >
                        {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                        {d.time && <span className="ml-1 text-primary-500 dark:text-primary-400">{d.time}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load group details</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────
const InstructorDashboard = () => {
  const { data: profileRes, isLoading: profileLoading } = useInstructorProfile();
  const { data: statsRes, isLoading: statsLoading } = useInstructorDashboardStats();

  // Groups state
  const [statusFilter, setStatusFilter] = useState('active');
  const { data: groupsRes, isLoading: groupsLoading, error: groupsError } = useInstructorGroups({ status: statusFilter });
  const groups = groupsRes?.data || [];

  // Schedule state
  const [days, setDays] = useState(30);
  const { data: scheduleRes, isLoading: scheduleLoading, error: scheduleError } = useInstructorSchedule({ days, limit: 50 });
  const schedule = scheduleRes?.data?.schedule || [];
  const totalSessions = scheduleRes?.data?.total_sessions || 0;

  const profile = profileRes?.data;
  const stats = statsRes?.data;

  if (profileLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const firstName = profile?.instructor_name?.split(' ')[0] || 'Instructor';

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome back, {firstName}!</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Here's your teaching overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={UserGroupIcon}
          label="Active Groups"
          value={stats?.active_groups}
          color="bg-blue-500"
        />
        <StatCard
          icon={AcademicCapIcon}
          label="Total Students"
          value={stats?.total_trainees}
          color="bg-green-500"
        />
        <StatCard
          icon={CalendarDaysIcon}
          label="Upcoming Sessions"
          value={stats?.upcoming_sessions}
          color="bg-purple-500"
        />
      </div>

      {/* Next Session */}
      {stats?.next_session && (
        <div className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-gray-900/50 border border-gray-200 dark:border-dark-border p-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Next Session</h2>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <CalendarDaysIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {new Date(stats.next_session.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                {stats.next_session.time && (
                  <span className="text-gray-500 dark:text-gray-400 ml-2">at {stats.next_session.time}</span>
                )}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Group: {stats.next_session.group_name}
                {stats.next_session.trainee_count > 0 && (
                  <span> &middot; {stats.next_session.trainee_count} students</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── My Groups Section ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">My Groups</h2>
          <div className="flex items-center gap-2">
            {['active', 'completed', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-white dark:bg-dark-card text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover border border-gray-200 dark:border-dark-border'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {groupsLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : groupsError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
            Failed to load groups. Please try again.
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-gray-900/50 border border-gray-200 dark:border-dark-border p-8 text-center">
            <UserGroupIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No {statusFilter !== 'all' ? statusFilter : ''} groups found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <GroupCard key={group.group_id} group={group} />
            ))}
          </div>
        )}
      </div>

      {/* ─── Upcoming Schedule Section ──────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Upcoming Schedule</h2>
            {!scheduleLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Next {days} days &middot; {totalSessions} sessions
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  days === d
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-white dark:bg-dark-card text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover border border-gray-200 dark:border-dark-border'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {scheduleLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : scheduleError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
            Failed to load schedule. Please try again.
          </div>
        ) : schedule.length === 0 ? (
          <div className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-gray-900/50 border border-gray-200 dark:border-dark-border p-8 text-center">
            <CalendarDaysIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No upcoming sessions in the next {days} days</p>
          </div>
        ) : (
          <div className="space-y-4">
            {schedule.map((day) => (
              <div key={day.date} className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-gray-900/50 border border-gray-200 dark:border-dark-border overflow-hidden">
                {/* Day Header */}
                <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-dark-border">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h3>
                </div>

                {/* Sessions */}
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {day.sessions.map((session, sessionIdx) => (
                    <div key={sessionIdx} className="px-5 py-3">
                      {session.time && (
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">
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
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-md"
                          >
                            <span className="text-sm font-medium text-primary-800 dark:text-primary-200">
                              {group.group_name || group.group_id}
                            </span>
                            {group.time_period && (
                              <span className="text-xs text-primary-500 dark:text-primary-400">{group.time_period}</span>
                            )}
                            <span className="text-xs text-primary-400 dark:text-primary-500">
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
    </div>
  );
};

export default InstructorDashboard;
