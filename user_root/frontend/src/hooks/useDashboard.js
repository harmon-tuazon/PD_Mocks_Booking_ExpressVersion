/**
 * useDashboard.js
 * Hook for fetching and managing dashboard data
 */
import { useState, useEffect, useCallback } from 'react';
import { getUserSession } from '../utils/auth';
import apiService from '../services/api';

export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    const session = getUserSession();
    if (!session) {
      setError({ code: 'NOT_AUTHENTICATED', message: 'Please log in' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.dashboard.get(
        session.studentId,
        session.email
      );

      if (response.success) {
        setData(response.data);
      } else {
        setError(response.error || { code: 'UNKNOWN_ERROR', message: 'Failed to load dashboard' });
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError({
        code: err.code || 'FETCH_ERROR',
        message: err.message || 'Failed to load dashboard'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  return {
    data,
    loading,
    error,
    refresh: fetchDashboard
  };
}

export default useDashboard;
