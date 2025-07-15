import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import '../styles/sidebarpanel.css';

export default function SidebarPanel({ isDarkMode, onDatePick, logs = [], visibleZones = [] }) {
  const today = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(() => localStorage.getItem('logStartDate') || today);
  const [endDate, setEndDate] = useState(() => localStorage.getItem('logEndDate') || today);

  const parseInputDate = (dateStr, isStart) => {
    if (!dateStr) return null;
    return isStart
      ? new Date(dateStr + 'T00:00:00')
      : new Date(dateStr + 'T23:59:59.999');
  };

  useEffect(() => {
    localStorage.setItem('logStartDate', startDate);
    localStorage.setItem('logEndDate', endDate);
    if (onDatePick) onDatePick(startDate, endDate);
  }, [startDate, endDate, onDatePick]);

  const resetDates = () => {
    setStartDate(today);
    setEndDate(today);
    localStorage.removeItem('logStartDate');
    localStorage.removeItem('logEndDate');
    if (onDatePick) onDatePick(today, today);
  };

  const downloadLogs = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates.');
      return;
    }
    const start = parseInputDate(startDate, true);
    const end = parseInputDate(endDate, false);
    if (start > end) {
      alert('Start date must be before end date.');
      return;
    }
    if (logs.length === 0) {
      alert('No logs available for the selected date range and zones.');
      return;
    }

    const csvRows = [
      ['Index', 'Timestamp', 'Message'],
      ...logs.map((log, index) => [index + 1, log.timestamp, `"${log.message}"`])
    ];
    const csvContent = csvRows.map(row => row.join(',')).join('\n');

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

  return (
    <div className={`sidebar-panel ${isDarkMode ? 'dark-panel' : 'light-panel'}`}>
      <div className="sidebar-inner">
        <div className="event-logs">
          <h2 className="log-title">Event Logs</h2>
          <div className="date-inputs">
            <label htmlFor="start-date">Start</label>
            <input
              id="start-date"
              type="date"
              min="1900-01-01"
              max={today}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={isDarkMode ? 'dark-input' : ''}
              style={{ marginBottom: '6px' }}
            />
            <label htmlFor="end-date">End</label>
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
              className={`download-logs-btn${isDarkMode ? ' dark-btn' : ''}`}
              onClick={downloadLogs}
            >
              <span
                className="download-icon"
                aria-hidden="true"
                style={{ marginRight: '6px', display: 'inline-flex', alignItems: 'center' }}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ display: 'block' }}>
                  <path
                    d="M10 3v9m0 0l-4-4m4 4l4-4m-9 7h10"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Download Logs
            </button>
          </div>
          <div
            className="logs-scroll-container"
            style={{ maxHeight: '340px', overflowY: 'auto', marginTop: '10px' }}
          >
            <div className="log-entries-list">
              {startDate && endDate ? (
                logs.length === 0 ? (
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
                )
              ) : (
                <div className="log-empty">Please select a start and end date to view logs.</div>
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
  logs: PropTypes.array,
  visibleZones: PropTypes.array
};
