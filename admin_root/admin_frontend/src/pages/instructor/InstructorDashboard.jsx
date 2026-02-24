/**
 * InstructorDashboard - Single-page instructor portal
 * Combines stats, groups, and schedule into one dashboard
 * Matches admin MockExamsDashboard styling patterns
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useInstructorProfile,
  useInstructorDashboardStats,
  useInstructorGroups,
  useInstructorGroupDetail,
  useInstructorSchedule,
  useMarkBookings
} from '../../hooks/useInstructorPortalData';
import {
  UserGroupIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon
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

            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 px-6 py-5">Failed to load group details</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────────
const formatTime = (timeStr) => {
  if (!timeStr) return '-';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hours = h % 12 || 12;
  return `${hours}:${String(m).padStart(2, '0')} ${period}`;
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
  const [scheduleFilter, setScheduleFilter] = useState('upcoming');
  const [schedulePage, setSchedulePage] = useState(1);
  const { data: scheduleRes, isLoading: scheduleLoading, error: scheduleError } = useInstructorSchedule({
    filter: scheduleFilter,
    page: schedulePage,
    limit: 25
  });
  const schedule = scheduleRes?.data?.schedule || [];
  const totalSessions = scheduleRes?.data?.total_sessions || 0;
  const scheduleTotalPages = scheduleRes?.data?.total_pages || 1;

  // Mark bookings mutation
  const markBookingsMutation = useMarkBookings();
  const [markingBookingId, setMarkingBookingId] = useState(null);

  const handleToggleMark = async (booking) => {
    const action = booking.status === 'marked' ? 'unmark' : 'mark';
    setMarkingBookingId(booking.id);
    try {
      await markBookingsMutation.mutateAsync({ bookingIds: [booking.id], action });
      toast.success(action === 'mark' ? 'Booking marked as completed' : 'Booking unmarked');
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || 'Failed to update booking');
    } finally {
      setMarkingBookingId(null);
    }
  };

  // Reset to page 1 when filter changes
  const handleScheduleFilterChange = (filter) => {
    setScheduleFilter(filter);
    setSchedulePage(1);
  };

  const profile = profileRes?.data;
  const stats = statsRes?.data;

  const firstName = profile?.instructor_name?.split(' ')[0] || 'Instructor';

  return (
    <div className="container-app py-8">
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
                    <span className="text-gray-500 dark:text-gray-400 ml-2">at {formatTime(stats.next_session.time)}</span>
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

      {/* ─── Schedule Section ─────────────────────────────────── */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100">Schedule</h2>
            {!scheduleLoading && (
              <p className="mt-1 font-body text-sm text-gray-600 dark:text-gray-300">
                {totalSessions} session{totalSessions !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { key: 'today', label: 'Today' },
              { key: 'this_week', label: 'This Week' },
              { key: 'upcoming', label: 'Upcoming' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleScheduleFilterChange(key)}
                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  scheduleFilter === key
                    ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {label}
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
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No sessions found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {scheduleFilter === 'today' ? 'No sessions scheduled for today.' :
                 scheduleFilter === 'this_week' ? 'No sessions scheduled this week.' :
                 'No upcoming sessions.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 sm:rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 font-body">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Groups</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-3 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Mark</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                  {schedule.map((day) => {
                    // Filter to only sessions that have bookings
                    const sessionsWithBookings = day.sessions.filter(s => s.bookings && s.bookings.length > 0);
                    if (sessionsWithBookings.length === 0) return null;

                    // Total booking rows for this day (for date rowSpan)
                    const dayTotalRows = sessionsWithBookings.reduce((sum, s) => sum + s.bookings.length, 0);

                    let isFirstRowOfDay = true;

                    return sessionsWithBookings.map((session, sessionIdx) => {
                      const bookings = session.bookings;
                      const totalBookingRows = bookings.length;

                      return bookings.map((booking, bookingIdx) => {
                        const showDateCell = isFirstRowOfDay;
                        if (isFirstRowOfDay) isFirstRowOfDay = false;

                        return (
                          <tr key={`${day.date}-${sessionIdx}-${bookingIdx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            {/* Date cell: spans all booking rows for the entire day */}
                            {showDateCell && (
                              <td className="px-6 py-4" rowSpan={dayTotalRows}>
                                <div className="flex items-center gap-2">
                                  <CalendarDaysIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </td>
                            )}

                            {/* Time cell: spans all booking rows for this session */}
                            {bookingIdx === 0 && (
                              <td className="px-6 py-4" rowSpan={totalBookingRows}>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {formatTime(session.time)}
                                </span>
                              </td>
                            )}

                            {/* Duration cell: spans all booking rows for this session */}
                            {bookingIdx === 0 && (
                              <td className="px-6 py-4" rowSpan={totalBookingRows}>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {session.duration_minutes ? `${session.duration_minutes} min` : '-'}
                                </span>
                              </td>
                            )}

                            {/* Groups cell: spans all booking rows for this session */}
                            {bookingIdx === 0 && (
                              <td className="px-6 py-4" rowSpan={totalBookingRows}>
                                <div className="flex flex-wrap gap-2">
                                  {session.groups.map((group) => (
                                    <span
                                      key={group.group_id}
                                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 whitespace-nowrap"
                                    >
                                      {group.group_name || group.group_id}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            )}

                            {/* Student name column */}
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {booking.student_name}
                              </span>
                            </td>

                            {/* Status column */}
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                                booking.status === 'marked'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                  : booking.status === 'confirmed'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                              }`}>
                                {booking.status}
                              </span>
                            </td>

                            {/* Mark column (circular checkbox, last column) */}
                            <td className="px-3 py-4 text-center">
                              <div className="flex items-center justify-center">
                                {markingBookingId === booking.id ? (
                                  <svg className="animate-spin h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <button
                                    onClick={() => handleToggleMark(booking)}
                                    disabled={booking.status === 'pending'}
                                    className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                                      booking.status === 'marked'
                                        ? 'bg-primary-600 border-primary-600 dark:bg-primary-500 dark:border-primary-500'
                                        : booking.status === 'pending'
                                        ? 'border-gray-300 dark:border-gray-600 opacity-40 cursor-not-allowed'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-400 cursor-pointer'
                                    }`}
                                    title={booking.status === 'pending' ? 'Cannot mark pending bookings' : booking.status === 'marked' ? 'Unmark' : 'Mark as completed'}
                                  >
                                    {booking.status === 'marked' && (
                                      <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    });
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {scheduleTotalPages > 1 && (
              <div className="bg-white dark:bg-dark-card px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Page <span className="font-medium">{schedulePage}</span> of{' '}
                      <span className="font-medium">{scheduleTotalPages}</span>
                      {' '}&middot; {totalSessions} total sessions
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setSchedulePage(p => Math.max(1, p - 1))}
                        disabled={schedulePage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                      </button>

                      {[...Array(Math.min(5, scheduleTotalPages))].map((_, index) => {
                        let pageNumber;
                        if (scheduleTotalPages <= 5) {
                          pageNumber = index + 1;
                        } else if (schedulePage <= 3) {
                          pageNumber = index + 1;
                        } else if (schedulePage >= scheduleTotalPages - 2) {
                          pageNumber = scheduleTotalPages - 4 + index;
                        } else {
                          pageNumber = schedulePage - 2 + index;
                        }

                        return (
                          <button
                            key={pageNumber}
                            onClick={() => setSchedulePage(pageNumber)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              schedulePage === pageNumber
                                ? 'z-10 bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setSchedulePage(p => Math.min(scheduleTotalPages, p + 1))}
                        disabled={schedulePage === scheduleTotalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Mobile pagination */}
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setSchedulePage(p => Math.max(1, p - 1))}
                    disabled={schedulePage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setSchedulePage(p => Math.min(scheduleTotalPages, p + 1))}
                    disabled={schedulePage === scheduleTotalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── My Groups Section ──────────────────────────────── */}
      <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
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

        <div className="p-6">
          {groupsLoading ? (
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          ) : groupsError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
              Failed to load groups. Please try again.
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No {statusFilter !== 'all' ? statusFilter : ''} groups found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Try adjusting your filter above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <GroupCard key={group.group_id} group={group} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default InstructorDashboard;
