/**
 * Work Check Bookings Page
 * Main dashboard for managing work check booking records
 * with aggregate view (grouped by date/time/location) and list view
 */

import { useState, useMemo, useCallback } from 'react';
import { Calendar, CheckCircle, Clock, XCircle, Ban, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkCheckBookingAggregates } from '../hooks/useWorkCheckBookingsData';
import { useWorkCheckBookingMutations } from '../hooks/useWorkCheckBookingMutations';
import useWorkCheckBookingBulkSelection from '../hooks/useWorkCheckBookingBulkSelection';
import WorkCheckBookingAggregatesTable from '../components/admin/WorkCheckBookingAggregatesTable';
import WorkCheckBookingFilters from '../components/admin/WorkCheckBookingFilters';
import WorkCheckBookingSelectionToolbar from '../components/admin/WorkCheckBookingSelectionToolbar';
import WorkCheckBookingFormModal from '../components/admin/WorkCheckBookingFormModal';
import DeleteWorkCheckBookingsModal from '../components/admin/DeleteWorkCheckBookingsModal';
import CloneWorkCheckBookingsModal from '../components/admin/CloneWorkCheckBookingsModal';

/**
 * Statistics card component
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

function WorkCheckBookings() {
  // Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null); // null = create mode, object = edit mode
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

  // Filter state
  const [instructorFilter, setInstructorFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('slot_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Expanded aggregate rows state
  const [expandedKeys, setExpandedKeys] = useState(new Set());

  // Build query params
  const queryParams = useMemo(() => ({
    page: currentPage,
    limit: 20,
    instructor_id: instructorFilter || undefined,
    location: locationFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    sort_by: sortBy,
    sort_order: sortOrder
  }), [currentPage, instructorFilter, locationFilter, dateFrom, dateTo, statusFilter, typeFilter, sortBy, sortOrder]);

  // Fetch aggregates
  const {
    data: aggregatesData,
    isLoading: aggregatesLoading,
    error: aggregatesError
  } = useWorkCheckBookingAggregates(queryParams);

  // Mutations
  const { createBooking, updateBooking } = useWorkCheckBookingMutations();

  // Initialize bulk selection hook with aggregates
  const aggregates = aggregatesData?.data || [];
  const bulkSelection = useWorkCheckBookingBulkSelection(
    aggregates,
    aggregatesData?.pagination?.preloaded_bookings || 0
  );

  // Calculate statistics from aggregates
  const stats = useMemo(() => {
    const data = aggregates;
    let total = 0;
    let pending = 0;
    let confirmed = 0;
    let rejected = 0;
    let cancelled = 0;

    data.forEach(agg => {
      total += agg.total_bookings || 0;
      pending += agg.pending_count || 0;
      confirmed += agg.confirmed_count || 0;
      rejected += agg.rejected_count || 0;
      cancelled += agg.cancelled_count || 0;
    });

    // Use pagination totals if available
    if (aggregatesData?.pagination?.preloaded_bookings) {
      total = aggregatesData.pagination.preloaded_bookings;
    }

    return { total, pending, confirmed, rejected, cancelled };
  }, [aggregates, aggregatesData?.pagination]);

  // Toggle expand handler
  const handleToggleExpand = useCallback((aggregateKey) => {
    setExpandedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(aggregateKey)) {
        newSet.delete(aggregateKey);
      } else {
        newSet.add(aggregateKey);
      }
      return newSet;
    });
  }, []);

  // Handlers
  const handleFilterChange = useCallback((filterName, value) => {
    switch (filterName) {
      case 'instructor':
        setInstructorFilter(value);
        break;
      case 'location':
        setLocationFilter(value);
        break;
      case 'dateFrom':
        setDateFrom(value);
        break;
      case 'dateTo':
        setDateTo(value);
        break;
      case 'status':
        setStatusFilter(value);
        break;
      case 'type':
        setTypeFilter(value);
        break;
    }
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setInstructorFilter('');
    setLocationFilter('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
    setTypeFilter('all');
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  // Create/Edit handlers
  const handleOpenCreateModal = useCallback(() => {
    setEditingBooking(null);
    setShowFormModal(true);
  }, []);

  const handleOpenEditModal = useCallback((booking) => {
    setEditingBooking(booking);
    setShowFormModal(true);
  }, []);

  const handleCloseFormModal = useCallback(() => {
    setShowFormModal(false);
    setEditingBooking(null);
  }, []);

  const handleFormSubmit = useCallback(async (bookingId, data) => {
    try {
      if (bookingId) {
        // Edit mode
        await updateBooking.mutateAsync({ id: bookingId, data });
      } else {
        // Create mode
        await createBooking.mutateAsync(data);
      }
      handleCloseFormModal();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }, [createBooking, updateBooking, handleCloseFormModal]);

  // Bulk status change handler
  const handleChangeStatus = useCallback(async (targetStatus) => {
    if (bulkSelection.selectedCount === 0) return;

    try {
      const result = await bulkSelection.executeBulkToggle(bulkSelection.selectedIds, targetStatus);
      if (result.success) {
        toast.success(`Successfully updated ${result.data?.data?.updated || 0} booking(s) to ${targetStatus}`);
      }
    } catch (error) {
      toast.error('Failed to update booking status');
    }
  }, [bulkSelection]);

  // Delete handlers
  const handleOpenDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(true);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
  }, []);

  const handleConfirmDelete = useCallback(async (ids) => {
    try {
      const result = await bulkSelection.executeBulkDelete(ids);
      if (result.success) {
        setIsDeleteModalOpen(false);
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  }, [bulkSelection]);

  // Clone handlers
  const handleOpenCloneModal = useCallback(() => {
    setIsCloneModalOpen(true);
  }, []);

  const handleCloseCloneModal = useCallback(() => {
    setIsCloneModalOpen(false);
  }, []);

  const handleConfirmClone = useCallback(async (data) => {
    try {
      const result = await bulkSelection.executeClone(data);
      if (result.success) {
        setIsCloneModalOpen(false);
      }
    } catch (error) {
      console.error('Clone error:', error);
    }
  }, [bulkSelection]);

  // Selection handlers
  const handleSelectAllInAggregate = useCallback((bookingIds, select) => {
    bulkSelection.selectAllInAggregate(bookingIds, select);
  }, [bulkSelection]);

  // Pagination info
  const pagination = aggregatesData?.pagination || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
              Work Check Bookings
            </h1>
            <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
              Manage student bookings for work check sessions
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Booking
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-5 mb-6">
          <StatCard
            name="Total Bookings"
            value={stats.total ?? '--'}
            icon={Calendar}
            bgColor="bg-primary-50"
            textColor="text-primary-600"
            isLoading={aggregatesLoading}
          />
          <StatCard
            name="Pending"
            value={stats.pending ?? '--'}
            icon={Clock}
            bgColor="bg-yellow-50"
            textColor="text-yellow-600"
            isLoading={aggregatesLoading}
          />
          <StatCard
            name="Confirmed"
            value={stats.confirmed ?? '--'}
            icon={CheckCircle}
            bgColor="bg-green-50"
            textColor="text-green-600"
            isLoading={aggregatesLoading}
          />
          <StatCard
            name="Rejected"
            value={stats.rejected ?? '--'}
            icon={XCircle}
            bgColor="bg-red-50"
            textColor="text-red-600"
            isLoading={aggregatesLoading}
          />
          <StatCard
            name="Cancelled"
            value={stats.cancelled ?? '--'}
            icon={Ban}
            bgColor="bg-gray-50"
            textColor="text-gray-600"
            isLoading={aggregatesLoading}
          />
        </div>

        {/* Filters or Selection Toolbar */}
        {!bulkSelection.isSelectionMode ? (
          <WorkCheckBookingFilters
            instructorFilter={instructorFilter}
            locationFilter={locationFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />
        ) : (
          <WorkCheckBookingSelectionToolbar
            selectedCount={bulkSelection.selectedCount}
            totalCount={stats.total}
            onClearAll={bulkSelection.clearAll}
            onExitMode={bulkSelection.exitToView}
            onChangeStatus={handleChangeStatus}
            onClone={handleOpenCloneModal}
            onDelete={handleOpenDeleteModal}
            isSubmitting={bulkSelection.isSubmitting}
          />
        )}

        {/* Error state */}
        {aggregatesError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-300">
              Error loading bookings: {aggregatesError.message}
            </p>
          </div>
        )}

        {/* Aggregates Table */}
        <WorkCheckBookingAggregatesTable
          aggregates={aggregates}
          expandedKeys={expandedKeys}
          onToggleExpand={handleToggleExpand}
          selectedIds={bulkSelection.selectedIds}
          onToggleSelection={bulkSelection.toggleSelection}
          onSelectAllInAggregate={handleSelectAllInAggregate}
          onEditBooking={handleOpenEditModal}
          isLoading={aggregatesLoading}
        />

        {/* Pagination */}
        {!aggregatesLoading && pagination.total_pages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing page {pagination.current_page} of {pagination.total_pages}
              ({pagination.total_aggregates} aggregates, {pagination.preloaded_bookings} bookings)
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {currentPage} / {pagination.total_pages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= pagination.total_pages}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        <WorkCheckBookingFormModal
          isOpen={showFormModal}
          onClose={handleCloseFormModal}
          booking={editingBooking}
          onSubmit={handleFormSubmit}
          isSubmitting={createBooking.isPending || updateBooking.isPending}
        />

        {/* Delete Modal */}
        <DeleteWorkCheckBookingsModal
          isOpen={isDeleteModalOpen}
          onClose={handleCloseDeleteModal}
          selectedBookings={bulkSelection.selectedBookings}
          onConfirm={handleConfirmDelete}
          isDeleting={bulkSelection.isSubmitting}
        />

        {/* Clone Modal */}
        <CloneWorkCheckBookingsModal
          isOpen={isCloneModalOpen}
          onClose={handleCloseCloneModal}
          selectedBookings={bulkSelection.selectedBookings}
          onConfirm={handleConfirmClone}
          isCloning={bulkSelection.isSubmitting}
        />
      </div>
    </div>
  );
}

export default WorkCheckBookings;
