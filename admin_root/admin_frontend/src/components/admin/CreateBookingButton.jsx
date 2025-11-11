/**
 * CreateBookingButton Component
 * Trigger button for admin booking creation modal
 *
 * Features:
 * - Positioned in mock exam details header (right-aligned)
 * - Opens CreateBookingModal when clicked
 * - Disabled if mock exam is inactive
 * - Visual feedback on hover/disabled states
 */

import React, { useState } from 'react';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import CreateBookingModal from './CreateBookingModal';

const CreateBookingButton = ({ mockExam, onSuccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debug: Log mockExam data to understand the structure
  React.useEffect(() => {
    if (mockExam) {
      console.log('[CreateBookingButton] Mock Exam Data:', {
        id: mockExam.id,
        is_active: mockExam.is_active,
        is_active_type: typeof mockExam.is_active,
        mock_type: mockExam.mock_type,
        full_data: mockExam
      });
    }
  }, [mockExam]);

  // Disable button if mock exam is not loaded or is inactive
  // Handle both string 'true' and boolean true for is_active
  const isDisabled = !mockExam ||
    (mockExam.is_active !== 'true' && mockExam.is_active !== true);

  const handleOpenModal = () => {
    if (!isDisabled) {
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSuccess = (bookingData) => {
    setIsModalOpen(false);
    if (onSuccess) {
      onSuccess(bookingData);
    }
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={isDisabled}
        className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors shadow-sm ${
          isDisabled
            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-50'
            : 'bg-primary-600 hover:bg-primary-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
        }`}
        title={isDisabled ? 'Cannot create booking for inactive mock exam' : 'Create booking for a trainee'}
      >
        <PlusCircleIcon className="h-5 w-5 mr-2" />
        Create Booking
      </button>

      {/* Create Booking Modal */}
      {isModalOpen && (
        <CreateBookingModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          mockExam={mockExam}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
};

export default CreateBookingButton;
