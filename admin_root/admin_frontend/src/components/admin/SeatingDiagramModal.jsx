/**
 * SeatingDiagramModal Component
 * Renders a visual seating chart of work check bookings organized by student group,
 * styled to match the NDECC seating arrangement format.
 * Supports date/session filtering and PDF download via jsPDF.
 */

import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import jsPDF from 'jspdf';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { workCheckBookingsApi } from '../../services/adminApi';

// ─── Logo URL (same as navbar) ───
const LOGO_URL = 'https://46814382.fs1.hubspotusercontent-na1.net/hubfs/46814382/logo%20dark%20blue.png';

// ─── Color palette (matching NDECC reference) ───
const COLORS = {
  canvasBg: '#163B4E',
  titleText: '#E8634F',
  dividerLine: '#4A7A8A',
  instructorText: '#FFFFFF',
  groupHeaderBg: '#E8634F',
  groupHeaderText: '#FFFFFF',
  cellBg: '#FFFFFF',
  cellBorder: '#C8D6DB',
  cellTimeText: '#333333',
  cellNameText: '#333333',
};

// ─── Canvas layout constants ───
const CONFIG = {
  CANVAS_WIDTH: 1920,       // Fixed width — never changes regardless of group count
  MIN_HEIGHT: 700,          // Minimum canvas height for consistent sizing
  HEADER_HEIGHT: 110,       // Space for logo + title
  LOGO_HEIGHT: 65,          // Rendered logo height
  GROUP_HEADER_HEIGHT: 36,  // Coral "TIME | GROUP X MORNING" bar
  ROW_HEIGHT: 40,           // Each time-slot row
  COLUMN_GAP: 14,           // Gap between group columns
  INSTRUCTOR_LABEL_HEIGHT: 38, // Space for instructor name above column
  SESSION_GAP: 28,          // Gap between MORNING and AFTERNOON sections
  PADDING: 40,              // Canvas edge padding
  TIME_COL_WIDTH: 70,       // Width of the TIME sub-column
  BORDER_RADIUS: 20,        // Rounded corners on the chart
};

/** Load an image from URL, returns a promise */
const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Failed to load image'));
  img.src = url;
});

/** Draw a rounded rectangle path */
const drawRoundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

/** Format date string as "20th February" style */
const formatDateForTitle = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDate();
  const suffix = [, 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10) * (day % 10)] || 'th';
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  return `${day}${suffix} ${month}`;
};

/** Truncate long names with ellipsis */
const truncateName = (name, maxLen = 24) => {
  if (!name || name.length <= maxLen) return name || '';
  return name.substring(0, maxLen - 1) + '\u2026';
};

/** Get today as YYYY-MM-DD */
const getTodayString = () => new Date().toISOString().split('T')[0];

