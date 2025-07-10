// src/components/SidebarPanel.js

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import '../styles/sidebarpanel.css';

export default function SidebarPanel({ isDarkMode, onDatePick, logs = [] }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Today's date in YYYY-MM-DD format to limit date inputs
  const today = new Date().toISOString().slice(0, 10);

  // Convert date input string (YYYY-MM-DD) to Date object at start or end of day
  const parseInputDate = (dateStr, isStart) => {
    if (!dateStr) return null;
    return isStart
      ? new Date(dateStr + 'T00:00:00')
      : new Date(dateStr + 'T23:59:59');
  };

  // Reset date inputs and notify parent
  const resetDates = () => {
    setStartDate('');
    setEndDate('');
    if (onDatePick) onDatePick('', '');
  };

  // Download filtered logs as CSV
  const downloadLogs = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates.');
      resetDates();
      return;
    }
    const start = parseInputDate(startDate, true);
    const end = parseInputDate(endDate, false);

    if (start > end) {
      alert('Start date must be before end date.');
      resetDates();
      return;
    }

    // Filter logs by date range using timestamp comparison for accuracy
    const filteredLogs = logs.filter(log => {
      const logDateMs = Date.parse(log.timestamp);
      const startMs = start.getTime();
      const endMs = end.getTime();
      return logDateMs >= startMs && logDateMs <= endMs;
    });

    if (filteredLogs.length === 0) {
      alert('No logs available for the selected date range.');
      resetDates();
      return;
    }

    // Convert filtered logs to CSV string
    const csvRows = [
      ['Index', 'Timestamp', 'Message'],
      ...filteredLogs.map((log, index) => [index + 1, log.timestamp, `"${log.message}"`])
    ];
    const csvContent = csvRows.map(e => e.join(',')).join('\n');

    // Create a blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `event_logs_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Notify parent when dates change
  useEffect(() => {
    if (onDatePick) onDatePick(startDate, endDate);
  }, [startDate, endDate, onDatePick]);

  return (
    <div className={`sidebar-panel ${isDarkMode ? 'dark-panel' : 'light-panel'}`}>
      <div className="sidebar-inner">
        <div className="event-logs">
          <h2 className="log-title">Event Logs</h2>

          <div className="date-inputs">
            <label htmlFor="start-date">Start Date</label>
            <input
              id="start-date"
              type="date"
              min="1900-01-01"
              max={today}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={isDarkMode ? 'dark-input' : ''}
            />

            <label htmlFor="end-date">End Date</label>
            <input
              id="end-date"
              type="date"
              min="1900-01-01"
              max={today}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={isDarkMode ? 'dark-input' : ''}
            />
          </div>

          <div className="log-buttons">
            <button
              className={isDarkMode ? 'dark-button' : ''}
              onClick={downloadLogs}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                fill="currentColor"
                viewBox="0 0 16 16"
                style={{ marginRight: '8px' }}
                aria-hidden="true"
                focusable="false"
              >
                <path d="M.5 9.9v3.6A1.5 1.5 0 0 0 2 15h12a1.5 1.5 0 0 0 1.5-1.5v-3.6h-1v3.6a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5v-3.6h-1z" />
                <path fillRule="evenodd" d="M7.646 12.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 11.293V1.5a.5.5 0 0 0-1 0v9.793L5.354 9.146a.5.5 0 1 0-.708.708l3 3z" />
              </svg>
              Download Logs
            </button>
          </div>

          {/* Scroll container for logs */}
          <div
            className="logs-scroll-container"
            style={{ maxHeight: '400px', overflowY: 'auto' }}
          >
            <div className="log-entries-list">
              {logs.length === 0 ? (
                <div className="log-empty">No logs available.</div>
              ) : (
                logs.map((log, index) => (
                  <div className="log-entry" key={index}>
                    <div className="log-index">{index + 1}.</div>
                    <div className="log-text">
                      <div className="log-timestamp">{log.timestamp}</div>
                      <div className="log-message">{log.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

SidebarPanel.propTypes = {
  isDarkMode: PropTypes.bool,
  onDatePick: PropTypes.func,
  logs: PropTypes.array
};
