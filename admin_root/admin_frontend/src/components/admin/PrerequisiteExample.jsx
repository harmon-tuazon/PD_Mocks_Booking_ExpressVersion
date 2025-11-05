/**
 * Example component demonstrating PrerequisiteExamSelector and PrerequisiteExamsList
 * with dark mode support
 */

import React, { useState } from 'react';
import PrerequisiteExamSelector from './PrerequisiteExamSelector';
import PrerequisiteExamsList from './PrerequisiteExamsList';
import { Label } from '@/components/ui/label';

const PrerequisiteExample = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(['18440533951', '18440533952']);

  // Mock data for demonstration
  const mockExamId = '18440533960';
  const discussionExamDate = '2026-01-15';

  // Mock exam details for display
  const mockPrerequisiteDetails = [
    {
      id: '18440533951',
      mock_type: 'Clinical Skills',
      exam_date: '2025-12-15',
      start_time: '1734271200000',
      end_time: '1734303600000',
      location: 'Mississauga',
      capacity: 15,
      total_bookings: 8
    },
    {
      id: '18440533952',
      mock_type: 'Situational Judgment',
      exam_date: '2025-12-20',
      start_time: '1734685200000',
      end_time: '1734696000000',
      location: 'Vancouver',
      capacity: 20,
      total_bookings: 12
    }
  ];

  // Filter to show only selected prerequisites
  const selectedPrerequisites = mockPrerequisiteDetails.filter(
    exam => selectedIds.includes(exam.id)
  );

  return (
    <div className="space-y-8 p-8">
      {/* Demo Controls */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Component Demonstration
        </h3>
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <p>Toggle between edit and view modes to see both components.</p>
          <p>Dark mode is fully supported with proper color schemes.</p>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          {isEditing ? 'Switch to View Mode' : 'Switch to Edit Mode'}
        </button>
      </div>

      {/* Component Section */}
      <div className="bg-white dark:bg-dark-card shadow-sm dark:shadow-gray-900/50 rounded-lg p-6">
        <div className="col-span-2">
          <Label htmlFor="prerequisite-exams" className="text-gray-700 dark:text-gray-300">
            Prerequisite Exams (Optional)
          </Label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Select Clinical Skills or Situational Judgment exams that trainees must attend before this discussion
          </p>

          {isEditing ? (
            <PrerequisiteExamSelector
              mockExamId={mockExamId}
              discussionExamDate={discussionExamDate}
              currentAssociations={selectedIds}
              onChange={(newIds) => {
                console.log('Selected IDs changed:', newIds);
                setSelectedIds(newIds);
              }}
              disabled={false}
            />
          ) : (
            <PrerequisiteExamsList exams={selectedPrerequisites} />
          )}
        </div>
      </div>

      {/* Dark Mode Test Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Light Mode Preview */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h4 className="font-semibold text-gray-900 mb-4">Light Mode</h4>
          <div className="space-y-3">
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Clinical Skills
            </div>
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2">
              Situational Judgment
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Components adapt to light theme with proper contrast
            </p>
          </div>
        </div>

        {/* Dark Mode Preview */}
        <div className="bg-gray-900 rounded-lg p-6 shadow-sm">
          <h4 className="font-semibold text-gray-100 mb-4">Dark Mode</h4>
          <div className="space-y-3">
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-300">
              Clinical Skills
            </div>
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300 ml-2">
              Situational Judgment
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Components adapt to dark theme with proper contrast
            </p>
          </div>
        </div>
      </div>

      {/* Component Features */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Component Features
        </h4>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex items-start">
            <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
            <span>Multi-select checklist with search functionality</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
            <span>Debounced search (300ms) for smooth filtering</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
            <span>Displays exam type, location, date, and time</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
            <span>Shows selection count and booking capacity</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
            <span>Loading skeletons and error states</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
            <span>Full keyboard navigation support (Tab, Enter, Space)</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
            <span>ARIA labels for accessibility</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
            <span>Click to navigate to exam details in view mode</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default PrerequisiteExample;