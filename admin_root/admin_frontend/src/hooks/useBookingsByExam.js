/**
 * useBookingsByExam Hook
 * React Query hook for fetching bookings by exam ID with CLIENT-SIDE pagination, sorting, and search
 *
 * Performance: Fetches all bookings once, then does sorting/filtering/pagination in memory
 * This provides instant sorting/filtering with no API calls or network latency
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { adminApi } from '../services/adminApi';

export const useBookingsByExam = (examId, params = {}) => {
  const {
    search = '',
    sort_by = 'created_at',
    sort_order = 'desc',
    page = 1,
    limit = 50
  } = params;

  // Fetch ALL bookings once (no server-side sorting/pagination)
  const { data: apiData, isLoading, error } = useQuery({
    queryKey: ['bookings', examId], // Only exam ID - no sort/page params!
    queryFn: async () => {
      // Fetch all bookings with high limit (no pagination)
      const response = await adminApi.get(`/admin/mock-exams/${examId}/bookings`, {
        params: { limit: 1000 } // Get all bookings at once
      });

      const result = response.data;
      const bookingsData = result?.data?.bookings;
      const attendanceSummary = result?.data?.attendance_summary;

      // Return raw bookings array and attendance summary
      return {
        bookings: Array.isArray(bookingsData) ? bookingsData : [],
        attendance_summary: attendanceSummary || { attended: 0, no_show: 0, unmarked: 0 }
      };
    },
    enabled: !!examId,
    staleTime: 5 * 60 * 1000, // 5 minutes (longer since we fetch once)
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    onError: (error) => {
      console.error('Error fetching bookings:', error);
    }
  });

  // Client-side filtering, sorting, and pagination (instant, no API calls!)
  const processedData = useMemo(() => {
    if (!apiData) {
      return {
        data: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false
        },
        attendance_summary: { attended: 0, no_show: 0, unmarked: 0 }
      };
    }

    // Step 1: Filter by search term
    let filteredBookings = apiData.bookings;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredBookings = apiData.bookings.filter(booking => {
        const name = (booking.name || '').toLowerCase();
        const email = (booking.email || '').toLowerCase();
        const studentId = (booking.student_id || '').toLowerCase();
        return name.includes(searchLower) ||
               email.includes(searchLower) ||
               studentId.includes(searchLower);
      });
    }

    // Step 2: Sort bookings
    const sortedBookings = [...filteredBookings].sort((a, b) => {
      let aValue, bValue;

      switch (sort_by) {
        case 'name':
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
          break;
        case 'email':
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
          break;
        case 'student_id':
          aValue = (a.student_id || '').toLowerCase();
          bValue = (b.student_id || '').toLowerCase();
          break;
        case 'dominant_hand':
          aValue = (a.dominant_hand || '').toLowerCase();
          bValue = (b.dominant_hand || '').toLowerCase();
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at || 0);
          bValue = new Date(b.created_at || 0);
          break;
      }

      if (aValue < bValue) return sort_order === 'asc' ? -1 : 1;
      if (aValue > bValue) return sort_order === 'asc' ? 1 : -1;
      return 0;
    });

    // Step 3: Paginate
    const totalBookings = sortedBookings.length;
    const totalPages = Math.ceil(totalBookings / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalBookings);
    const paginatedBookings = sortedBookings.slice(startIndex, endIndex);

    return {
      data: paginatedBookings,
      pagination: {
        page,
        limit,
        total: totalBookings,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      attendance_summary: apiData.attendance_summary
    };
  }, [apiData, search, sort_by, sort_order, page, limit]);

  return {
    data: processedData,
    isLoading,
    error
  };
};