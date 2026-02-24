/**
 * MyProgress.jsx
 * User progress page with dummy analytics charts
 * Placeholder for future analytics implementation
 */
import React from 'react';

/**
 * Dummy bar chart component for exam performance
 */
const PerformanceBarChart = () => {
  const data = [
    { label: 'SJ Mock 1', value: 72, color: 'bg-primary-500' },
    { label: 'CS Mock 1', value: 85, color: 'bg-teal-500' },
    { label: 'SJ Mock 2', value: 78, color: 'bg-primary-500' },
    { label: 'Mini-mock', value: 91, color: 'bg-purple-500' },
    { label: 'CS Mock 2', value: 88, color: 'bg-teal-500' },
  ];

  return (
    <div className="bg-white dark:bg-dark-card shadow rounded-lg p-6">
      <h3 className="font-headline text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Exam Performance
      </h3>
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{item.value}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`${item.color} h-2.5 rounded-full transition-all duration-500`}
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">
        * Sample data - Connect to real exam results for accurate tracking
      </p>
    </div>
  );
};

/**
 * Dummy line chart component for progress over time
 */
const ProgressLineChart = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const values = [65, 72, 68, 79, 85, 88];
  const maxValue = Math.max(...values);

  return (
    <div className="bg-white dark:bg-dark-card shadow rounded-lg p-6">
      <h3 className="font-headline text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Progress Over Time
      </h3>
      <div className="relative h-48">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 pr-2">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>

        {/* Chart area */}
        <div className="ml-10 h-full flex items-end justify-between gap-4 border-l border-b border-gray-200 dark:border-gray-700 pl-4 pb-6">
          {months.map((month, index) => (
            <div key={month} className="flex flex-col items-center flex-1">
              <div className="relative w-full flex justify-center">
                <div
                  className="w-3 bg-primary-500 dark:bg-primary-400 rounded-t transition-all duration-500"
                  style={{ height: `${(values[index] / 100) * 140}px` }}
                />
                <div
                  className="absolute -top-6 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  {values[index]}%
                </div>
              </div>
              <span className="mt-2 text-xs text-gray-500 dark:text-gray-400">{month}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">
        * Sample data - Your actual progress will be shown here
      </p>
    </div>
  );
};

/**
 * Dummy donut chart for exam type distribution
 */
const ExamTypeDonut = () => {
  const data = [
    { label: 'Situational Judgment', value: 45, color: 'bg-primary-500', percentage: '45%' },
    { label: 'Clinical Skills', value: 30, color: 'bg-teal-500', percentage: '30%' },
    { label: 'Mini-mock', value: 15, color: 'bg-purple-500', percentage: '15%' },
    { label: 'Mock Discussion', value: 10, color: 'bg-amber-500', percentage: '10%' },
  ];

  return (
    <div className="bg-white dark:bg-dark-card shadow rounded-lg p-6">
      <h3 className="font-headline text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Exam Type Distribution
      </h3>

      {/* Simplified donut representation */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-32 h-32">
          {/* Background circle */}
          <div className="absolute inset-0 rounded-full border-8 border-gray-200 dark:border-gray-700" />
          {/* Colored segments (simplified visual) */}
          <svg className="absolute inset-0 w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="16"
              strokeDasharray="351.86"
              strokeDashoffset="0"
              className="text-primary-500"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="16"
              strokeDasharray="351.86"
              strokeDashoffset="158.34"
              className="text-teal-500"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="16"
              strokeDasharray="351.86"
              strokeDashoffset="263.90"
              className="text-purple-500"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="16"
              strokeDasharray="351.86"
              strokeDashoffset="316.67"
              className="text-amber-500"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">20</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${item.color}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {item.label} ({item.percentage})
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">
        * Sample data showing exam distribution
      </p>
    </div>
  );
};

/**
 * Stats summary cards
 */
const StatsSummary = () => {
  const stats = [
    {
      name: 'Total Exams Taken',
      value: '20',
      change: '+3 this month',
      changeType: 'positive',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: 'bg-primary-50',
      textColor: 'text-primary-600',
    },
    {
      name: 'Average Score',
      value: '82%',
      change: '+5% from last month',
      changeType: 'positive',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      bgColor: 'bg-teal-50',
      textColor: 'text-teal-600',
    },
    {
      name: 'Study Hours',
      value: '48h',
      change: '12h this week',
      changeType: 'neutral',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      name: 'Improvement Rate',
      value: '+15%',
      change: 'Since first exam',
      changeType: 'positive',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.name} className="bg-white dark:bg-dark-card overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className={`flex-shrink-0 ${stat.bgColor} dark:bg-opacity-20 rounded-md p-3`}>
                <span className={stat.textColor}>{stat.icon}</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {stat.name}
                  </dt>
                  <dd>
                    <div className={`text-2xl font-semibold ${stat.textColor} dark:text-gray-100`}>
                      {stat.value}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-3">
              <span className={`text-xs ${
                stat.changeType === 'positive'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {stat.change}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Main MyProgress page component
 */
const MyProgress = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
            My Progress
          </h1>
          <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
            Track your exam performance and study progress over time.
          </p>
        </div>

        {/* Coming Soon Banner */}
        <div className="mb-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Preview Mode
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                This page shows sample data. Full analytics integration is coming soon with real-time tracking of your exam performance, study hours, and personalized insights.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="mb-8">
          <StatsSummary />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <PerformanceBarChart />
          <ProgressLineChart />
        </div>

        {/* Full width chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ExamTypeDonut />
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white dark:bg-dark-card shadow rounded-lg p-6">
            <h3 className="font-headline text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Recent Activity
            </h3>
            <div className="space-y-4">
              {[
                { date: 'Feb 8, 2026', exam: 'Clinical Skills Mock #2', score: 88, status: 'Completed' },
                { date: 'Feb 5, 2026', exam: 'Situational Judgment #3', score: 79, status: 'Completed' },
                { date: 'Feb 1, 2026', exam: 'Mini-mock Session', score: 91, status: 'Completed' },
                { date: 'Jan 28, 2026', exam: 'Mock Discussion', score: null, status: 'Attended' },
                { date: 'Jan 25, 2026', exam: 'Clinical Skills Mock #1', score: 85, status: 'Completed' },
              ].map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {activity.exam}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {activity.date}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {activity.score !== null ? (
                      <span className={`text-lg font-semibold ${
                        activity.score >= 80
                          ? 'text-green-600 dark:text-green-400'
                          : activity.score >= 60
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}>
                        {activity.score}%
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                        {activity.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">
              * Sample activity data
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProgress;
