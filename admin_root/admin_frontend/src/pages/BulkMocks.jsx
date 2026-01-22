import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { bulkMockExamsApi } from '../services/adminApi';

/**
 * Bulk Mocks Page
 *
 * Allows admins to create multiple mock exams by uploading a CSV file.
 * Features a two-step flow:
 * 1. Preview & Validate - Shows valid vs invalid rows before creation
 * 2. Create Exams - Only creates valid rows, reports all errors
 *
 * Required columns: mock_type, exam_date, capacity, location, start_time, end_time
 * Optional columns: mock_set, is_active, scheduled_activation_datetime
 */

// Constants
const MAX_ROWS = 50;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Column definitions with examples and descriptions
const REQUIRED_COLUMNS = [
  {
    name: 'mock_type',
    description: 'Type of mock exam',
    example: 'Situational Judgment',
    validValues: ['Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion'],
    aliases: 'SJ, CS, Mini, MD'
  },
  {
    name: 'exam_date',
    description: 'Date of the exam',
    example: '2026-03-15',
    format: 'YYYY-MM-DD'
  },
  {
    name: 'capacity',
    description: 'Maximum number of students',
    example: '12',
    format: 'Number 1-100'
  },
  {
    name: 'location',
    description: 'Exam location',
    example: 'Mississauga',
    validValues: ['Mississauga', 'Mississauga - B9', 'Mississauga - Lab D', 'Calgary', 'Vancouver', 'Montreal', 'Richmond Hill', 'Online']
  },
  {
    name: 'start_time',
    description: 'Exam start time',
    example: '09:00',
    format: 'HH:MM (24-hour)'
  },
  {
    name: 'end_time',
    description: 'Exam end time',
    example: '12:00',
    format: 'HH:MM (24-hour)'
  }
];

const OPTIONAL_COLUMNS = [
  {
    name: 'mock_set',
    description: 'Set identifier (not for Mini-mock)',
    example: 'A',
    validValues: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    note: 'Leave empty for Mini-mock exams'
  },
  {
    name: 'is_active',
    description: 'Exam status',
    example: 'true',
    validValues: ['true', 'false', 'scheduled'],
    default: 'true'
  },
  {
    name: 'scheduled_activation_datetime',
    description: 'When to activate (if scheduled)',
    example: '2026-03-10T09:00:00Z',
    format: 'ISO datetime',
    note: 'Required if is_active is "scheduled"'
  }
];

