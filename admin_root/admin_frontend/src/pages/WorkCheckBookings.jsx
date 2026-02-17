/**
 * Work Check Bookings Page
 * Main dashboard for managing work check booking records
 * with aggregate view (grouped by date/time/location) and list view
 */

import { useState, useMemo, useCallback } from 'react';
import { Calendar, CheckCircle, Clock, XCircle, Ban, Plus, ClipboardCheck, BadgeCheck } from 'lucide-react';
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
      <div className="bg-white dark:bg-dark-card overflow-hidden shadow-lg dark:shadow-gray-900/50 rounded-lg animate-pulse">
        <div className="px-3 py-3 text-center">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-md p-2 w-9 h-9 mx-auto mb-1"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mx-auto mb-1"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-8 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-card overflow-hidden shadow-lg dark:shadow-gray-900/50 rounded-lg">
      <div className="px-3 py-3 text-center">
        <div className={`${bgColor} dark:bg-opacity-20 rounded-md p-2 w-fit mx-auto mb-1`}>
          <Icon className={`h-5 w-5 ${textColor}`} />
        </div>
        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {name}
        </dt>
        <dd className={`text-xl font-semibold ${textColor}`}>
          {value}
        </dd>
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
    status: statusFilter !== 'all' ? statusFilter : undefined, // 'all' sends no filter; 'active' sends 'active' to API
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
    let marked = 0;
    let completed = 0;
    let rejected = 0;
    let cancelled = 0;

    data.forEach(agg => {
      total += agg.total_bookings || 0;
      pending += agg.pending_count || 0;
      confirmed += agg.confirmed_count || 0;
      marked += agg.marked_count || 0;
      completed += agg.completed_count || 0;
      rejected += agg.rejected_count || 0;
      cancelled += agg.cancelled_count || 0;
    });

    // Use pagination totals if available
    if (aggregatesData?.pagination?.preloaded_bookings) {
      total = aggregatesData.pagination.preloaded_bookings;
    }

    return { total, pending, confirmed, marked, completed, rejected, cancelled };
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
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Create Booking
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7 mb-6">
          <StatCard
            name="Total"
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
            name="Marked"
            value={stats.marked ?? '--'}
            icon={ClipboardCheck}
            bgColor="bg-amber-50"
            textColor="text-amber-600"
            isLoading={aggregatesLoading}
          />
          <StatCard
            name="Completed"
            value={stats.completed ?? '--'}
            icon={BadgeCheck}
            bgColor="bg-blue-50"
            textColor="text-blue-600"
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
          currentPage={currentPage}
          totalPages={pagination.total_pages || 1}
          totalItems={pagination.preloaded_bookings || 0}
          onPageChange={handlePageChange}
        />

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
