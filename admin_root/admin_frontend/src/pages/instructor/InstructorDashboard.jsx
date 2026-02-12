import React from 'react';
import { Link } from 'react-router-dom';
import { useInstructorProfile, useInstructorDashboardStats, useInstructorGroups } from '../../hooks/useInstructorPortalData';
import { UserGroupIcon, AcademicCapIcon, CalendarDaysIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{value ?? '-'}</p>
      </div>
    </div>
  </div>
);

const InstructorDashboard = () => {
  const { data: profileRes, isLoading: profileLoading } = useInstructorProfile();
  const { data: statsRes, isLoading: statsLoading } = useInstructorDashboardStats();
  const { data: groupsRes, isLoading: groupsLoading } = useInstructorGroups({ status: 'active' });

  const profile = profileRes?.data;
  const stats = statsRes?.data;
  const groups = groupsRes?.data || [];

  const isLoading = profileLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const firstName = profile?.instructor_name?.split(' ')[0] || 'Instructor';

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {firstName}!</h1>
        <p className="text-sm text-gray-500 mt-1">Here's your teaching overview</p>
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Next Session</h2>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {new Date(stats.next_session.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                {stats.next_session.time && (
                  <span className="text-gray-500 ml-2">at {stats.next_session.time}</span>
                )}
              </p>
              <p className="text-sm text-gray-500">
                Group: {stats.next_session.group_name}
                {stats.next_session.trainee_count > 0 && (
                  <span> &middot; {stats.next_session.trainee_count} students</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Groups List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">My Active Groups</h2>
          <Link to="/instructor/groups" className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
            View All <ArrowRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        {groupsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            No active groups assigned
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Group</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Time</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Start Date</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium">Students</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {groups.slice(0, 5).map((group) => (
                  <tr key={group.group_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{group.group_name || group.group_id}</td>
                    <td className="px-5 py-3 text-gray-600">{group.time_period || '-'}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {group.start_date
                        ? new Date(group.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '-'}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600">{group.student_count}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        group.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {group.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorDashboard;
