/**
 * Instructors Page
 * Main dashboard for instructor management under Work Check
 * Allows admins to create, edit, and manage instructors
 */

import { useState, useMemo, useCallback } from 'react';
import { GraduationCap, Plus, Users, UserCheck, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInstructorsData, useInstructorMutations } from '../hooks/useInstructorsData';
import { useDebounce } from '../hooks/useDebounce';
import InstructorTable from '../components/admin/InstructorTable';
import InstructorFormModal from '../components/admin/InstructorFormModal';
import InstructorFilters from '../components/admin/InstructorFilters';

/**
 * Statistics card component for displaying instructor metrics
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

function Instructors() {
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState(null);

  // Filter state
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('instructor_name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 300);

  // Build query params
  const queryParams = useMemo(() => ({
    page: currentPage,
    limit: 50,
    search: debouncedSearch || undefined,
    filter_status: statusFilter !== 'all' ? statusFilter : undefined,
    sort_by: sortBy,
    sort_order: sortOrder
  }), [currentPage, debouncedSearch, statusFilter, sortBy, sortOrder]);

  // Fetch instructors
  const {
    data: instructorsData,
    isLoading: instructorsLoading,
    error: instructorsError
  } = useInstructorsData(queryParams);

  // Mutations
  const {
    createInstructor,
    updateInstructor
  } = useInstructorMutations();

  // Calculate statistics from data
  const stats = useMemo(() => {
    const data = instructorsData?.data || [];
    const pagination = instructorsData?.pagination || {};

    // For accurate stats, we'd need a separate API call or include in the response
    // For now, we'll use pagination total and estimate active/inactive from current page
    const total = pagination.total_records || data.length;
    const activeCount = data.filter(i => i.is_active).length;
    const inactiveCount = data.filter(i => !i.is_active).length;

    return {
      total,
      active: activeCount,
      inactive: inactiveCount
    };
  }, [instructorsData]);

  // Handlers
  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  }, [sortBy]);

  const handleSortChange = useCallback((newSortBy, newSortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchInput(value);
    setCurrentPage(1);
  }, []);

  const handleStatusChange = useCallback((value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    setEditingInstructor(null);
    setShowModal(true);
  }, []);

  const handleOpenEditModal = useCallback((instructor) => {
    setEditingInstructor(instructor);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingInstructor(null);
  }, []);

  const handleFormSubmit = useCallback(async (data) => {
    try {
      if (editingInstructor) {
        // Update existing instructor
        await updateInstructor.mutateAsync({
          id: editingInstructor.id || editingInstructor.instructor_id,
          data
        });
      } else {
        // Create new instructor
        await createInstructor.mutateAsync(data);
      }
      handleCloseModal();
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Form submission error:', error);
    }
  }, [editingInstructor, updateInstructor, createInstructor, handleCloseModal]);

  const handleToggleStatus = useCallback(async (instructor) => {
    const newStatus = !instructor.is_active;
    const action = newStatus ? 'activate' : 'deactivate';

    try {
      await updateInstructor.mutateAsync({
        id: instructor.id || instructor.instructor_id,
        data: { is_active: newStatus }
      });
      toast.success(`Instructor ${action}d successfully`);
    } catch (error) {
      toast.error(`Failed to ${action} instructor`);
    }
  }, [updateInstructor]);

  // Pagination info
  const pagination = instructorsData?.pagination || {};
  const instructors = instructorsData?.data || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
              Instructor Management
            </h1>
            <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
              Manage instructors and their assignments
            </p>
          </div>
          <div>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Add Instructor
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-6">
          <StatCard
            name="Total Instructors"
            value={stats.total ?? '--'}
            icon={Users}
            bgColor="bg-primary-50"
            textColor="text-primary-600"
            isLoading={instructorsLoading}
          />
          <StatCard
            name="Active"
            value={stats.active ?? '--'}
            icon={UserCheck}
            bgColor="bg-green-50"
            textColor="text-green-600"
            isLoading={instructorsLoading}
          />
          <StatCard
            name="Inactive"
            value={stats.inactive ?? '--'}
            icon={UserX}
            bgColor="bg-gray-50"
            textColor="text-gray-600"
            isLoading={instructorsLoading}
          />
        </div>

        {/* Filters */}
        <InstructorFilters
          search={searchInput}
          onSearchChange={handleSearchChange}
          status={statusFilter}
          onStatusChange={handleStatusChange}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
        />

        {/* Error state */}
        {instructorsError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-300">
              Error loading instructors: {instructorsError.message}
            </p>
          </div>
        )}

        {/* Instructors Table */}
        <InstructorTable
          data={instructors}
          isLoading={instructorsLoading}
          onSort={handleSort}
          currentSort={{ sort_by: sortBy, sort_order: sortOrder }}
          currentPage={currentPage}
          totalPages={pagination.total_pages || 1}
          totalItems={pagination.total_records || 0}
          onPageChange={handlePageChange}
          onEdit={handleOpenEditModal}
          onToggleStatus={handleToggleStatus}
          isTogglingStatus={updateInstructor.isPending}
        />

        {/* Create/Edit Modal */}
        <InstructorFormModal
          isOpen={showModal}
          onClose={handleCloseModal}
          onSubmit={handleFormSubmit}
          isLoading={createInstructor.isPending || updateInstructor.isPending}
          initialData={editingInstructor}
          mode={editingInstructor ? 'edit' : 'create'}
        />
      </div>
    </div>
  );
}

export default Instructors;
