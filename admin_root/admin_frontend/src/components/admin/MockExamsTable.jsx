/**
 * MockExamsTable Component
 * Displays mock exams in a sortable, infinitely scrollable table
 * Supports both aggregated (accordion) view and regular list view
 */

import { useRef, useEffect } from 'react';
import StatusBadge from './StatusBadge';
import AggregateRow from './AggregateRow';
import SessionRow from './SessionRow';

const MockExamsTable = ({
  data,
  isLoading,
  onSort,
  currentSort,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  viewMode = 'list', // 'list' or 'aggregate'
  onEdit,
  onDelete
}) => {
  const loadMoreRef = useRef(null);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const getSortIcon = (column) => {
    if (currentSort.sort_by !== column) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return currentSort.sort_order === 'asc' ? (
      <svg className="w-4 h-4 ml-1 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const SortableHeader = ({ column, children }) => (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center">
        {children}
        {getSortIcon(column)}
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="animate-pulse p-6">
          <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No mock exams found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your filters or create a new mock exam session.
          </p>
        </div>
      </div>
    );
  }

  // Render aggregate view
  if (viewMode === 'aggregate') {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader column="mock_type">Type / Sessions</SortableHeader>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((aggregate) => (
                <AggregateRow key={aggregate.aggregate_key} aggregate={aggregate} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Load more trigger and loading indicator */}
        <div ref={loadMoreRef} className="bg-white px-4 py-6 border-t border-gray-200">
          {isFetchingNextPage && (
            <div className="flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-sm text-gray-600">Loading more...</span>
            </div>
          )}
          {!hasNextPage && data && data.length > 0 && (
            <div className="text-center text-sm text-gray-500">
              No more results to load
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render regular list view
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader column="mock_type">Type</SortableHeader>
              <SortableHeader column="exam_date">Date</SortableHeader>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <SortableHeader column="location">Location</SortableHeader>
              <SortableHeader column="capacity">Capacity</SortableHeader>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Utilization
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((exam) => (
              <SessionRow
                key={exam.id}
                session={exam}
                nested={false}
                onEdit={onEdit || ((session) => window.location.href = `/admin/mock-exams/${session.id}/edit`)}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Load more trigger and loading indicator */}
      <div ref={loadMoreRef} className="bg-white px-4 py-6 border-t border-gray-200">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center">
            <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="ml-2 text-sm text-gray-600">Loading more...</span>
          </div>
        )}
        {!hasNextPage && data && data.length > 0 && (
          <div className="text-center text-sm text-gray-500">
            No more results to load
          </div>
        )}
      </div>
    </div>
  );
};

export default MockExamsTable;