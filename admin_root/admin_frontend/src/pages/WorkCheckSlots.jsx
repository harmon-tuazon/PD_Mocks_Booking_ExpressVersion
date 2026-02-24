/**
 * Work Check Slots Page
 * Main dashboard for managing instructor time slots
 */

import { useState, useMemo, useCallback } from 'react';
import { Plus, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkCheckSlotsData } from '../hooks/useWorkCheckSlotsData';
import { useWorkCheckSlotMutations } from '../hooks/useWorkCheckSlotMutations';
import { useDebounce } from '../hooks/useDebounce';
import useSlotBulkSelection from '../hooks/useSlotBulkSelection';
import SlotTable from '../components/admin/SlotTable';
import SlotFilters from '../components/admin/SlotFilters';
import SlotSelectionToolbar from '../components/admin/SlotSelectionToolbar';
import SlotFormModal from '../components/admin/SlotFormModal';
import DeleteSlotsModal from '../components/admin/DeleteSlotsModal';
import CloneSlotsModal from '../components/admin/CloneSlotsModal';

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

function WorkCheckSlots() {
  // Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

  // Filter state
  const [searchInput, setSearchInput] = useState('');
  const [instructorFilter, setInstructorFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activationFilter, setActivationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('slot_date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  const debouncedSearch = useDebounce(searchInput, 300);

  // Build query params (sorting handled on frontend)
  const queryParams = useMemo(() => ({
    page: currentPage,
    limit: 50,
    instructor_id: instructorFilter || undefined,
    group_id: groupFilter || undefined,
    location: locationFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    is_active: statusFilter !== 'all' ? statusFilter : undefined,
    activation_status: activationFilter !== 'all' ? activationFilter : undefined
  }), [currentPage, instructorFilter, groupFilter, locationFilter, dateFrom, dateTo, statusFilter, activationFilter]);

  // Fetch slots
  const {
    data: slotsData,
    isLoading: slotsLoading,
    error: slotsError
  } = useWorkCheckSlotsData(queryParams);

  // Mutations
  const { createSlot, updateSlot } = useWorkCheckSlotMutations();

  // Frontend sorting logic
  const sortedSlots = useMemo(() => {
    const data = slotsData?.data || [];
    if (!data.length) return data;

    return [...data].sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'slot_date':
          aVal = a.slot_date || '';
          bVal = b.slot_date || '';
          break;
        case 'slot_time':
          aVal = a.slot_time || '';
          bVal = b.slot_time || '';
          break;
        case 'instructor_name':
          aVal = (a.instructor_name || '').toLowerCase();
          bVal = (b.instructor_name || '').toLowerCase();
          break;
        case 'group_id':
          aVal = a.group_id?.length || 0;
          bVal = b.group_id?.length || 0;
          break;
        case 'location':
          aVal = (a.location || '').toLowerCase();
          bVal = (b.location || '').toLowerCase();
          break;
        case 'created_at':
          aVal = a.created_at || '';
          bVal = b.created_at || '';
          break;
        default:
          aVal = a[sortBy] || '';
          bVal = b[sortBy] || '';
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [slotsData?.data, sortBy, sortOrder]);

  // Slots array for bulk selection (use sorted data)
  const slots = sortedSlots;

  // Initialize bulk selection hook
  const bulkSelection = useSlotBulkSelection(slots, slotsData?.pagination?.total_records || slots.length);

  // Calculate statistics
  const stats = useMemo(() => {
    const data = slotsData?.data || [];
    const pagination = slotsData?.pagination || {};

    const total = pagination.total_records || data.length;
    const activeCount = data.filter(s => s.is_active).length;
    const scheduledCount = data.filter(s => s.activation_status === 'scheduled').length;
    const inactiveCount = data.filter(s => !s.is_active && s.activation_status !== 'scheduled').length;

    return {
      total,
      active: activeCount,
      scheduled: scheduledCount,
      inactive: inactiveCount
    };
  }, [slotsData]);

  // Handlers
  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    // No page reset needed for frontend sorting
  }, [sortBy]);

  const handleFilterChange = useCallback((filterName, value) => {
    switch (filterName) {
      case 'instructor':
        setInstructorFilter(value);
        break;
      case 'group':
        setGroupFilter(value);
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
      case 'activation':
        setActivationFilter(value);
        break;
    }
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setInstructorFilter('');
    setGroupFilter('');
    setLocationFilter('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
    setActivationFilter('all');
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    setEditingSlot(null);
    setShowFormModal(true);
  }, []);

  const handleOpenEditModal = useCallback((slot) => {
    setEditingSlot(slot);
    setShowFormModal(true);
  }, []);

  const handleCloseFormModal = useCallback(() => {
    setShowFormModal(false);
    setEditingSlot(null);
  }, []);

  const handleFormSubmit = useCallback(async (data) => {
    try {
      if (editingSlot) {
        await updateSlot.mutateAsync({ id: editingSlot.id, data });
      } else {
        await createSlot.mutateAsync(data);
      }
      handleCloseFormModal();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }, [editingSlot, updateSlot, createSlot, handleCloseFormModal]);

  const handleConfirmToggle = useCallback(async () => {
    try {
      const result = await bulkSelection.executeBulkToggle(bulkSelection.selectedIds);
      if (result.success) {
        toast.success(`Successfully toggled status for ${result.data?.data?.updated || 0} slot(s)`);
        bulkSelection.exitToView();
      }
    } catch (error) {
      toast.error('Failed to toggle slot status');
    }
  }, [bulkSelection]);

  // Delete handlers
  const handleOpenDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(true);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    bulkSelection.exitToView();
    setIsDeleteModalOpen(false);
  }, [bulkSelection]);

  // Clone handlers
  const handleOpenCloneModal = useCallback(() => {
    setIsCloneModalOpen(true);
  }, []);

  const handleCloseCloneModal = useCallback(() => {
    setIsCloneModalOpen(false);
  }, []);

  const handleCloneSuccess = useCallback(() => {
    bulkSelection.exitToView();
    setIsCloneModalOpen(false);
  }, [bulkSelection]);

  // Pagination info
  const pagination = slotsData?.pagination || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
              Work Check Slots
            </h1>
            <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
              Manage instructor time slots for work check sessions
            </p>
          </div>
          <div>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Add Slot
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-6">
          <StatCard
            name="Total Slots"
            value={stats.total ?? '--'}
            icon={Calendar}
            bgColor="bg-primary-50"
            textColor="text-primary-600"
            isLoading={slotsLoading}
          />
          <StatCard
            name="Active"
            value={stats.active ?? '--'}
            icon={CheckCircle}
            bgColor="bg-green-50"
            textColor="text-green-600"
            isLoading={slotsLoading}
          />
          <StatCard
            name="Scheduled"
            value={stats.scheduled ?? '--'}
            icon={Clock}
            bgColor="bg-yellow-50"
            textColor="text-yellow-600"
            isLoading={slotsLoading}
          />
          <StatCard
            name="Inactive"
            value={stats.inactive ?? '--'}
            icon={XCircle}
            bgColor="bg-gray-50"
            textColor="text-gray-600"
            isLoading={slotsLoading}
          />
        </div>

        {/* Filters or Selection Toolbar */}
        {!bulkSelection.isSelectionMode ? (
          <SlotFilters
            instructorFilter={instructorFilter}
            groupFilter={groupFilter}
            locationFilter={locationFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            statusFilter={statusFilter}
            activationFilter={activationFilter}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />
        ) : (
          <SlotSelectionToolbar
            selectedCount={bulkSelection.selectedCount}
            totalCount={bulkSelection.totalCount}
            onClearAll={bulkSelection.clearAll}
            onExitMode={bulkSelection.exitToView}
            onToggleStatus={handleConfirmToggle}
            onClone={handleOpenCloneModal}
            onDelete={handleOpenDeleteModal}
            selectedSlots={bulkSelection.selectedSlots}
            isSubmitting={bulkSelection.isSubmitting}
          />
        )}

        {/* Error state */}
        {slotsError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-300">
              Error loading slots: {slotsError.message}
            </p>
          </div>
        )}

        {/* Slots Table */}
        <SlotTable
          data={slots}
          isLoading={slotsLoading}
          onSort={handleSort}
          currentSort={{ sort_by: sortBy, sort_order: sortOrder }}
          currentPage={currentPage}
          totalPages={pagination.total_pages || 1}
          totalItems={pagination.total_records || 0}
          onPageChange={handlePageChange}
          onEdit={handleOpenEditModal}
          isSelectionMode={bulkSelection.isSelectionMode}
          onToggleSelection={bulkSelection.toggleSelection}
          isSelected={bulkSelection.isSelected}
          selectedCount={bulkSelection.selectedCount}
          onSelectAll={(selectAll) => selectAll ? bulkSelection.selectAll() : bulkSelection.clearAll()}
        />

        {/* Create/Edit Modal */}
        <SlotFormModal
          isOpen={showFormModal}
          onClose={handleCloseFormModal}
          onSubmit={handleFormSubmit}
          isLoading={createSlot.isPending || updateSlot.isPending}
          initialData={editingSlot}
          mode={editingSlot ? 'edit' : 'create'}
        />

        {/* Delete Modal */}
        <DeleteSlotsModal
          isOpen={isDeleteModalOpen}
          onClose={handleCloseDeleteModal}
          selectedSlots={bulkSelection.selectedSlots}
          onSuccess={handleDeleteSuccess}
        />

        {/* Clone Modal */}
        <CloneSlotsModal
          isOpen={isCloneModalOpen}
          onClose={handleCloseCloneModal}
          selectedSlots={bulkSelection.selectedSlots}
          onSuccess={handleCloneSuccess}
        />
      </div>
    </div>
  );
}

export default WorkCheckSlots;
