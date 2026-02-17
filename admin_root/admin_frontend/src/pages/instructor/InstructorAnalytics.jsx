/**
 * InstructorAnalytics - Analytics dashboard for instructor portal and admin portal
 * Displays KPIs, charts, and tables for work check booking performance
 * Supports dual-mode: instructor portal (own data) or admin view (specific instructor via prop)
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useInstructorAnalytics, useInstructorGroups } from '../../hooks/useInstructorPortalData';
import { instructorsApi } from '../../services/adminApi';
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

const formatMonthLabel = (monthStr) => {
  const [year, month] = monthStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1]} '${year.slice(2)}`;
};

const aggregateToMonthly = (trends) => {
  const monthMap = {};
  for (const w of trends) {
    const monthKey = w.week_start.substring(0, 7);
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { bookings: 0, rateWeightedSum: 0 };
    }
    monthMap[monthKey].bookings += w.bookings;
    monthMap[monthKey].rateWeightedSum += w.attendance_rate * w.bookings;
  }
  return Object.keys(monthMap).sort().map(month => ({
    label: formatMonthLabel(month),
    bookings: monthMap[month].bookings,
    attendance_rate: monthMap[month].bookings > 0
      ? Math.round(monthMap[month].rateWeightedSum / monthMap[month].bookings * 10) / 10
      : 0
  }));
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
const InstructorAnalytics = ({ instructorId = null }) => {
  const isAdminView = !!instructorId;

  // Filter state
  const [dateRange, setDateRange] = useState('all');
  const [selectedCycle, setSelectedCycle] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  // Fetch groups: instructor portal uses existing hook, admin uses instructorsApi
  const { data: portalGroupsRes } = useInstructorGroups(
    { status: 'all' },
    { enabled: !isAdminView }
  );
  const { data: adminGroupsRes } = useQuery({
    queryKey: ['admin-instructor-groups', instructorId],
    queryFn: () => instructorsApi.getGroups(instructorId, { status: 'all' }),
    enabled: isAdminView,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  const allGroups = (isAdminView ? adminGroupsRes?.data : portalGroupsRes?.data) || [];

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

  // Fetch analytics: instructor portal uses existing hook, admin uses instructorsApi
  const portalAnalytics = useInstructorAnalytics(params, { enabled: !isAdminView });
  const adminAnalytics = useQuery({
    queryKey: ['admin-instructor-analytics', instructorId, JSON.stringify(params)],
    queryFn: () => instructorsApi.getAnalytics(instructorId, params),
    enabled: isAdminView,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data, isLoading, isFetching, error, refetch } = isAdminView ? adminAnalytics : portalAnalytics;
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
    setDateRange('all');
    setSelectedCycle('');
    setSelectedGroup('');
  };

  // ─── Error State ──────────────────────────────────────────
  if (error && !isLoading) {
    return (
      <div className={isAdminView ? '' : 'container-app py-8'}>
        <div className="space-y-6">
          {!isAdminView && (
            <div className="mb-8">
              <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
                Analytics
              </h1>
              <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
                Your work check performance overview
              </p>
            </div>
          )}

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

  // Auto-aggregate: weekly if < 12 data points, monthly if >= 12
  const chartData = useMemo(() => {
    if (weeklyTrends.length === 0) return [];
    if (weeklyTrends.length < 12) {
      return weeklyTrends.map(w => ({
        label: formatWeekLabel(w.week_start),
        bookings: w.bookings,
        attendance_rate: w.attendance_rate
      }));
    }
    return aggregateToMonthly(weeklyTrends);
  }, [weeklyTrends]);

  const maxChartBookings = Math.max(...chartData.map((d) => d.bookings), 1);

  // Cap busiest times to top 5
  const busiestTimesDisplay = busiestTimes.slice(0, 5);

  // Compute max for busiest days/times bars
  const maxDayAvg = Math.max(...busiestDays.map((d) => d.avg_bookings), 1);
  const maxTimeAvg = Math.max(...busiestTimesDisplay.map((t) => t.avg_bookings), 1);

  // Check if data is empty (no bookings in period)
  const hasData = analytics && (kpis.total_bookings > 0 || kpis.total_sessions > 0);

  return (
    <div className={isAdminView ? '' : 'container-app py-8'}>
      <div className="space-y-6">
        {/* ─── Page Header (hidden in admin view — parent provides it) ── */}
        {!isAdminView && (
          <div className="mb-8">
            <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
              Analytics
            </h1>
            <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
              Your work check performance overview
            </p>
          </div>
        )}

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
                className="block w-auto pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                className="block w-auto pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Groups</option>
                {filteredGroups.map((group) => (
                  <option key={group.group_id} value={group.group_id}>
                    {group.group_name || group.group_id}
                  </option>
                ))}
              </select>

              {/* Reset Button - beside filters */}
              <button
                onClick={handleReset}
                className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-all duration-200"
              >
                Reset
              </button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Refresh Button */}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                {isFetching ? 'Refreshing...' : 'Refresh'}
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

        {/* ─── Bookings Over Time (Combo Chart) ──────────────── */}
        {isLoading ? (
          <SectionSkeleton height="h-64" />
        ) : (
          <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
            <div className="p-6">
              <h3 className="font-headline text-xl font-bold text-navy-900 dark:text-gray-100 mb-4">
                Bookings Over Time
              </h3>

              {chartData.length > 0 ? (
                <>
                  {/* Chart with Y-axes */}
                  <div className="flex items-stretch">
                    {/* Left Y-axis: Bookings count */}
                    <div className="flex flex-col justify-between items-end pr-2 flex-shrink-0" style={{ width: '36px', height: '200px' }}>
                      <span className="text-[10px] text-blue-500 font-medium leading-none">{maxChartBookings}</span>
                      <span className="text-[10px] text-blue-500 font-medium leading-none">{Math.round(maxChartBookings / 2)}</span>
                      <span className="text-[10px] text-blue-500 font-medium leading-none">0</span>
                    </div>

                    {/* Chart area */}
                    <div className="flex-1 relative" style={{ height: '200px' }}>
                      {/* Bars for booking counts */}
                      <div className="flex items-end gap-1 h-full">
                        {chartData.map((d, i) => (
                          <div key={i} className="flex-1 min-w-0 h-full" style={{ minWidth: '16px' }}>
                            <div className="w-full flex flex-col justify-end h-full">
                              <div
                                className="w-full bg-blue-300 dark:bg-blue-700/60 rounded-t transition-all duration-300"
                                style={{
                                  height: `${(d.bookings / maxChartBookings) * 100}%`,
                                  minHeight: d.bookings > 0 ? '4px' : '0'
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* SVG overlay: grid + lines */}
                      <svg
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        {/* Horizontal grid lines */}
                        {[0, 25, 50, 75, 100].map((y) => (
                          <line
                            key={y}
                            x1="0" y1={y} x2="100" y2={y}
                            stroke="currentColor"
                            className="text-gray-300 dark:text-gray-600"
                            strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                            strokeDasharray={y === 0 || y === 100 ? 'none' : '4 3'}
                          />
                        ))}

                        {/* Bookings trend line (blue) */}
                        {chartData.length > 1 && (
                          <polyline
                            points={chartData.map((d, i) => {
                              const x = ((i + 0.5) / chartData.length) * 100;
                              const y = 100 - (d.bookings / maxChartBookings) * 100;
                              return `${x},${y}`;
                            }).join(' ')}
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* Attendance rate line (amber) */}
                        {chartData.length > 1 && (
                          <polyline
                            points={chartData.map((d, i) => {
                              const x = ((i + 0.5) / chartData.length) * 100;
                              const y = 100 - Math.min(d.attendance_rate, 100);
                              return `${x},${y}`;
                            }).join(' ')}
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                            strokeLinejoin="round"
                          />
                        )}
                      </svg>

                      {/* Dot + data label: bookings (blue) */}
                      {chartData.map((d, i) => {
                        const leftPct = ((i + 0.5) / chartData.length) * 100;
                        const bottomPct = (d.bookings / maxChartBookings) * 100;
                        return (
                          <div key={`b-${i}`} className="absolute pointer-events-none" style={{ left: `${leftPct}%`, bottom: `${bottomPct}%`, transform: 'translate(-50%, 50%)' }}>
                            <div className="relative flex flex-col items-center">
                              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 leading-none mb-0.5" style={{ transform: 'translateY(-10px)' }}>
                                {d.bookings}
                              </span>
                              <div className="w-2 h-2 rounded-full bg-blue-500 border border-white dark:border-gray-800" />
                            </div>
                          </div>
                        );
                      })}

                      {/* Dot + data label: attendance rate (amber) */}
                      {chartData.map((d, i) => {
                        const leftPct = ((i + 0.5) / chartData.length) * 100;
                        const bottomPct = Math.min(d.attendance_rate, 100);
                        return (
                          <div key={`a-${i}`} className="absolute pointer-events-none" style={{ left: `${leftPct}%`, bottom: `${bottomPct}%`, transform: 'translate(-50%, 50%)' }}>
                            <div className="relative flex flex-col items-center">
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 leading-none mb-0.5" style={{ transform: 'translateY(-10px)' }}>
                                {d.attendance_rate}%
                              </span>
                              <div className="w-2 h-2 rounded-full bg-amber-500 border border-white dark:border-gray-800" />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Y-axis: Attendance rate % */}
                    <div className="flex flex-col justify-between items-start pl-2 flex-shrink-0" style={{ width: '36px', height: '200px' }}>
                      <span className="text-[10px] text-amber-500 font-medium leading-none">100%</span>
                      <span className="text-[10px] text-amber-500 font-medium leading-none">50%</span>
                      <span className="text-[10px] text-amber-500 font-medium leading-none">0%</span>
                    </div>
                  </div>

                  {/* X-axis labels */}
                  <div className="flex mt-2" style={{ marginLeft: '36px', marginRight: '36px' }}>
                    {chartData.map((d, i) => (
                      <div key={i} className="flex-1 min-w-0 text-center" style={{ minWidth: '16px' }}>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate block">
                          {d.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-blue-300 dark:bg-blue-700/60" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Bookings (bars)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5 rounded bg-blue-500" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Bookings (trend)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5 rounded bg-amber-500" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Attendance Rate</span>
                    </div>
                    {weeklyTrends.length >= 12 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto italic">
                        Aggregated monthly
                      </span>
                    )}
                  </div>
                </>
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

                {busiestTimesDisplay.length > 0 ? (
                  <div className="space-y-3">
                    {busiestTimesDisplay.map((item, idx) => (
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