const SeatingDiagramModal = ({ isOpen, onClose }) => {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [sessionFilter, setSessionFilter] = useState('BOTH');
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const logoRef = useRef(null);

  // Pre-load logo when modal opens
  useEffect(() => {
    if (isOpen && !logoRef.current) {
      loadImage(LOGO_URL)
        .then(img => { logoRef.current = img; })
        .catch(() => { logoRef.current = null; });
    }
  }, [isOpen]);

  /** Fetch data then render the canvas — only fires on button click */
  const generateDiagram = useCallback(async () => {
    if (!selectedDate) return;

    setGenerating(true);
    setError(null);
    setImageDataUrl(null);

    try {
      const result = await workCheckBookingsApi.getDiagramData(selectedDate);

      if (!result?.data?.groups || result.data.groups.length === 0) {
        setError('No bookings found for this date.');
        return;
      }

      const { groups, slot_times } = result.data;

      // Filter groups based on session selection
      const filteredGroups = groups
        .map(group => ({
          ...group,
          bookings: {
            AM: sessionFilter === 'PM' ? [] : group.bookings.AM,
            PM: sessionFilter === 'AM' ? [] : group.bookings.PM,
          },
        }))
        .filter(g => g.bookings.AM.length > 0 || g.bookings.PM.length > 0);

      if (filteredGroups.length === 0) {
        setError('No bookings found for the selected session.');
        return;
      }

      // Master time lists (ALL slot times for the date, always displayed)
      const amTimes = sessionFilter === 'PM' ? [] : (slot_times?.AM || []);
      const pmTimes = sessionFilter === 'AM' ? [] : (slot_times?.PM || []);

      // Row count = master time list length (every slot is always shown)
      const maxAM = Math.max(amTimes.length, ...filteredGroups.map(g => g.bookings.AM.length));
      const maxPM = Math.max(pmTimes.length, ...filteredGroups.map(g => g.bookings.PM.length));

      const showAM = sessionFilter !== 'PM' && maxAM > 0;
      const showPM = sessionFilter !== 'AM' && maxPM > 0;

      // ─── Canvas dimensions (FIXED width, dynamic height) ───
      const canvasWidth = CONFIG.CANVAS_WIDTH;

      let contentHeight = CONFIG.PADDING + CONFIG.HEADER_HEIGHT + CONFIG.INSTRUCTOR_LABEL_HEIGHT;
      if (showAM) contentHeight += CONFIG.GROUP_HEADER_HEIGHT + maxAM * CONFIG.ROW_HEIGHT;
      if (showAM && showPM) contentHeight += CONFIG.SESSION_GAP;
      if (showPM) contentHeight += CONFIG.GROUP_HEADER_HEIGHT + maxPM * CONFIG.ROW_HEIGHT;
      contentHeight += CONFIG.PADDING;

      const canvasHeight = Math.max(contentHeight, CONFIG.MIN_HEIGHT);

      // ─── Set up canvas ───
      const canvas = canvasRef.current;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');

      // 1. Rounded rectangle background
      drawRoundedRect(ctx, 0, 0, canvasWidth, canvasHeight, CONFIG.BORDER_RADIUS);
      ctx.fillStyle = COLORS.canvasBg;
      ctx.fill();
      ctx.save();
      ctx.clip(); // Clip all drawing to the rounded shape

      // 2. Header — Logo image with white background
      const headerY = CONFIG.PADDING;
      const logoImg = logoRef.current;

      if (logoImg) {
        const lh = CONFIG.LOGO_HEIGHT;
        const lw = logoImg.width * (lh / logoImg.height);
        const logoPad = 8;
        // White rounded rectangle behind the logo so it's visible on dark bg
        ctx.fillStyle = '#FFFFFF';
        drawRoundedRect(ctx, CONFIG.PADDING - logoPad, headerY + 5 - logoPad, lw + logoPad * 2, lh + logoPad * 2, 10);
        ctx.fill();
        ctx.drawImage(logoImg, CONFIG.PADDING, headerY + 5, lw, lh);
      } else {
        // Text fallback if logo failed to load
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('PrepDoctors', CONFIG.PADDING, headerY + 15);
      }

      // 3. Header — Title (centered, large coral text)
      ctx.fillStyle = COLORS.titleText;
      ctx.font = 'bold 40px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `NDECC CLINICAL SKILLS - WORKCHECK - ${formatDateForTitle(selectedDate)}`,
        canvasWidth / 2 + 60, // Offset slightly right to balance with logo
        headerY + CONFIG.LOGO_HEIGHT / 2 + 5
      );

      // 4. Dashed divider line
      const dividerY = headerY + CONFIG.HEADER_HEIGHT - 10;
      ctx.strokeStyle = COLORS.dividerLine;
      ctx.setLineDash([10, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CONFIG.PADDING, dividerY);
      ctx.lineTo(canvasWidth - CONFIG.PADDING, dividerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 5. Column widths — evenly distributed across FULL fixed width
      const numGroups = filteredGroups.length;
      const totalGaps = (numGroups - 1) * CONFIG.COLUMN_GAP;
      const availableWidth = canvasWidth - CONFIG.PADDING * 2 - totalGaps;
      const colWidth = Math.floor(availableWidth / numGroups);
      const nameColWidth = colWidth - CONFIG.TIME_COL_WIDTH;

      // Adaptive text truncation based on column width
      const maxNameChars = Math.max(18, Math.floor(nameColWidth / 9));

      // 6. Draw each group column
      const contentStartY = dividerY + 12;

      filteredGroups.forEach((group, colIndex) => {
        const colX = CONFIG.PADDING + colIndex * (colWidth + CONFIG.COLUMN_GAP);
        let curY = contentStartY;

        // ─── Instructor name (white, bold, centered above column) ───
        ctx.fillStyle = COLORS.instructorText;
        ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          (group.instructor_name || '').toUpperCase(),
          colX + colWidth / 2,
          curY + CONFIG.INSTRUCTOR_LABEL_HEIGHT / 2
        );
        curY += CONFIG.INSTRUCTOR_LABEL_HEIGHT;

        // Build booking lookup: slot_time → student_name
        const amLookup = {};
        for (const b of group.bookings.AM) amLookup[b.slot_time] = b.student_name;
        const pmLookup = {};
        for (const b of group.bookings.PM) pmLookup[b.slot_time] = b.student_name;

        // ─── Helper: draw a session section (MORNING or AFTERNOON) ───
        const drawSession = (sessionLabel, masterTimes, lookup, maxRows) => {
          // Coral header bar
          ctx.fillStyle = COLORS.groupHeaderBg;
          ctx.fillRect(colX, curY, colWidth, CONFIG.GROUP_HEADER_HEIGHT);

          // Header text: "TIME" on the left, "GROUP NAME SESSION" on the right
          ctx.fillStyle = COLORS.groupHeaderText;
          ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const headerCenterY = curY + CONFIG.GROUP_HEADER_HEIGHT / 2;
          ctx.fillText('TIME', colX + 10, headerCenterY);
          ctx.fillText(
            `${group.group_name.toUpperCase()} ${sessionLabel}`,
            colX + CONFIG.TIME_COL_WIDTH + 10,
            headerCenterY
          );

          curY += CONFIG.GROUP_HEADER_HEIGHT;

          // Rows — always use master time list so all slots are displayed
          const rowTimes = masterTimes.length > 0 ? masterTimes : Object.keys(lookup).sort();
          const totalRows = Math.max(rowTimes.length, maxRows);

          for (let i = 0; i < totalRows; i++) {
            const rowY = curY + i * CONFIG.ROW_HEIGHT;
            const time = rowTimes[i] || '';
            const name = time ? (lookup[time] || '') : '';

            // Time cell
            ctx.fillStyle = COLORS.cellBg;
            ctx.fillRect(colX, rowY, CONFIG.TIME_COL_WIDTH, CONFIG.ROW_HEIGHT);
            ctx.strokeStyle = COLORS.cellBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(colX, rowY, CONFIG.TIME_COL_WIDTH, CONFIG.ROW_HEIGHT);

            if (time) {
              ctx.fillStyle = COLORS.cellTimeText;
              ctx.font = '14px "Segoe UI", Arial, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(time, colX + CONFIG.TIME_COL_WIDTH / 2, rowY + CONFIG.ROW_HEIGHT / 2);
            }

            // Name cell
            ctx.fillStyle = COLORS.cellBg;
            ctx.fillRect(colX + CONFIG.TIME_COL_WIDTH, rowY, nameColWidth, CONFIG.ROW_HEIGHT);
            ctx.strokeStyle = COLORS.cellBorder;
            ctx.strokeRect(colX + CONFIG.TIME_COL_WIDTH, rowY, nameColWidth, CONFIG.ROW_HEIGHT);

            if (name) {
              ctx.fillStyle = COLORS.cellNameText;
              ctx.font = '14px "Segoe UI", Arial, sans-serif';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(
                truncateName(name, maxNameChars),
                colX + CONFIG.TIME_COL_WIDTH + 10,
                rowY + CONFIG.ROW_HEIGHT / 2
              );
            }
          }

          curY += totalRows * CONFIG.ROW_HEIGHT;
        };

        if (showAM) {
          drawSession('MORNING', amTimes, amLookup, maxAM);
        }
        if (showAM && showPM) {
          curY += CONFIG.SESSION_GAP;
        }
        if (showPM) {
          drawSession('AFTERNOON', pmTimes, pmLookup, maxPM);
        }
      });

      ctx.restore(); // Release clip

      // Convert canvas to data URL for preview
      setImageDataUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error('Diagram generation error:', err);
      setError(err.message || 'Failed to generate diagram');
    } finally {
      setGenerating(false);
    }
  }, [sessionFilter, selectedDate]);

  /** Download the current diagram as a PDF */
  const downloadPDF = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

    const sessionLabel = sessionFilter === 'BOTH' ? 'All' : sessionFilter;
    pdf.save(`Seating_Diagram_${sessionLabel}_${selectedDate}.pdf`);
  }, [sessionFilter, selectedDate]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-lg bg-white dark:bg-dark-card shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Seating Diagram
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4 space-y-4">
                  {/* Controls row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="min-w-[180px]">
                      <DatePicker
                        value={selectedDate}
                        onChange={(value) => {
                          setSelectedDate(value);
                          setImageDataUrl(null);
                          setError(null);
                        }}
                        placeholder="Select Date"
                        className="w-full"
                      />
                    </div>

                    <div className="min-w-[140px]">
                      <Select
                        value={sessionFilter}
                        onValueChange={(value) => {
                          setSessionFilter(value);
                          setImageDataUrl(null);
                          setError(null);
                        }}
                      >
                        <SelectTrigger title="Session">
                          <SelectValue placeholder="Session" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BOTH">Both</SelectItem>
                          <SelectItem value="AM">Morning</SelectItem>
                          <SelectItem value="PM">Afternoon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Error / info message */}
                  {error && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-blue-800 dark:text-blue-300 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Canvas preview */}
                  {imageDataUrl && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto max-h-[60vh]">
                      <img
                        src={imageDataUrl}
                        alt="Seating Diagram"
                        className="w-full h-auto"
                      />
                    </div>
                  )}

                  {/* Hidden offscreen canvas */}
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  {imageDataUrl && (
                    <button
                      onClick={downloadPDF}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200"
                    >
                      Download PDF
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                  >
                    Close
                  </button>
                  <button
                    onClick={generateDiagram}
                    disabled={!selectedDate || generating}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {generating ? 'Generating...' : 'Generate Diagram'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SeatingDiagramModal;
