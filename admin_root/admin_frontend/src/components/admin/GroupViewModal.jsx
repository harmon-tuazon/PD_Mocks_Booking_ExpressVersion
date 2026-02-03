/**
 * GroupViewModal Component
 * Displays group details in a modal with tabbed interface
 * Tabs: Overview, Instructors, Students
 */

import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { Users, GraduationCap, Calendar, MapPin, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '../../services/adminApi';

/**
 * Info card for displaying a labeled value
 */
const InfoCard = ({ label, value, icon: Icon }) => (
  <div className="flex items-start space-x-3">
    {Icon && (
      <div className="flex-shrink-0 mt-1">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
    )}
    <div>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{value || '-'}</dd>
    </div>
  </div>
);

/**
 * Status badge component
 */
const StatusBadge = ({ status }) => {
  const statusStyles = {
    active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    inactive: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    completed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || statusStyles.inactive}`}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

/**
 * Time period badge
 */
const TimePeriodBadge = ({ period }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
    period === 'AM'
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
      : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300'
  }`}>
    {period}
  </span>
);

const GroupViewModal = ({ isOpen, onClose, groupId }) => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(0);

  // Fetch group details
  const { data: groupData, isLoading, error } = useQuery({
    queryKey: ['group-detail', groupId],
    queryFn: () => groupsApi.getById(groupId),
    enabled: isOpen && !!groupId
  });

  const group = groupData?.data;
  const students = group?.students || [];
  const instructors = group?.instructors || [];

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleGoToDetail = () => {
    onClose();
    navigate(`/data-management/groups/${groupId}`);
  };

  const tabs = [
    { name: 'Overview', icon: Clock },
    { name: 'Instructors', icon: GraduationCap, count: instructors.length },
    { name: 'Students', icon: Users, count: students.length }
  ];

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" />
        </Transition.Child>

        {/* Modal */}
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {isLoading ? 'Loading...' : group?.group_name || 'Group Details'}
                      </Dialog.Title>
                      {group && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          ID: {group.group_id}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleGoToDetail}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                        title="Go to full detail page"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-1" />
                        Full Details
                      </button>
                      <button
                        onClick={onClose}
                        className="rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <span className="sr-only">Close</span>
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                  {isLoading ? (
                    <div className="animate-pulse space-y-4">
                      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="text-center py-8">
                      <p className="text-red-500 dark:text-red-400">
                        {error.message || 'Failed to load group details'}
                      </p>
                    </div>
                  ) : (
                    <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
                      {/* Tab List */}
                      <Tab.List className="flex space-x-1 rounded-lg bg-gray-100 dark:bg-gray-700/50 p-1 mb-4">
                        {tabs.map((tab) => (
                          <Tab
                            key={tab.name}
                            className={({ selected }) =>
                              `w-full rounded-md py-2.5 text-sm font-medium leading-5 transition-colors
                              ${selected
                                ? 'bg-white dark:bg-gray-800 text-primary-700 dark:text-primary-400 shadow'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-white/[0.12] hover:text-gray-800 dark:hover:text-gray-200'
                              }`
                            }
                          >
                            <div className="flex items-center justify-center gap-2">
                              <tab.icon className="h-4 w-4" />
                              {tab.name}
                              {tab.count !== undefined && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  selectedTab === tabs.indexOf(tab)
                                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                                }`}>
                                  {tab.count}
                                </span>
                              )}
                            </div>
                          </Tab>
                        ))}
                      </Tab.List>

                      {/* Tab Panels */}
                      <Tab.Panels>
                        {/* Overview Tab */}
                        <Tab.Panel>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left column - fields without icons */}
                            <div className="space-y-6">
                              <InfoCard label="Group Name" value={group?.group_name} />
                              <div className="flex items-start space-x-3">
                                <div>
                                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Time Period</dt>
                                  <dd className="mt-1">
                                    <TimePeriodBadge period={group?.time_period} />
                                  </dd>
                                </div>
                              </div>
                              <div className="flex items-start space-x-3">
                                <div>
                                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                                  <dd className="mt-1">
                                    <StatusBadge status={group?.status} />
                                  </dd>
                                </div>
                              </div>
                            </div>

                            {/* Right column - fields with icons */}
                            <div className="space-y-6">
                              <InfoCard label="Location" value={group?.location} icon={MapPin} />
                              <InfoCard
                                label="Start Date"
                                value={formatDate(group?.start_date)}
                                icon={Calendar}
                              />
                              <InfoCard
                                label="End Date"
                                value={formatDate(group?.end_date)}
                                icon={Calendar}
                              />
                              <InfoCard
                                label="Capacity"
                                value={`${group?.student_count || 0} / ${group?.max_capacity}`}
                                icon={Users}
                              />
                            </div>
                          </div>
                        </Tab.Panel>

                        {/* Instructors Tab */}
                        <Tab.Panel>
                          {instructors.length === 0 ? (
                            <div className="text-center py-8">
                              <GraduationCap className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No instructors assigned</h3>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Go to the full detail page to add instructors.
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto max-h-80">
                              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                  <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Instructor
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      ID
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Email
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                  {instructors.map((assignment) => (
                                    <tr key={assignment.assignment_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <div className="flex-shrink-0 h-8 w-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                                            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                              {assignment.instructor?.first_name?.charAt(0) || '?'}
                                              {assignment.instructor?.last_name?.charAt(0) || ''}
                                            </span>
                                          </div>
                                          <div className="ml-3">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                              {assignment.instructor?.first_name || 'Unknown'} {assignment.instructor?.last_name || ''}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                          {assignment.instructor_id}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                          {assignment.instructor?.email || '-'}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </Tab.Panel>

                        {/* Students Tab */}
                        <Tab.Panel>
                          {students.length === 0 ? (
                            <div className="text-center py-8">
                              <Users className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No students assigned</h3>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Go to the full detail page to add students.
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto max-h-80">
                              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                  <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Student
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Student ID
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Email
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Enrolled
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                  {students.map((assignment) => (
                                    <tr key={assignment.assignment_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <div className="flex-shrink-0 h-8 w-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                                            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                                              {assignment.student?.firstname?.charAt(0) || '?'}
                                              {assignment.student?.lastname?.charAt(0) || ''}
                                            </span>
                                          </div>
                                          <div className="ml-3">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                              {assignment.student?.firstname || 'Unknown'} {assignment.student?.lastname || ''}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                          {assignment.student_id}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                          {assignment.student?.email || '-'}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                          {assignment.enrolled_at ? formatDate(assignment.enrolled_at) : '-'}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </Tab.Panel>
                      </Tab.Panels>
                    </Tab.Group>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default GroupViewModal;
