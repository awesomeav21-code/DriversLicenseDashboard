// src/components/SidebarPanel.js

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../styles/sidebarpanel.css';

export default function SidebarPanel({ isDarkMode, onDatePick }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const logs = [
    {
      timestamp: 'Jun 19, 2025 09:28 AM',
      message: 'Temperature alarm – Right Camera – Zone Area2'
    },
    {
      timestamp: 'Jun 19, 2025 09:26 AM',
      message: 'Temperature alarm – Left Camera – Zone XMER1'
    },
    {
      timestamp: 'Jun 19, 2025 09:14 AM',
      message: 'Temperature alarm – Right Camera – Zone Area4'
    }
  ];

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
              max="2100-12-31"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (onDatePick) onDatePick(e.target.value, endDate);
              }}
              className={isDarkMode ? 'dark-input' : ''}
            />

            <label htmlFor="end-date">End Date</label>
            <input
              id="end-date"
              type="date"
              min="1900-01-01"
              max="2100-12-31"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (onDatePick) onDatePick(startDate, e.target.value);
              }}
              className={isDarkMode ? 'dark-input' : ''}
            />
          </div>

          <div className="log-buttons">
            <button className={isDarkMode ? 'dark-button' : ''}>
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
            <button className={isDarkMode ? 'dark-button' : ''}>View Past Logs</button>
          </div>

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
  );
}

SidebarPanel.propTypes = {
  isDarkMode: PropTypes.bool,
  onDatePick: PropTypes.func
};
