import React, { useState } from 'react';
import { useInstructorGroups, useInstructorGroupDetail } from '../../hooks/useInstructorPortalData';
import { ChevronDownIcon, ChevronRightIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const GroupCard = ({ group }) => {
  const [expanded, setExpanded] = useState(false);
  const { data: detailRes, isLoading: detailLoading } = useInstructorGroupDetail(
    expanded ? group.group_id : null
  );
  const detail = detailRes?.data;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Group Header - clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">
              {group.group_name || group.group_id}
            </h3>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              group.status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {group.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
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
          <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {detailLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* Students Table */}
              {detail.students && detail.students.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Students</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 pr-4 text-gray-500 font-medium">#</th>
                          <th className="text-left py-2 pr-4 text-gray-500 font-medium">Name</th>
                          <th className="text-left py-2 pr-4 text-gray-500 font-medium">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.students.map((student, idx) => (
                          <tr key={student.student_id || idx} className="border-b border-gray-50">
                            <td className="py-2 pr-4 text-gray-400">{idx + 1}</td>
                            <td className="py-2 pr-4 text-gray-900">
                              {[student.firstname, student.lastname].filter(Boolean).join(' ') || student.student_id}
                            </td>
                            <td className="py-2 pr-4 text-gray-600">{student.email || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No students enrolled in this group</p>
              )}

              {/* Upcoming Instruction Dates */}
              {detail.instruction_dates && detail.instruction_dates.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming Instruction Dates</h4>
                  <div className="flex flex-wrap gap-2">
                    {detail.instruction_dates.map((d, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium"
                      >
                        {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                        {d.time && <span className="ml-1 text-blue-500">{d.time}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Failed to load group details</p>
          )}
        </div>
      )}
    </div>
  );
};

const InstructorGroups = () => {
  const [statusFilter, setStatusFilter] = useState('active');
  const { data: groupsRes, isLoading, error } = useInstructorGroups({ status: statusFilter });
  const groups = groupsRes?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Groups</h1>
        <p className="text-sm text-gray-500 mt-1">View your assigned training groups</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {['active', 'completed', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-blue-100 text-blue-700'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Groups List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load groups. Please try again.
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <UserGroupIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No {statusFilter !== 'all' ? statusFilter : ''} groups found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupCard key={group.group_id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
};

export default InstructorGroups;
