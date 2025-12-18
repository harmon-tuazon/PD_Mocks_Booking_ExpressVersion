/**
 * Custom hook for fetching available prerequisite exams
 */

import { useQuery } from '@tanstack/react-query';
import { mockExamsApi } from '../services/adminApi';

/**
 * Hook to fetch available prerequisite exams based on discussion exam date
 * @param {string} mockExamId - The Mock Discussion exam ID (to exclude from results)
 * @param {string} discussionExamDate - The exam date of the Mock Discussion
 * @param {Object} options - Additional React Query options
 * @returns {Object} Query result with available prerequisite exams
 */
export function usePrerequisiteExams(mockExamId, discussionExamDate, options = {}) {
  return useQuery({
    queryKey: ['availablePrerequisites', mockExamId, discussionExamDate],
    queryFn: async () => {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Build base query parameters
      // Note: Backend validation expects 'filter_' prefix for filter params
      // Using limit=500 to minimize API calls while staying within reasonable response sizes
      const PAGE_SIZE = 500;
      const MAX_PAGES = 20; // Safety limit: 500 * 20 = 10,000 exams max

      const baseParams = {
        filter_mock_type: ['Clinical Skills', 'Situational Judgment'],
        filter_status: 'active', // 'active' matches is_active = 'true' in DB
        filter_date_from: today,
        filter_date_to: discussionExamDate,
        sort_by: 'exam_date',
        sort_order: 'asc',
        limit: PAGE_SIZE
      };

      // Fetch all pages to get complete list of available prerequisites
      let allExams = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await mockExamsApi.list({ ...baseParams, page: currentPage });

        // Extract exams from response
        let pageExams = [];
        if (response?.data && Array.isArray(response.data)) {
          pageExams = response.data;
        } else if (Array.isArray(response)) {
          pageExams = response;
        }

        allExams = [...allExams, ...pageExams];

        // Check if there are more pages
        const pagination = response?.pagination;
        if (pagination && pagination.current_page < pagination.total_pages) {
          currentPage++;
        } else {
          hasMorePages = false;
        }

        // Safety limit to prevent infinite loops
        if (currentPage > MAX_PAGES) {
          console.warn(`Prerequisite exams fetch hit safety limit of ${MAX_PAGES} pages (${MAX_PAGES * PAGE_SIZE} exams)`);
          hasMorePages = false;
        }
      }

      return allExams;
    },
    // Only fetch when we have a discussion exam date
    enabled: !!discussionExamDate,
    // Cache for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Keep cached data for 10 minutes
    cacheTime: 10 * 60 * 1000,
    // Return empty array as placeholder while loading
    placeholderData: [],
    ...options
  });
}

/**
 * Helper function to filter exams client-side
 * @param {Array} exams - Array of exam objects
 * @param {string} mockExamId - Current Mock Discussion ID to exclude
 * @param {Array} currentAssociations - Currently associated exam IDs
 * @param {string} searchTerm - Search term for filtering
 * @returns {Array} Filtered exams
 */
export function filterPrerequisiteExams(exams, mockExamId, currentAssociations = [], searchTerm = '') {
  if (!Array.isArray(exams)) return [];

  let filtered = exams.filter(exam => {
    // Exclude the Mock Discussion exam itself
    if (exam.id === mockExamId) return false;

    // Exclude already associated exams (optional - you might want to show them as checked)
    // if (currentAssociations.includes(exam.id)) return false;

    return true;
  });

  // Apply search filter if searchTerm exists
  if (searchTerm && searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase();
    filtered = filtered.filter(exam => {
      // Search in mock type
      if (exam.properties?.mock_type?.toLowerCase().includes(searchLower)) return true;
      if (exam.mock_type?.toLowerCase().includes(searchLower)) return true;

      // Search in location
      if (exam.properties?.location?.toLowerCase().includes(searchLower)) return true;
      if (exam.location?.toLowerCase().includes(searchLower)) return true;

      // Search in exam date
      if (exam.properties?.exam_date?.includes(searchTerm)) return true;
      if (exam.exam_date?.includes(searchTerm)) return true;

      return false;
    });
  }

  return filtered;
}