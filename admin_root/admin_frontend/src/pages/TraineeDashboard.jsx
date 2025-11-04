import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import TraineeInfoCard from '../components/admin/TraineeInfoCard';
import BookingsSection from '../components/admin/BookingsSection';
import EmptyState from '../components/shared/EmptyState';
import { traineeApi } from '../services/adminApi';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

function TraineeDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  // Handle search form submission
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim().length >= 2) {
      setSubmittedSearch(searchTerm.trim());
    }
  };

  // Handle clear search
  const handleClear = () => {
    setSearchTerm('');
    setSubmittedSearch('');
  };

  // React Query for trainee search
  const {
    data: traineeData,
    isLoading: isSearching,
    error: searchError,
    isSuccess
  } = useQuery({
    queryKey: ['trainee-search', submittedSearch],
    queryFn: () => traineeApi.search(submittedSearch),
    enabled: submittedSearch.length > 0,
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

  const hasSearched = submittedSearch.length > 0;
  // Search returns array of contacts, we take the first one
  const trainee = contacts.length > 0 ? { ...contacts[0], contactId: contacts[0].id } : null;
  const bookings = bookingsData?.data?.bookings || [];
  const bookingsSummary = bookingsData?.data?.summary || null;

  return (
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

      {/* Search Form */}
      <form onSubmit={handleSearch} className="max-w-xl mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student ID or email..."
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={searchTerm.trim().length < 2}>
            Search
          </Button>
          {submittedSearch && (
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear
            </Button>
          )}
        </div>
      </form>

      {/* Content Area */}
      <div className="space-y-6">
        {/* Empty State - No search performed */}
        {!hasSearched && (
          <EmptyState
            icon={<Search className="h-12 w-12" />}
            heading="Start Searching for a Training Doctor"
            description="Search by student ID or email to view the training doctor's booking history."
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
            description={`No results found for "${submittedSearch}". Try adjusting your search criteria.`}
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
  );
}

export default TraineeDashboard;