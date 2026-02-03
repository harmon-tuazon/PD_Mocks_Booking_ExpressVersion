/**
 * Groups Page
 * Main dashboard for Workcheck Group Management
 * Allows admins to manage training groups, assign students
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserCheck, Calendar, FolderOpen, PlusIcon, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { groupsApi } from '../services/adminApi';
import GroupsTable from '../components/admin/GroupsTable';
import GroupForm from '../components/admin/GroupForm';

/**
 * Statistics card component for displaying group metrics
 */
const StatCard = ({ name, value, icon: Icon, bgColor, textColor, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg animate-pulse">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-md p-3 w-12 h-12"></div>
            <div className="ml-5 w-0 flex-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${bgColor} dark:bg-opacity-20 rounded-md p-3`}>
            <Icon className={`h-6 w-6 ${textColor}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {name}
              </dt>
              <dd>
                <div className={`text-2xl font-semibold ${textColor} dark:text-gray-100`}>
                  {value}
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

function Groups() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter and pagination state
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    sort_by: 'start_date',
    sort_order: 'desc',
    filter_status: 'all',
    search: ''
  });

  // Fetch groups
  const {
    data: groupsData,
    isLoading: groupsLoading,
    error: groupsError
  } = useQuery({
    queryKey: ['groups', filters],
    queryFn: () => groupsApi.list(filters)
  });

  // Fetch statistics
  const {
    data: statsData,
    isLoading: statsLoading
  } = useQuery({
    queryKey: ['groups-statistics'],
    queryFn: () => groupsApi.getStatistics()
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => groupsApi.create(data),
    onSuccess: () => {
      toast.success('Group created successfully');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-statistics'] });
      setShowCreateModal(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create group');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => groupsApi.update(id, data),
    onSuccess: () => {
      toast.success('Group updated successfully');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-statistics'] });
      setShowEditModal(false);
      setSelectedGroup(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update group');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => groupsApi.delete(id),
    onSuccess: () => {
      toast.success('Group deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-statistics'] });
      setShowDeleteConfirm(false);
      setSelectedGroup(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete group');
    }
  });

  // Clone mutation
  const cloneMutation = useMutation({
    mutationFn: ({ id, data }) => groupsApi.clone(id, data),
    onSuccess: (result) => {
      toast.success(result.message || 'Group cloned successfully');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-statistics'] });
      setShowCloneModal(false);
      setSelectedGroup(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to clone group');
    }
  });

  // Handlers
  const handleSort = (column) => {
    setFilters(prev => ({
      ...prev,
      sort_by: column,
      sort_order: prev.sort_by === column && prev.sort_order === 'asc' ? 'desc' : 'asc',
      page: 1
    }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleStatusFilterChange = (status) => {
    setFilters(prev => ({ ...prev, filter_status: status, page: 1 }));
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setFilters(prev => ({ ...prev, search: value, page: 1 }));
  };

  const handleView = (group) => {
    setSelectedGroup(group);
    setShowEditModal(true);
  };

  const handleEdit = (group) => {
    setSelectedGroup(group);
    setShowEditModal(true);
  };

  const handleDelete = (group) => {
    setSelectedGroup(group);
    setShowDeleteConfirm(true);
  };

  const handleClone = (group) => {
    setSelectedGroup(group);
    setShowCloneModal(true);
  };

  const handleCreateSubmit = (data) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data) => {
    if (selectedGroup) {
      updateMutation.mutate({ id: selectedGroup.group_id, data });
    }
  };

  const handleCloneSubmit = (data) => {
    if (selectedGroup) {
      cloneMutation.mutate({ id: selectedGroup.group_id, data });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedGroup) {
      deleteMutation.mutate(selectedGroup.group_id);
    }
  };

  // Statistics
  const stats = statsData?.data || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
              Workcheck Group Management
            </h1>
            <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
              Manage training groups and assign students
            </p>
          </div>
          <div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Create New Group
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            name="Total Groups"
            value={stats.total ?? '--'}
            icon={FolderOpen}
            bgColor="bg-primary-50"
            textColor="text-primary-600"
            isLoading={statsLoading}
          />
          <StatCard
            name="Active Groups"
            value={stats.active ?? '--'}
            icon={Calendar}
            bgColor="bg-teal-50"
            textColor="text-teal-600"
            isLoading={statsLoading}
          />
          <StatCard
            name="Total Students"
            value={stats.totalStudents ?? '--'}
            icon={Users}
            bgColor="bg-blue-50"
            textColor="text-blue-600"
            isLoading={statsLoading}
          />
          <StatCard
            name="Avg Group Size"
            value={stats.averageSize ?? '--'}
            icon={UserCheck}
            bgColor="bg-coral-50"
            textColor="text-coral-600"
            isLoading={statsLoading}
          />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-gray-900/50 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search groups..."
                value={filters.search}
                onChange={handleSearch}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
              <select
                value={filters.filter_status}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="block w-auto pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error state */}
        {groupsError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-300">
              Error loading groups: {groupsError.message}
            </p>
          </div>
        )}

        {/* Groups Table */}
        <GroupsTable
          data={groupsData?.data || []}
          isLoading={groupsLoading}
          onSort={handleSort}
          currentSort={{ sort_by: filters.sort_by, sort_order: filters.sort_order }}
          currentPage={filters.page}
          totalPages={groupsData?.pagination?.total_pages || 1}
          totalItems={groupsData?.pagination?.total_records || 0}
          onPageChange={handlePageChange}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClone={handleClone}
        />

        {/* Create Modal */}
        <GroupForm
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSubmit}
          isLoading={createMutation.isPending}
          mode="create"
        />

        {/* Edit Modal */}
        <GroupForm
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedGroup(null);
          }}
          onSubmit={handleEditSubmit}
          isLoading={updateMutation.isPending}
          initialData={selectedGroup}
          mode="edit"
        />

        {/* Clone Modal */}
        <GroupForm
          isOpen={showCloneModal}
          onClose={() => {
            setShowCloneModal(false);
            setSelectedGroup(null);
          }}
          onSubmit={handleCloneSubmit}
          isLoading={cloneMutation.isPending}
          initialData={selectedGroup}
          mode="clone"
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={() => setShowDeleteConfirm(false)} />
              <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-dark-card px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                      Delete Group
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete <span className="font-medium">{selectedGroup?.group_name}</span>?
                        This will also remove all student assignments. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={deleteMutation.isPending}
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setSelectedGroup(null);
                    }}
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
      </div>
    </div>
  );
}

export default Groups;
