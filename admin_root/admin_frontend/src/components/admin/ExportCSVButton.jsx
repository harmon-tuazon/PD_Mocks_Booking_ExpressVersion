import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';

/**
 * ExportCSVButton - Export bookings to CSV file
 *
 * Sends existing booking data to backend for CSV generation.
 * No additional fetch required - uses data already loaded in frontend.
 */
function ExportCSVButton({ bookings, examId, disabled }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (disabled || isExporting || !bookings?.length) return;

    setIsExporting(true);
    try {
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/mock-exams/export-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookings,
          examId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Export failed');
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with date
      const date = new Date().toISOString().split('T')[0];
      link.download = `bookings-exam-${examId}-${date}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${bookings.length} bookings to CSV`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(error.message || 'Failed to export bookings. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || isExporting}
      variant="outline"
      size="sm"
      title={disabled ? 'No bookings to export' : 'Export bookings to CSV'}
    >
      {isExporting ? (
        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Export CSV
    </Button>
  );
}

export default ExportCSVButton;
