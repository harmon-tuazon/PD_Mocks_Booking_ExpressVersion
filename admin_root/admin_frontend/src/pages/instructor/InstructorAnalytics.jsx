/**
 * InstructorAnalytics - Analytics dashboard for instructor portal
 * Displays KPIs, charts, and tables for work check booking performance
 * Matches InstructorDashboard styling patterns
 */

import React, { useState, useMemo } from 'react';
import { useInstructorAnalytics, useInstructorGroups } from '../../hooks/useInstructorPortalData';
import { ArrowPathIcon, ChartBarIcon } from '@heroicons/react/24/outline';

// ─── Status color mapping ────────────────────────────────────
const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-400', text: 'text-yellow-800 dark:text-yellow-300', dot: 'bg-yellow-400' },
  confirmed: { bg: 'bg-green-400', text: 'text-green-800 dark:text-green-300', dot: 'bg-green-400' },
  marked: { bg: 'bg-blue-400', text: 'text-blue-800 dark:text-blue-300', dot: 'bg-blue-400' },
  completed: { bg: 'bg-purple-400', text: 'text-purple-800 dark:text-purple-300', dot: 'bg-purple-400' },
  rejected: { bg: 'bg-red-400', text: 'text-red-800 dark:text-red-300', dot: 'bg-red-400' },
  cancelled: { bg: 'bg-gray-400', text: 'text-gray-800 dark:text-gray-300', dot: 'bg-gray-400' }
};

// ─── Type color mapping ──────────────────────────────────────
const TYPE_COLORS = {
  'Work Check': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Demo': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Supervised Session': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
};

// ─── Helpers ─────────────────────────────────────────────────
const formatWeekLabel = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatTime = (timeStr) => {
  if (!timeStr) return '-';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hours = h % 12 || 12;
  return `${hours}:${String(m).padStart(2, '0')} ${period}`;
};

// ─── Stat Card (matches InstructorDashboard pattern) ─────────
const StatCard = ({ label, value, suffix = '' }) => (
  <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
    <div className="p-5">
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {value !== undefined && value !== null ? `${value}${suffix}` : '-'}
      </dd>
    </div>
  </div>
);

// ─── Stat Card Skeleton ──────────────────────────────────────
const StatCardSkeleton = () => (
  <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg animate-pulse">
    <div className="p-5">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
    </div>
  </div>
);

