/**
 * Groups Page
 * Main dashboard for Workcheck Group Management
 * Allows admins to manage training groups
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserCheck, Calendar, FolderOpen, PlusIcon, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsApi } from '../services/adminApi';
import GroupsTable from '../components/admin/GroupsTable';
import GroupForm from '../components/admin/GroupForm';
import GroupsSelectionToolbar from '../components/admin/GroupsSelectionToolbar';
import CloneGroupsModal from '../components/admin/CloneGroupsModal';
import GroupViewModal from '../components/admin/GroupViewModal';
import GroupToggleStatusModal from '../components/admin/GroupToggleStatusModal';
import DeleteGroupsModal from '../components/admin/DeleteGroupsModal';
import useGroupsBulkSelection from '../hooks/useGroupsBulkSelection';

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

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [viewGroupId, setViewGroupId] = useState(null);

  // Filter and pagination state (sent to API)
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    filter_status: 'all',
    search: ''
  });

  // Local sort state (frontend sorting only)
  const [sortConfig, setSortConfig] = useState({
    sort_by: 'start_date',
    sort_order: 'desc'
  });

  // Fetch groups (without sort params - sorting is done client-side)
  const {
    data: groupsData,
    isLoading: groupsLoading,
    error: groupsError
  } = useQuery({
    queryKey: ['groups', filters],
    queryFn: () => groupsApi.list(filters)
  });

  // Bulk selection hook
  const {
    isSelectionMode,
    selectedCount,
    totalCount,
    selectedGroups,
    selectedIds,
    isSubmitting,
    toggleSelection,
    selectAll,
    clearAll,
    exitToView,
    setSubmittingState,
    invalidateQueries,
    executeBulkToggle,
    isSelected
  } = useGroupsBulkSelection(
    groupsData?.data || [],
    groupsData?.pagination?.total_records || null
  );

  // Sort data on the frontend
  const sortedGroups = useMemo(() => {
    const data = groupsData?.data || [];
    if (!data.length) return data;

    return [...data].sort((a, b) => {
      const { sort_by, sort_order } = sortConfig;
      let aVal = a[sort_by];
      let bVal = b[sort_by];

      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Handle date sorting
      if (sort_by === 'start_date' || sort_by === 'end_date' || sort_by === 'created_at') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }

      // Handle string comparison (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sort_order === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort_order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [groupsData?.data, sortConfig]);

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

  // Handlers
  const handleSort = (column) => {
    // Frontend sorting - no need to reset page or refetch
    setSortConfig(prev => ({
      sort_by: column,
      sort_order: prev.sort_by === column && prev.sort_order === 'asc' ? 'desc' : 'asc'
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

  const handleCreateSubmit = (data) => {
    createMutation.mutate(data);
  };

  // Clone handlers
  const handleOpenCloneModal = () => {
    setShowCloneModal(true);
  };

  const handleCloseCloneModal = () => {
    setShowCloneModal(false);
  };

  const handleCloneSuccess = async () => {
    await invalidateQueries();
    exitToView();
    setShowCloneModal(false);
    toast.success(`Successfully cloned ${selectedCount} group(s)`);
  };

  // View modal handlers
  const handleViewGroup = (groupId) => {
    setViewGroupId(groupId);
    setShowViewModal(true);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewGroupId(null);
  };

  // Toggle status handlers
  const handleOpenToggleModal = () => {
    setShowToggleModal(true);
  };

  const handleCloseToggleModal = () => {
    setShowToggleModal(false);
  };

  const handleConfirmToggle = async () => {
    try {
      const result = await executeBulkToggle(selectedIds);
      if (result.success) {
        toast.success(`Successfully toggled status for ${result.summary.updated} group(s)`);
        exitToView();
        setShowToggleModal(false);
      }
    } catch (error) {
      toast.error('Failed to toggle group status');
    }
  };

  // Delete modal handlers
  const handleOpenDeleteModal = () => {
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
  };

  const handleDeleteSuccess = () => {
    exitToView();
    setShowDeleteModal(false);
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

        {/* Selection Toolbar or Filters */}
        {isSelectionMode ? (
          <div className="mb-6 rounded-lg overflow-hidden shadow dark:shadow-gray-900/50">
            <GroupsSelectionToolbar
              selectedCount={selectedCount}
              totalCount={totalCount}
              onClearAll={clearAll}
              onExitMode={exitToView}
              onClone={handleOpenCloneModal}
              onToggleStatus={handleOpenToggleModal}
              onDelete={handleOpenDeleteModal}
              selectedGroups={selectedGroups}
              isSubmitting={isSubmitting}
            />
          </div>
        ) : (
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
        )}

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
          data={sortedGroups}
          isLoading={groupsLoading}
          onSort={handleSort}
          currentSort={sortConfig}
          currentPage={filters.page}
          totalPages={groupsData?.pagination?.total_pages || 1}
          totalItems={groupsData?.pagination?.total_records || 0}
          onPageChange={handlePageChange}
          // Selection props
          isSelectionMode={isSelectionMode}
          isSelected={isSelected}
          onToggleSelection={toggleSelection}
          onSelectAll={selectAll}
          selectedCount={selectedCount}
          // View modal handler
          onViewGroup={handleViewGroup}
        />

        {/* Create Modal */}
        <GroupForm
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSubmit}
          isLoading={createMutation.isPending}
          mode="create"
        />

        {/* Clone Modal */}
        <CloneGroupsModal
          isOpen={showCloneModal}
          onClose={handleCloseCloneModal}
          selectedGroups={selectedGroups}
          onSuccess={handleCloneSuccess}
          setSubmittingState={setSubmittingState}
        />

        {/* View Modal */}
        <GroupViewModal
          isOpen={showViewModal}
          onClose={handleCloseViewModal}
          groupId={viewGroupId}
        />

        {/* Toggle Status Modal */}
        <GroupToggleStatusModal
          isOpen={showToggleModal}
          onClose={handleCloseToggleModal}
          onConfirm={handleConfirmToggle}
          selectedGroups={selectedGroups}
          isSubmitting={isSubmitting}
        />

        {/* Delete Groups Modal */}
        <DeleteGroupsModal
          isOpen={showDeleteModal}
          onClose={handleCloseDeleteModal}
          selectedGroups={selectedGroups}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </div>
  );
}

export default Groups;
