/**
 * GroupDetail Page
 * Displays detailed view of a single group with instructors and students
 * Supports inline editing of group details
 */

import { useState, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, PencilIcon, TrashIcon, UserPlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Users, GraduationCap, Calendar, Clock, MapPin } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import toast from 'react-hot-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { groupsApi, instructorsApi, traineeApi } from '../services/adminApi';

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

// Location options
const LOCATION_OPTIONS = [
  'Mississauga',
  'Vancouver',
  'Calgary',
  'Montreal',
  'Richmond Hill',
  'Online'
];

function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Fetch group details with students
  const {
    data: groupData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['group-detail', groupId],
    queryFn: () => groupsApi.getById(groupId),
    enabled: !!groupId
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data) => groupsApi.update(groupId, data),
    onSuccess: () => {
      toast.success('Group updated successfully');
      queryClient.invalidateQueries({ queryKey: ['group-detail', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update group');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => groupsApi.delete(groupId),
    onSuccess: () => {
      toast.success('Group deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      navigate('/work-check/groups');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete group');
    }
  });

  // Remove student mutation
  const removeStudentMutation = useMutation({
    mutationFn: (studentId) => groupsApi.removeStudent(groupId, studentId),
    onSuccess: () => {
      toast.success('Student removed from group');
      queryClient.invalidateQueries({ queryKey: ['group-detail', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove student');
    }
  });

  // Add instructor state
  const [showAddInstructorModal, setShowAddInstructorModal] = useState(false);
  const [instructorSearch, setInstructorSearch] = useState('');
  const [submittedInstructorSearch, setSubmittedInstructorSearch] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState(null);

  // Add student state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [submittedStudentSearch, setSubmittedStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Fetch available instructors for dropdown (only when search is submitted)
  const { data: instructorsData, isLoading: instructorsLoading } = useQuery({
    queryKey: ['instructors-list', submittedInstructorSearch],
    queryFn: () => instructorsApi.list({ search: submittedInstructorSearch, limit: 20 }),
    enabled: showAddInstructorModal && submittedInstructorSearch.length > 0,
    staleTime: 30000
  });

  // Add instructor mutation
  const addInstructorMutation = useMutation({
    mutationFn: (instructorId) => groupsApi.assignInstructor({ groupId: group?.group_id, instructorId }),
    onSuccess: () => {
      toast.success('Instructor added to group');
      queryClient.invalidateQueries({ queryKey: ['group-detail', groupId] });
      setShowAddInstructorModal(false);
      setSelectedInstructor(null);
      setInstructorSearch('');
      setSubmittedInstructorSearch('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add instructor');
    }
  });

  // Remove instructor mutation
  const removeInstructorMutation = useMutation({
    mutationFn: (instructorId) => groupsApi.removeInstructor(group?.group_id, instructorId),
    onSuccess: () => {
      toast.success('Instructor removed from group');
      queryClient.invalidateQueries({ queryKey: ['group-detail', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove instructor');
    }
  });

  // Fetch available students for dropdown (only when search is submitted)
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-search', submittedStudentSearch],
    queryFn: () => traineeApi.search(submittedStudentSearch),
    enabled: showAddStudentModal && submittedStudentSearch.length >= 2,
    staleTime: 30000
  });

  // Add student mutation
  const addStudentMutation = useMutation({
    mutationFn: (contactId) => groupsApi.assignStudent({ groupId: group?.group_id, contactId }),
    onSuccess: () => {
      toast.success('Student added to group');
      queryClient.invalidateQueries({ queryKey: ['group-detail', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setShowAddStudentModal(false);
      setSelectedStudent(null);
      setStudentSearch('');
      setSubmittedStudentSearch('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add student');
    }
  });

  const group = groupData?.data;
  const students = group?.students || [];
  const instructors = group?.instructors || [];
  const availableInstructors = instructorsData?.data || [];
  const availableStudents = studentsData?.data?.contacts || [];

  // Initialize edit form when entering edit mode
  const handleStartEdit = () => {
    setEditForm({
      groupName: group?.group_name || '',
      location: group?.location || 'Mississauga',
      timePeriod: group?.time_period || 'AM',
      startDate: group?.start_date || '',
      endDate: group?.end_date || '',
      maxCapacity: group?.max_capacity || 20,
      status: group?.status || 'active',
      cycle: group?.cycle || ''
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveEdit = () => {
    updateMutation.mutate(editForm);
  };

  const handleFieldChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBack = () => {
    navigate('/work-check/groups');
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-8"></div>
            <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  {error.message || 'Failed to load group details'}
                </p>
                <button
                  onClick={handleBack}
                  className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-500 underline"
                >
                  Back to Groups
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Groups
          </button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
                {isEditing ? 'Editing Group' : group?.group_name}
              </h1>
              <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
                {isEditing ? 'Make changes and save when ready' : `Group ID: ${group?.group_id}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    disabled={updateMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleStartEdit}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Group Information Card */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Group Information
            </h2>
          </div>
          <div className="p-6">
            {isEditing ? (
              /* Edit Form */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={editForm.groupName}
                    onChange={(e) => handleFieldChange('groupName', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <select
                    value={editForm.location}
                    onChange={(e) => handleFieldChange('location', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 sm:text-sm"
                  >
                    {LOCATION_OPTIONS.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time Period
                  </label>
                  <select
                    value={editForm.timePeriod}
                    onChange={(e) => handleFieldChange('timePeriod', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 sm:text-sm"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 sm:text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <DatePicker
                    value={editForm.startDate}
                    onChange={(value) => handleFieldChange('startDate', value)}
                    placeholder="Select start date"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <DatePicker
                    value={editForm.endDate || ''}
                    onChange={(value) => handleFieldChange('endDate', value)}
                    placeholder="Select end date"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.maxCapacity}
                    onChange={(e) => handleFieldChange('maxCapacity', parseInt(e.target.value) || 1)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cycle
                  </label>
                  <input
                    type="text"
                    value={editForm.cycle}
                    onChange={(e) => handleFieldChange('cycle', e.target.value)}
                    placeholder="Enter cycle (optional)"
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 sm:text-sm"
                  />
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoCard label="Group Name" value={group?.group_name} />
                <InfoCard label="Group ID" value={group?.group_id} />
                <InfoCard label="Location" value={group?.location} icon={MapPin} />
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
                <InfoCard label="Cycle" value={group?.cycle || '-'} />
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
            )}
          </div>
        </div>

        {/* Instructors Section */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Instructors ({instructors.length})
              </h2>
              <button
                onClick={() => setShowAddInstructorModal(true)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <UserPlusIcon className="h-4 w-4 mr-1" />
                Add Instructor
              </button>
            </div>
          </div>

          {instructors.length === 0 ? (
            <div className="p-6">
              <div className="text-center py-8">
                <GraduationCap className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No instructors assigned</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Add instructors to this group using the button above.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Instructor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Assigned
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                  {instructors.map((assignment) => (
                    <tr key={assignment.assignment_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                              {assignment.instructor?.instructor_name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {assignment.instructor?.instructor_name || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {assignment.instructor?.email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(assignment.assigned_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove ${assignment.instructor?.instructor_name || 'this instructor'} from this group?`)) {
                              removeInstructorMutation.mutate(assignment.instructor_id);
                            }
                          }}
                          disabled={removeInstructorMutation.isPending}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Students Section */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Students ({students.length})
              </h2>
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <UserPlusIcon className="h-4 w-4 mr-1" />
                Add Student
              </button>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="p-6">
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No students assigned</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Students can be assigned to this group from the main groups page.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Student
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Enrolled
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                  {students.map((assignment) => (
                    <tr key={assignment.assignment_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {assignment.student?.firstname} {assignment.student?.lastname}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {assignment.student_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {assignment.student?.email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {assignment.enrolled_at ? formatDate(assignment.enrolled_at) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => removeStudentMutation.mutate(assignment.student_id)}
                          disabled={removeStudentMutation.isPending}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                          title="Remove student from group"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} />
              <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-dark-card px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 sm:mx-0 sm:h-10 sm:w-10">
                    <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                    <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                      Delete Group
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete <span className="font-medium text-gray-900 dark:text-gray-100">{group?.group_name}</span>?
                        This will also remove all student assignments. This action cannot be undone.
                      </p>
                    </div>
                    <div className="mt-4">
                      <label htmlFor="deleteConfirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Type <span className="font-semibold text-red-600 dark:text-red-400">{group?.group_name}</span> to confirm
                      </label>
                      <input
                        type="text"
                        id="deleteConfirm"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        disabled={deleteMutation.isPending}
                        placeholder="Enter group name"
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={deleteMutation.isPending || deleteConfirmText !== group?.group_name}
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                    disabled={deleteMutation.isPending}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 sm:mt-0 sm:w-auto disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Instructor Modal */}
        <Transition.Root show={showAddInstructorModal} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => {
              setShowAddInstructorModal(false);
              setSelectedInstructor(null);
              setInstructorSearch('');
              setSubmittedInstructorSearch('');
            }}
          >
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
                  <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                    <div>
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                        <GraduationCap className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="mt-3 text-center sm:mt-5">
                        <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                          Add Instructor to Group
                        </Dialog.Title>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Search and select an instructor to add to this group.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Search Form with Button */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (instructorSearch.trim().length >= 1) {
                          setSubmittedInstructorSearch(instructorSearch.trim());
                          setSelectedInstructor(null);
                        }
                      }}
                      className="mt-5"
                    >
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="text"
                            value={instructorSearch}
                            onChange={(e) => setInstructorSearch(e.target.value)}
                            placeholder="Search by name or email..."
                            className="pl-9"
                          />
                        </div>
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          disabled={instructorSearch.trim().length < 1}
                        >
                          Search
                        </Button>
                      </div>
                    </form>

                    {/* Search Results */}
                    {submittedInstructorSearch && (
                      <div className="mt-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          {instructorsLoading ? (
                            'Searching...'
                          ) : availableInstructors.length === 0 ? (
                            'No instructors found.'
                          ) : (
                            `Found ${availableInstructors.length} instructor(s)`
                          )}
                        </div>
                        {!instructorsLoading && availableInstructors.length > 0 && (
                          <div className="max-h-60 overflow-auto rounded-md border border-gray-200 dark:border-gray-600">
                            {availableInstructors.map((instructor) => {
                              const isAssigned = instructors.some(i => (i.id || i.instructor_id) === instructor.id);
                              const isSelected = selectedInstructor?.id === instructor.id;
                              return (
                                <div
                                  key={instructor.id}
                                  onClick={() => !isAssigned && setSelectedInstructor(instructor)}
                                  className={`p-3 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0 ${
                                    isAssigned
                                      ? 'bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed opacity-60'
                                      : isSelected
                                        ? 'bg-primary-50 dark:bg-primary-900/30 border-l-4 border-l-primary-500'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {instructor.instructor_name}
                                        {isAssigned && (
                                          <span className="ml-2 text-xs text-gray-500">(Already assigned)</span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {instructor.email}
                                      </div>
                                    </div>
                                    {isSelected && !isAssigned && (
                                      <CheckIcon className="h-5 w-5 text-primary-600" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                      <button
                        type="button"
                        disabled={!selectedInstructor || addInstructorMutation.isPending}
                        onClick={() => {
                          if (selectedInstructor) {
                            addInstructorMutation.mutate(selectedInstructor.id);
                          }
                        }}
                        className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:col-start-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {addInstructorMutation.isPending ? 'Adding...' : 'Add Instructor'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddInstructorModal(false);
                          setSelectedInstructor(null);
                          setInstructorSearch('');
                          setSubmittedInstructorSearch('');
                        }}
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:col-start-1 sm:mt-0"
                      >
                        Cancel
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Add Student Modal */}
        <Transition.Root show={showAddStudentModal} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => {
              setShowAddStudentModal(false);
              setSelectedStudent(null);
              setStudentSearch('');
              setSubmittedStudentSearch('');
            }}
          >
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
                  <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                    <div>
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
                        <Users className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="mt-3 text-center sm:mt-5">
                        <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                          Add Student to Group
                        </Dialog.Title>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Search for a student by name, email, or student ID.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Search Form with Button */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (studentSearch.trim().length >= 2) {
                          setSubmittedStudentSearch(studentSearch.trim());
                          setSelectedStudent(null);
                        }
                      }}
                      className="mt-5"
                    >
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="text"
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            placeholder="Search by name, email, or student ID..."
                            className="pl-9"
                          />
                        </div>
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          disabled={studentSearch.trim().length < 2}
                        >
                          Search
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Type at least 2 characters to search
                      </p>
                    </form>

                    {/* Search Results */}
                    {submittedStudentSearch && (
                      <div className="mt-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          {studentsLoading ? (
                            'Searching...'
                          ) : availableStudents.length === 0 ? (
                            'No students found.'
                          ) : (
                            `Found ${availableStudents.length} student(s)`
                          )}
                        </div>
                        {!studentsLoading && availableStudents.length > 0 && (
                          <div className="max-h-60 overflow-auto rounded-md border border-gray-200 dark:border-gray-600">
                            {availableStudents.map((student) => {
                              const isAssigned = students.some(s => s.student_id === student.student_id || s.student_id === student.hubspot_id);
                              const isSelected = selectedStudent?.hubspot_id === student.hubspot_id || selectedStudent?.id === student.id;
                              return (
                                <div
                                  key={student.hubspot_id || student.id}
                                  onClick={() => !isAssigned && setSelectedStudent(student)}
                                  className={`p-3 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0 ${
                                    isAssigned
                                      ? 'bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed opacity-60'
                                      : isSelected
                                        ? 'bg-primary-50 dark:bg-primary-900/30 border-l-4 border-l-primary-500'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {student.firstname} {student.lastname}
                                        {isAssigned && (
                                          <span className="ml-2 text-xs text-gray-500">(Already assigned)</span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {student.email} {student.student_id && `• ${student.student_id}`}
                                      </div>
                                    </div>
                                    {isSelected && !isAssigned && (
                                      <CheckIcon className="h-5 w-5 text-primary-600" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                      <button
                        type="button"
                        disabled={!selectedStudent || addStudentMutation.isPending}
                        onClick={() => {
                          if (selectedStudent) {
                            addStudentMutation.mutate(selectedStudent.hubspot_id || selectedStudent.id);
                          }
                        }}
                        className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:col-start-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {addStudentMutation.isPending ? 'Adding...' : 'Add Student'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddStudentModal(false);
                          setSelectedStudent(null);
                          setStudentSearch('');
                          setSubmittedStudentSearch('');
                        }}
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:col-start-1 sm:mt-0"
                      >
                        Cancel
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>
      </div>
    </div>
  );
}

export default GroupDetail;
