import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import TraineeInfoCard from '../components/admin/TraineeInfoCard';
import BookingsSection from '../components/admin/BookingsSection';
import EmptyState from '../components/shared/EmptyState';
import SearchBar from '../components/shared/SearchBar';
import { useDebounce } from '../hooks/useDebounce';
import { traineeApi } from '../services/adminApi';

function TraineeDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);

  // React Query for trainee search
  const {
    data: traineeData,
    isLoading: isSearching,
    error: searchError,
    isSuccess
  } = useQuery({
    queryKey: ['trainee-search', debouncedSearch],
    queryFn: () => traineeApi.search(debouncedSearch),
    enabled: debouncedSearch.length > 0,
    staleTime: 30000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract contact ID from search results
  const contacts = traineeData?.data?.contacts || [];
  const contactId = contacts.length > 0 ? contacts[0].id : null;

  // React Query for trainee bookings
  const {
    data: bookingsData,
    isLoading: isLoadingBookings,
    error: bookingsError
  } = useQuery({
    queryKey: ['trainee-bookings', contactId],
    queryFn: () => traineeApi.getBookings(contactId),
    enabled: !!contactId,
    staleTime: 30000,
    cacheTime: 5 * 60 * 1000,
  });

  const hasSearched = debouncedSearch.length > 0;
  // Search returns array of contacts, we take the first one
  const trainee = contacts.length > 0 ? { ...contacts[0], contactId: contacts[0].id } : null;
  const bookings = bookingsData?.data?.bookings || [];
  const bookingsSummary = bookingsData?.data?.summary || null;

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100 mb-2">
              Trainee Lookup
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Search for a trainee to view their information and booking history
            </p>
          </div>

          {/* Search Bar */}
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            loading={isSearching}
            placeholder="Search by name, email, or student ID..."
          />

          {/* Content Area */}
          <div className="space-y-6">
            {/* Empty State - No search performed */}
            {!hasSearched && (
              <EmptyState
                icon={<Search className="h-12 w-12" />}
                heading="Start Searching for a Training Doctor"
                description="Search by name, email or trainee ID to see the training doctor's exam history."
              />
            )}

            {/* Loading State */}
            {isSearching && hasSearched && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            )}

            {/* Error State */}
            {searchError && hasSearched && !isSearching && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      {searchError.message || 'An error occurred while searching'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* No Results Found */}
            {hasSearched && !isSearching && isSuccess && !trainee && (
              <EmptyState
                icon={<Search className="h-12 w-12" />}
                heading="No Trainee Found"
                description={`No results found for "${searchTerm}". Try adjusting your search criteria.`}
              />
            )}

            {/* Trainee Found - Show Info and Bookings */}
            {trainee && (
              <>
                {/* Trainee Information Card */}
                <TraineeInfoCard trainee={trainee} />

                {/* Bookings Section */}
                <BookingsSection
                  bookings={bookings}
                  summary={bookingsSummary}
                  loading={isLoadingBookings}
                  error={bookingsError}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default TraineeDashboard;