// ─── Section Skeleton ────────────────────────────────────────
const SectionSkeleton = ({ height = 'h-48' }) => (
  <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg animate-pulse">
    <div className="p-6">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4"></div>
      <div className={`bg-gray-200 dark:bg-gray-700 rounded ${height}`}></div>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────
const InstructorAnalytics = () => {
  // Filter state
  const [dateRange, setDateRange] = useState('month');
  const [selectedCycle, setSelectedCycle] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  // Fetch groups for cycle/group dropdowns
  const { data: groupsRes } = useInstructorGroups({ status: 'all' });
  const allGroups = groupsRes?.data || [];

  // Compute distinct cycles from groups
  const distinctCycles = useMemo(() => {
    const cycles = new Set();
    allGroups.forEach((g) => {
      if (g.cycle) cycles.add(g.cycle);
    });
    return Array.from(cycles).sort();
  }, [allGroups]);

  // Filter groups by selected cycle
  const filteredGroups = useMemo(() => {
    if (!selectedCycle) return allGroups;
    return allGroups.filter((g) => g.cycle === selectedCycle);
  }, [allGroups, selectedCycle]);

  // Compute query params from filter state
  const params = useMemo(() => {
    const p = {};
    const today = new Date();
    if (dateRange === 'week') {
      // This week: Monday to today
      const day = today.getDay(); // 0=Sun
      const diff = day === 0 ? 6 : day - 1; // days since Monday
      const monday = new Date(today);
      monday.setDate(today.getDate() - diff);
      p.date_from = monday.toISOString().split('T')[0];
      p.date_to = today.toISOString().split('T')[0];
    } else if (dateRange === 'month') {
      // This month: 1st of current month to today
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      p.date_from = firstOfMonth.toISOString().split('T')[0];
      p.date_to = today.toISOString().split('T')[0];
    }
    // 'all' — no date params, backend defaults to all time
    if (selectedCycle) p.cycle = selectedCycle;
    if (selectedGroup) p.group_id = selectedGroup;
    return p;
  }, [dateRange, selectedCycle, selectedGroup]);

  // Fetch analytics data
  const { data, isLoading, isFetching, error, refetch } = useInstructorAnalytics(params);
  const analytics = data?.data;

  // Cascade: when cycle changes, clear group if not in filtered set
  const handleCycleChange = (cycle) => {
    setSelectedCycle(cycle);
    if (cycle) {
      const groupsInCycle = allGroups.filter((g) => g.cycle === cycle);
      const groupIds = groupsInCycle.map((g) => g.group_id);
      if (selectedGroup && !groupIds.includes(selectedGroup)) {
        setSelectedGroup('');
      }
    }
  };

  // Reset all filters
  const handleReset = () => {
    setDateRange('month');
    setSelectedCycle('');
    setSelectedGroup('');
  };

  // ─── Error State ──────────────────────────────────────────
  if (error && !isLoading) {
    return (
      <div className="container-app py-8">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
              Analytics
            </h1>
            <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
              Your work check performance overview
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
            Failed to load analytics data. Please try again later.
          </div>
        </div>
      </div>
    );
  }

  // ─── KPI values (safe access) ─────────────────────────────
  const kpis = analytics?.kpis || {};
  const statusBreakdown = analytics?.status_breakdown || {};
  const typeBreakdown = analytics?.type_breakdown || {};
  const weeklyTrends = analytics?.weekly_trends || [];
  const groupPerformance = analytics?.group_performance || [];
  const busiestDays = analytics?.busiest_days || [];
  const busiestTimes = analytics?.busiest_times || [];

  // Compute total for status breakdown bar
  const statusTotal = Object.values(statusBreakdown).reduce((sum, v) => sum + (v || 0), 0);

  // Compute max for weekly trend bars
  const maxWeeklyBookings = Math.max(...weeklyTrends.map((w) => w.bookings), 1);

  // Compute max for busiest days/times bars
  const maxDayAvg = Math.max(...busiestDays.map((d) => d.avg_bookings), 1);
  const maxTimeAvg = Math.max(...busiestTimes.map((t) => t.avg_bookings), 1);

  // Check if data is empty (no bookings in period)
  const hasData = analytics && (kpis.total_bookings > 0 || kpis.total_sessions > 0);

  return (
    <div className="container-app py-8">
      <div className="space-y-6">
        {/* ─── Page Header ──────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
            Analytics
          </h1>
          <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
            Your work check performance overview
          </p>
        </div>

        {/* ─── Filter Bar ───────────────────────────────────── */}
        {isLoading ? (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg animate-pulse">
            <div className="p-4 flex items-center gap-3">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-36"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-36"></div>
              <div className="ml-auto h-8 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
            <div className="p-4 flex flex-wrap items-center gap-3">
              {/* Date Range Presets */}
              <div className="flex items-center gap-1.5">
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setDateRange(key)}
                    className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                      dateRange === key
                        ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Cycle Dropdown */}
              <select
                value={selectedCycle}
                onChange={(e) => handleCycleChange(e.target.value)}
                className="block rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 pl-3 pr-8"
              >
                <option value="">All Cycles</option>
                {distinctCycles.map((cycle) => (
                  <option key={cycle} value={cycle}>{cycle}</option>
                ))}
              </select>

              {/* Group Dropdown */}
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="block rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 pl-3 pr-8"
              >
                <option value="">All Groups</option>
                {filteredGroups.map((group) => (
                  <option key={group.group_id} value={group.group_id}>
                    {group.group_name || group.group_id}
                  </option>
                ))}
              </select>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Refresh Button */}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={isFetching ? 'Refreshing...' : 'Refresh analytics'}
              >
                <ArrowPathIcon className={`h-5 w-5 text-gray-500 dark:text-gray-400 ${isFetching ? 'animate-spin' : ''}`} />
              </button>

              {/* Reset Button */}
              <button
                onClick={handleReset}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ─── KPI Cards ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard label="Total Sessions" value={kpis.total_sessions ?? 0} />
              <StatCard label="Total Bookings" value={kpis.total_bookings ?? 0} />
              <StatCard label="Attendance Rate" value={kpis.attendance_rate ?? 0} suffix="%" />
              <StatCard label="Cancellation Rate" value={kpis.cancellation_rate ?? 0} suffix="%" />
              <StatCard label="No-Show Rate" value={kpis.no_show_rate ?? 0} suffix="%" />
            </>
          )}
        </div>

        {/* ─── Status & Type Breakdown ──────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionSkeleton height="h-32" />
            <SectionSkeleton height="h-24" />
          </div>
        ) : hasData ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Status Breakdown */}
            <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
              <div className="p-6">
                <h3 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100 mb-4">
                  Status Breakdown
                </h3>

                {statusTotal > 0 ? (
                  <>
                    {/* Stacked Bar */}
                    <div className="flex w-full h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                      {Object.entries(STATUS_COLORS).map(([status, colors]) => {
                        const count = statusBreakdown[status] || 0;
                        if (count === 0) return null;
                        const pct = (count / statusTotal) * 100;
                        return (
                          <div
                            key={status}
                            className={`${colors.bg} transition-all duration-300`}
                            style={{ width: `${pct}%` }}
                            title={`${status}: ${count} (${pct.toFixed(1)}%)`}
                          />
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                      {Object.entries(STATUS_COLORS).map(([status, colors]) => {
                        const count = statusBreakdown[status] || 0;
                        if (count === 0) return null;
                        return (
                          <div key={status} className="flex items-center gap-1.5">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                            <span className={`text-sm ${colors.text} capitalize`}>
                              {status}: {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No status data available.</p>
                )}
              </div>
            </div>

            {/* Type Breakdown */}
            <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
              <div className="p-6">
                <h3 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100 mb-4">
                  Type Breakdown
                </h3>

                {Object.keys(typeBreakdown).length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(typeBreakdown).map(([type, count]) => (
                      <span
                        key={type}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                          TYPE_COLORS[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {type}: {count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No type data available.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
              <div className="p-6">
                <h3 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100 mb-4">
                  Status Breakdown
                </h3>
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No booking data found for the selected period.</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
              <div className="p-6">
                <h3 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100 mb-4">
                  Type Breakdown
                </h3>
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No booking data found for the selected period.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Weekly Trends ────────────────────────────────── */}
        {isLoading ? (
          <SectionSkeleton height="h-48" />
        ) : (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
            <div className="p-6">
              <h3 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100 mb-4">
                Bookings Over Time
              </h3>

              {weeklyTrends.length > 0 ? (
                <div className="flex items-end gap-2 overflow-x-auto pb-2">
                  {weeklyTrends.map((week) => (
                    <div key={week.week_start} className="flex flex-col items-center flex-1 min-w-0" style={{ minWidth: '40px' }}>
                      <div className="w-full flex flex-col justify-end" style={{ height: '160px' }}>
                        <div
                          className="w-full bg-primary-400 dark:bg-primary-500 rounded-t transition-all duration-300"
                          style={{
                            height: `${(week.bookings / maxWeeklyBookings) * 100}%`,
                            minHeight: week.bookings > 0 ? '4px' : '0'
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate w-full text-center">
                        {formatWeekLabel(week.week_start)}
                      </span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {week.bookings}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No booking data found for the selected period.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Busiest Days & Times ─────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionSkeleton height="h-40" />
            <SectionSkeleton height="h-40" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Busiest Days */}
            <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
              <div className="p-6">
                <h3 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100 mb-4">
                  Busiest Days
                </h3>

                {busiestDays.length > 0 ? (
                  <div className="space-y-3">
                    {busiestDays.map((item, idx) => (
                      <div key={item.day} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 flex-shrink-0">
                          {item.day}
                        </span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              idx === 0 ? 'bg-primary-500' : 'bg-primary-300 dark:bg-primary-600'
                            }`}
                            style={{ width: `${(item.avg_bookings / maxDayAvg) * 100}%`, minWidth: item.avg_bookings > 0 ? '8px' : '0' }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-10 text-right flex-shrink-0">
                          {item.avg_bookings}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No data available.</p>
                )}
              </div>
            </div>

            {/* Busiest Times */}
            <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
              <div className="p-6">
                <h3 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100 mb-4">
                  Busiest Times
                </h3>

                {busiestTimes.length > 0 ? (
                  <div className="space-y-3">
                    {busiestTimes.map((item, idx) => (
                      <div key={item.time} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 flex-shrink-0">
                          {formatTime(item.time)}
                        </span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              idx === 0 ? 'bg-primary-500' : 'bg-primary-300 dark:bg-primary-600'
                            }`}
                            style={{ width: `${(item.avg_bookings / maxTimeAvg) * 100}%`, minWidth: item.avg_bookings > 0 ? '8px' : '0' }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-10 text-right flex-shrink-0">
                          {item.avg_bookings}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No data available.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Group Performance Table ──────────────────────── */}
        {isLoading ? (
          <SectionSkeleton height="h-48" />
        ) : (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
            <div className="p-6">
              <h3 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100 mb-4">
                Group Performance
              </h3>

              {groupPerformance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 font-body">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Group Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Students
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Bookings
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Attended
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Cancelled
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Participation %
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Attendance %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                      {groupPerformance.map((group) => (
                        <tr key={group.group_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {group.group_name || group.group_id}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {group.enrolled_students ?? '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {group.total_bookings ?? '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {group.attended ?? '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {group.cancelled ?? '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {group.participation_rate !== undefined && group.participation_rate !== null
                              ? `${group.participation_rate}%`
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {group.attendance_rate !== undefined && group.attendance_rate !== null
                              ? `${group.attendance_rate}%`
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No group data</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    No booking data found for the selected period.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorAnalytics;
