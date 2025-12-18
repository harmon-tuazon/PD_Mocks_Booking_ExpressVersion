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

      // Build query parameters
      // Note: Backend validation expects 'filter_' prefix for filter params
      const params = {
        filter_mock_type: ['Clinical Skills', 'Situational Judgment'],
        filter_status: 'active', // 'active' matches is_active = 'true' in DB
        filter_date_from: today,
        filter_date_to: discussionExamDate,
        sort_by: 'exam_date',
        sort_order: 'asc',
        limit: 100
      };

      // Make API call
      const response = await mockExamsApi.list(params);

      // Return the mock exams array from the response
      // Handle different possible response structures
      if (response?.data?.mock_exams) {
        return response.data.mock_exams;
      } else if (response?.data && Array.isArray(response.data)) {
        return response.data;
      } else if (Array.isArray(response)) {
        return response;
      }

      // Default to empty array if structure is unexpected
      console.warn('Unexpected response structure from mock exams API:', response);
      return [];
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