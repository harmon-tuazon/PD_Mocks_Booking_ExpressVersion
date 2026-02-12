/**
 * InstructorDashboard - Single-page instructor portal
 * Combines stats, groups, and schedule into one dashboard
 * Matches admin MockExamsDashboard styling patterns
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

// ─── Stat Card (matches DashboardMetrics.jsx pattern) ────────
const StatCard = ({ icon: Icon, label, value, bgColor }) => (
  <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
    <div className="p-5">
      <div className="flex items-center">
        <div className={`flex-shrink-0 ${bgColor} dark:bg-opacity-20 rounded-md p-3`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
              {label}
            </dt>
            <dd>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {value ?? '-'}
              </div>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
);

// Loading skeleton for stat cards (matches DashboardMetrics)
const StatCardSkeleton = () => (
  <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg animate-pulse">
    <div className="p-5">
      <div className="flex items-center">
        <div className="flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-md p-3 w-12 h-12" />
        <div className="ml-5 w-0 flex-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
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
    <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {expanded ? (
            <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white truncate">
                {group.group_name || group.group_id}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                group.status === 'active'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {group.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
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
        </div>
      </button>

      {expanded && (
        <div className="bg-gray-50 dark:bg-gray-900 border-l-4 border-primary-500">
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : detail ? (
            <div className="space-y-5 px-6 py-5">
              {/* Students Table */}
              {detail.students && detail.students.length > 0 ? (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Students</h4>
                  <div className="overflow-x-auto bg-white dark:bg-dark-card rounded-lg shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                        {detail.students.map((student, idx) => (
                          <tr key={student.student_id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{idx + 1}</td>
                            <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {[student.firstname, student.lastname].filter(Boolean).join(' ') || student.student_id}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{student.email || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No students enrolled in this group</p>
              )}

              {/* Upcoming Instruction Dates */}
              {detail.instruction_dates && detail.instruction_dates.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Upcoming Instruction Dates</h4>
                  <div className="flex flex-wrap gap-2">
                    {detail.instruction_dates.map((d, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      >
                        {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                        {d.time && <span className="ml-1 text-blue-600 dark:text-blue-300">{d.time}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 px-6 py-5">Failed to load group details</p>
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

  const firstName = profile?.instructor_name?.split(' ')[0] || 'Instructor';

  return (
    <div className="space-y-6">
      {/* Page Header (matches MockExamsDashboard) */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
            Welcome back, {profileLoading ? '...' : firstName}!
          </h1>
          <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
            Here's your teaching overview
          </p>
        </div>
      </div>

      {/* Stats Cards (matches DashboardMetrics grid) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={UserGroupIcon}
              label="Active Groups"
              value={stats?.active_groups}
              bgColor="bg-blue-500"
            />
            <StatCard
              icon={AcademicCapIcon}
              label="Total Students"
              value={stats?.total_trainees}
              bgColor="bg-green-500"
            />
            <StatCard
              icon={CalendarDaysIcon}
              label="Upcoming Sessions"
              value={stats?.upcoming_sessions}
              bgColor="bg-purple-500"
            />
          </>
        )}
      </div>

      {/* Next Session Card */}
      {stats?.next_session && (
        <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
          <div className="p-5">
            <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Next Session</h2>
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-primary-100 dark:bg-primary-900/20 rounded-md p-3">
                <CalendarDaysIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
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
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Group: {stats.next_session.group_name}
                  {stats.next_session.trainee_count > 0 && (
                    <span> &middot; {stats.next_session.trainee_count} students</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── My Groups Section ──────────────────────────────── */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100">My Groups</h2>
          <div className="flex items-center gap-1.5">
            {['active', 'completed', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  statusFilter === status
                    ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {groupsLoading ? (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
            <div className="animate-pulse p-6">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
        ) : groupsError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
            Failed to load groups. Please try again.
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
            <div className="text-center py-12">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No {statusFilter !== 'all' ? statusFilter : ''} groups found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Try adjusting your filter above.
              </p>
            </div>
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100">Upcoming Schedule</h2>
            {!scheduleLoading && (
              <p className="mt-1 font-body text-sm text-gray-600 dark:text-gray-300">
                Next {days} days &middot; {totalSessions} sessions
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  days === d
                    ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {scheduleLoading ? (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
            <div className="animate-pulse p-6">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
        ) : scheduleError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
            Failed to load schedule. Please try again.
          </div>
        ) : schedule.length === 0 ? (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
            <div className="text-center py-12">
              <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No upcoming sessions</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No sessions in the next {days} days.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 sm:rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Groups</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                  {schedule.map((day) =>
                    day.sessions.map((session, sessionIdx) => (
                      <tr key={`${day.date}-${sessionIdx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        {sessionIdx === 0 ? (
                          <td className="px-6 py-4" rowSpan={day.sessions.length}>
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                          </td>
                        ) : null}
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {session.time || '-'}
                          </span>
                          {session.duration_minutes && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                              ({session.duration_minutes}m)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {session.groups.map((group) => (
                              <span
                                key={group.group_id}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              >
                                {group.group_name || group.group_id}
                                <span className="ml-1.5 text-blue-600 dark:text-blue-300">
                                  {group.student_count}s
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorDashboard;