const BulkMocks = () => {
  // State
  const [importState, setImportState] = useState('idle'); // idle, parsing, previewing, processing, success, error
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [createResult, setCreateResult] = useState(null);
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

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
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
    const requiredHeaders = ['mock_type', 'exam_date', 'capacity', 'location', 'start_time', 'end_time'];
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
    setValidationResult(null);
    setCreateResult(null);

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
   * Validate and preview the CSV data
   */
  const handleValidatePreview = async () => {
    if (!parsedData?.rawContent) {
      toast.error('No file selected');
      return;
    }

    setImportState('previewing');

    try {
      const response = await bulkMockExamsApi.previewFromCSV(parsedData.rawContent);
      setValidationResult(response);
      setImportState('idle');

      // Auto-download error CSV if there are invalid rows
      if (response.invalid_rows && response.invalid_rows.length > 0) {
        downloadErrorReport(response.invalid_rows);
        toast.error(
          `${response.summary.invalid_count} row(s) have errors - error report downloaded`,
          { duration: 5000 }
        );
      }

      // Show success toast for valid rows
      if (response.summary.valid_count > 0) {
        toast.success(`${response.summary.valid_count} row(s) ready to create`);
      } else {
        toast.error('No valid rows found. Please check the error report.');
      }

    } catch (error) {
      console.error('Validation error:', error);
      setImportState('error');
      toast.error(`Validation failed: ${error.message}`);
    }
  };

  /**
   * Create mock exams from validated data
   */
  const handleCreateExams = async () => {
    if (!parsedData?.rawContent) {
      toast.error('No file selected');
      return;
    }

    if (!validationResult || validationResult.summary.valid_count === 0) {
      toast.error('No valid rows to create');
      return;
    }

    setImportState('processing');

    try {
      const response = await bulkMockExamsApi.createFromCSV(parsedData.rawContent);
      setCreateResult(response);
      setImportState('success');

      // Show toast based on results
      if (response.summary.skipped === 0) {
        toast.success(`Successfully created ${response.summary.created} mock exams`);
      } else if (response.summary.created > 0) {
        toast.success(`Created ${response.summary.created} mock exams, ${response.summary.skipped} skipped`);
      } else {
        toast.error(`All rows failed to import`);
      }

    } catch (error) {
      console.error('Bulk import error:', error);
      setImportState('error');
      toast.error(`Import failed: ${error.message}`);
    }
  };

  /**
   * Download error report as CSV
   */
  const downloadErrorReport = (errors) => {
    const headers = ['row_number', 'mock_type', 'exam_date', 'capacity', 'location', 'start_time', 'end_time', 'mock_set', 'is_active', 'error_code', 'error_message'];
    const csvContent = [
      headers.join(','),
      ...errors.map(err => [
        err.row || '',
        err.mock_type || '',
        err.exam_date || '',
        err.capacity || '',
        err.location || '',
        err.start_time || '',
        err.end_time || '',
        err.mock_set || '',
        err.is_active || '',
        err.error_code || '',
        `"${(err.error_message || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-mocks-errors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Download sample CSV template
   */
  const downloadTemplate = () => {
    const template = `mock_type,exam_date,capacity,location,start_time,end_time,mock_set,is_active,scheduled_activation_datetime
Situational Judgment,2026-03-15,12,Mississauga,09:00,12:00,A,true,
Clinical Skills,2026-03-15,8,Calgary,13:00,16:00,B,true,
Mini-mock,2026-03-16,20,Vancouver,10:00,11:30,,true,
Mock Discussion,2026-03-17,6,Online,14:00,15:00,C,scheduled,2026-03-10T09:00:00Z`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-mocks-template.csv';
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
    setValidationResult(null);
    setCreateResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Go back to file preview (before validation)
   */
  const handleBackToFile = () => {
    setValidationResult(null);
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
        disabled={importState === 'processing' || importState === 'previewing'}
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
        disabled={importState === 'processing' || importState === 'previewing'}
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
   * Render file preview (before validation)
   */
  const renderFilePreview = () => (
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{selectedFile?.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {parsedData?.rowCount} rows to validate
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          disabled={importState === 'previewing'}
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

      {/* Validate button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleValidatePreview}
          disabled={importState === 'previewing'}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 disabled:opacity-50 flex items-center gap-2"
        >
          {importState === 'previewing' ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Validating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Validate & Preview
            </>
          )}
        </button>
      </div>
    </div>
  );

  /**
   * Render validation preview (after validation, before creation)
   */
  const renderValidationPreview = () => {
    const { valid_rows, invalid_rows, summary } = validationResult;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {summary.total_rows}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Rows</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {summary.valid_count}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Valid</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {summary.invalid_count}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Invalid</p>
          </div>
        </div>

        {/* Valid Rows Section */}
        {valid_rows.length > 0 && (
          <div className="bg-white dark:bg-dark-card border border-green-200 dark:border-green-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
              <h3 className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Valid Mock Exams ({valid_rows.length})
              </h3>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-dark-bg sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Row</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Time</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Location</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">Capacity</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">Set</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {valid_rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-hover">
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">#{row.row}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          row.mock_type === 'Situational Judgment' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                          row.mock_type === 'Clinical Skills' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' :
                          row.mock_type === 'Mini-mock' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200' :
                          'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200'
                        }`}>
                          {row.mock_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{formatDate(row.exam_date)}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.start_time} - {row.end_time}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.location}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {row.capacity}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-900 dark:text-gray-100">
                        {row.mock_set || '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          row.is_active === 'true' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                          row.is_active === 'scheduled' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {row.is_active === 'true' ? 'Active' : row.is_active === 'scheduled' ? 'Scheduled' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invalid Rows Notice */}
        {invalid_rows.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-800 dark:text-red-200">
                <span className="font-medium">{invalid_rows.length} row(s) have errors</span>
                <span className="text-red-600 dark:text-red-400"> — Error report has been downloaded automatically</span>
              </p>
            </div>
            <button
              onClick={() => downloadErrorReport(invalid_rows)}
              className="text-sm text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Again
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-dark-border">
          <button
            onClick={handleBackToFile}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to File
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateExams}
              disabled={summary.valid_count === 0 || importState === 'processing'}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importState === 'processing' ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create {summary.valid_count} Mock Exams
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

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
        Creating Mock Exams...
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Creating {validationResult?.summary?.valid_count || parsedData?.rowCount} mock exams
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-500">
        Please don't close this page
      </p>
    </div>
  );

  /**
   * Render success state
   */
  const renderSuccess = () => {
    const result = createResult;

    return (
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
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {result?.summary?.skipped || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Skipped</p>
          </div>
        </div>

        {/* Skipped rows notice */}
        {result?.skipped_rows && result.skipped_rows.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {result.skipped_rows.length} rows were skipped due to errors.
                </p>
                <button
                  onClick={() => downloadErrorReport(result.skipped_rows)}
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

        {/* Created exams list */}
        {result?.created_exams && result.created_exams.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Created Mock Exams ({result.created_exams.length})
            </h4>
            <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 max-h-40 overflow-y-auto">
              <div className="space-y-1">
                {result.created_exams.slice(0, 10).map((exam, idx) => (
                  <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">{exam.mock_type}</span>
                    <span className="text-gray-400">-</span>
                    <span>{formatDate(exam.exam_date)}</span>
                    <span className="text-gray-400">@</span>
                    <span>{exam.location}</span>
                    <span className="text-gray-400">({exam.start_time} - {exam.end_time})</span>
                  </div>
                ))}
                {result.created_exams.length > 10 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    ... and {result.created_exams.length - 10} more
                  </p>
                )}
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
  };

  /**
   * Render column reference section
   */
  const renderColumnReference = () => (
    <div className="mt-8 space-y-6">
      {/* Required Columns */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            REQUIRED
          </span>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Required Columns
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {REQUIRED_COLUMNS.map((col, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {col.name}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {col.description}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-500">Example:</span>
                  <code className="text-xs bg-gray-200 dark:bg-dark-hover px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                    {col.example}
                  </code>
                </div>
                {col.format && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-500">Format:</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{col.format}</span>
                  </div>
                )}
                {col.validValues && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-500">Valid values: </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {col.validValues.join(', ')}
                    </span>
                  </div>
                )}
                {col.aliases && (
                  <div className="mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-500">Aliases: </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{col.aliases}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional Columns */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            OPTIONAL
          </span>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Optional Columns
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {OPTIONAL_COLUMNS.map((col, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {col.name}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {col.description}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-500">Example:</span>
                  <code className="text-xs bg-gray-200 dark:bg-dark-hover px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                    {col.example}
                  </code>
                </div>
                {col.default && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-500">Default:</span>
                    <span className="text-xs text-green-600 dark:text-green-400">{col.default}</span>
                  </div>
                )}
                {col.validValues && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-500">Valid values: </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {col.validValues.join(', ')}
                    </span>
                  </div>
                )}
                {col.note && (
                  <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 italic">
                    Note: {col.note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional notes */}
      <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4">
        <p className="text-xs text-gray-500 dark:text-gray-500">
          <strong>Tips:</strong> Column headers are case-insensitive. Mock type and location accept flexible input (e.g., "SJ" for "Situational Judgment").
          Times must be in 24-hour format. Scheduled exams require a future activation datetime in ISO format.
        </p>
      </div>
    </div>
  );

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bulk Mocks Import
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Create multiple mock exams by uploading a CSV file. Rows are validated before creation.
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {/* Limit Warning Banner */}
        {importState !== 'success' && !validationResult && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">Limit:</span> Maximum of {MAX_ROWS} mock exams per import. For larger imports, please split into multiple files.
            </p>
          </div>
        )}

        {/* Upload Zone or File Preview or Validation Preview */}
        {importState === 'processing' ? (
          renderProcessing()
        ) : importState === 'success' ? (
          renderSuccess()
        ) : validationResult ? (
          renderValidationPreview()
        ) : parsedData ? (
          renderFilePreview()
        ) : (
          renderUploadZone()
        )}

        {/* Template Download */}
        {importState !== 'success' && !validationResult && (
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

        {/* Column Reference */}
        {importState !== 'success' && !validationResult && renderColumnReference()}
      </div>
    </div>
  );
};

export default BulkMocks;
