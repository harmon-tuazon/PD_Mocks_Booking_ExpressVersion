import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { bulkBookingsApi } from '../services/adminApi';

/**
 * Bulk Bookings Page
 *
 * Allows admins to create multiple bookings by uploading a CSV file.
 * CSV requires only 3 columns: student_id, mock_exam_id, token_used
 * Missing properties are auto-filled from the database.
 */

// Constants
const MAX_ROWS = 500;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_TOKEN_TYPES = [
  'sj_credits',
  'cs_credits',
  'sjmini_credits',
  'mock_discussion_token',
  'shared_mock_credits'
];

const BulkBookings = () => {
  // State
  const [importState, setImportState] = useState('idle'); // idle, parsing, processing, success, error
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Refs
  const fileInputRef = useRef(null);

  /**
   * Parse CSV string into rows for preview
   */
  const parseCSVPreview = (csvText) => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      return { headers: [], rows: [], rowCount: 0 };
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < Math.min(lines.length, 6); i++) { // Preview first 5 rows
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      rows.push(row);
    }

    return { headers, rows, rowCount: lines.length - 1 };
  };

  /**
   * Validate CSV structure
   */
  const validateCSV = (headers, rowCount) => {
    const errors = [];
    const requiredHeaders = ['student_id', 'mock_exam_id', 'token_used'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      errors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    if (rowCount === 0) {
      errors.push('CSV file contains no data rows');
    }

    if (rowCount > MAX_ROWS) {
      errors.push(`CSV exceeds maximum of ${MAX_ROWS} rows. Got ${rowCount} rows.`);
    }

    return errors;
  };

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel', ''];
    const isCSV = file.name.endsWith('.csv') || validTypes.includes(file.type);

    if (!isCSV) {
      toast.error('Invalid file type. Please upload a CSV file.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB allowed.`);
      return;
    }

    setSelectedFile(file);
    setImportState('parsing');

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      const { headers, rows, rowCount } = parseCSVPreview(content);

      // Validate
      const validationErrors = validateCSV(headers, rowCount);
      if (validationErrors.length > 0) {
        toast.error(validationErrors[0]);
        setImportState('idle');
        setSelectedFile(null);
        return;
      }

      setParsedData({ headers, previewRows: rows, rowCount, rawContent: content });
      setImportState('idle');
    };

    reader.onerror = () => {
      toast.error('Failed to read file');
      setImportState('idle');
      setSelectedFile(null);
    };

    reader.readAsText(file);
  }, []);

  /**
   * Handle drag events
   */
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  /**
   * Handle file drop
   */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  /**
   * Process the upload
   */
  const handleUpload = async () => {
    if (!parsedData?.rawContent) {
      toast.error('No file selected');
      return;
    }

    setImportState('processing');

    try {
      const response = await bulkBookingsApi.createFromCSV(parsedData.rawContent);

      setResult(response);
      setImportState('success');

      // Show toast based on results
      if (response.summary.errors === 0) {
        toast.success(`Successfully created ${response.summary.created} bookings`);
      } else if (response.summary.created > 0) {
        toast.success(`Created ${response.summary.created} bookings with ${response.summary.errors} errors`);
      } else {
        toast.error(`All ${response.summary.errors} rows failed to import`);
      }

      // Auto-download error report if there are errors
      if (response.errors && response.errors.length > 0) {
        downloadErrorReport(response.errors);
      }

    } catch (error) {
      console.error('Bulk import error:', error);
      setImportState('error');

      // Handle different error types
      const errorMessage = error.message || 'Failed to process bulk bookings';
      toast.error(`Import failed: ${errorMessage}`);
    }
  };

  /**
   * Download error report as CSV
   */
  const downloadErrorReport = (errors) => {
    const headers = ['row_number', 'student_id', 'mock_exam_id', 'token_used', 'error_code', 'error_message'];
    const csvContent = [
      headers.join(','),
      ...errors.map(err => [
        err.row || '',
        err.student_id || '',
        err.mock_exam_id || '',
        err.token_used || '',
        err.error_code || '',
        `"${(err.error_message || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-bookings-errors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Download sample CSV template
   */
  const downloadTemplate = () => {
    const template = `student_id,mock_exam_id,token_used
PREP001,123456789,sj_credits
PREP002,123456789,shared_mock_credits
PREP003,987654321,cs_credits`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-bookings-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Reset to initial state
   */
  const handleReset = () => {
    setImportState('idle');
    setSelectedFile(null);
    setParsedData(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Render upload zone
   */
  const renderUploadZone = () => (
    <div
      className={`
        border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
        ${dragActive
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-300 dark:border-dark-border hover:border-gray-400 dark:hover:border-gray-500'
        }
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={importState === 'processing'}
      />

      <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-dark-hover rounded-full flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-2">
        Drag and drop your CSV file here
      </p>
      <p className="text-gray-500 dark:text-gray-500 text-sm mb-4">
        or
      </p>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={importState === 'processing'}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 disabled:opacity-50"
      >
        Browse Files
      </button>

      <p className="text-gray-400 dark:text-gray-500 text-xs mt-4">
        Accepted format: .csv (max {MAX_ROWS} rows)
      </p>
    </div>
  );

  /**
   * Render file preview
   */
  const renderFilePreview = () => (
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{selectedFile?.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {parsedData?.rowCount} rows to import
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          disabled={importState === 'processing'}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Preview table */}
      {parsedData?.previewRows && parsedData.previewRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-dark-border">
                {parsedData.headers.map((header, idx) => (
                  <th key={idx} className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsedData.previewRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b border-gray-100 dark:border-dark-border/50">
                  {parsedData.headers.map((header, colIdx) => (
                    <td key={colIdx} className="px-3 py-2 text-gray-900 dark:text-gray-100">
                      {row[header] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {parsedData.rowCount > 5 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
              Showing 5 of {parsedData.rowCount} rows
            </p>
          )}
        </div>
      )}

      {/* Upload button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleUpload}
          disabled={importState === 'processing'}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 disabled:opacity-50 flex items-center gap-2"
        >
          {importState === 'processing' ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import {parsedData?.rowCount} Bookings
            </>
          )}
        </button>
      </div>
    </div>
  );

  /**
   * Render processing state
   */
  const renderProcessing = () => (
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-12 text-center">
      <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-6">
        <svg className="animate-spin h-8 w-8 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Processing...
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Creating {parsedData?.rowCount} bookings
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-500">
        Please don't close this page
      </p>
    </div>
  );

  /**
   * Render success state
   */
  const renderSuccess = () => (
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Import Completed
        </h3>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {result?.summary?.total_rows || 0}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {result?.summary?.created || 0}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {result?.summary?.errors || 0}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Errors</p>
        </div>
      </div>

      {/* Error notice */}
      {result?.errors && result.errors.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {result.errors.length} rows had errors and were not imported.
              </p>
              <button
                onClick={() => downloadErrorReport(result.errors)}
                className="text-sm text-amber-600 dark:text-amber-400 hover:underline mt-1 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Error Report (CSV)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="text-center">
        <button
          onClick={handleReset}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
        >
          Import Another File
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bulk Bookings Import
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Create multiple bookings by uploading a CSV file.
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto">
        {/* Upload Zone or File Preview */}
        {importState === 'processing' ? (
          renderProcessing()
        ) : importState === 'success' ? (
          renderSuccess()
        ) : parsedData ? (
          renderFilePreview()
        ) : (
          renderUploadZone()
        )}

        {/* Template Download */}
        {importState !== 'success' && (
          <div className="mt-6">
            <button
              onClick={downloadTemplate}
              className="text-primary-600 dark:text-primary-400 hover:underline text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Sample CSV Template
            </button>
          </div>
        )}

        {/* Instructions */}
        {importState !== 'success' && (
          <div className="mt-8 bg-gray-50 dark:bg-dark-bg rounded-lg p-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
              Required Columns
            </h3>
            <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="font-mono bg-gray-200 dark:bg-dark-card px-2 py-0.5 rounded text-xs">student_id</span>
                <span>Student's ID (e.g., "PREP001")</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono bg-gray-200 dark:bg-dark-card px-2 py-0.5 rounded text-xs">mock_exam_id</span>
                <span>HubSpot mock exam ID (numeric)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono bg-gray-200 dark:bg-dark-card px-2 py-0.5 rounded text-xs">token_used</span>
                <span>Credit type: {VALID_TOKEN_TYPES.join(', ')}</span>
              </li>
            </ul>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                All other booking properties (name, email, exam date, etc.) will be automatically filled from the database.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkBookings;
