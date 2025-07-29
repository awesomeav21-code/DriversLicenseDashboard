import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import '../styles/sidebarpanel.css';

export default function SidebarPanel({
  isDarkMode,
  onDatePick,
  visibleZones = [],
  zones = [],
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) {
  const todayLocal = new Date();
  const year = todayLocal.getFullYear();
  const month = String(todayLocal.getMonth() + 1).padStart(2, '0');
  const day = String(todayLocal.getDate()).padStart(2, '0');
  const todayISO = `${year}-${month}-${day}`;

  const clampDate = (dateStr) => (dateStr > todayISO ? todayISO : dateStr);

  useEffect(() => {
    const savedStart = localStorage.getItem('logStartDate') || '';
    const savedEnd = localStorage.getItem('logEndDate') || '';
    if (savedStart) setStartDate(savedStart);
    if (savedEnd) setEndDate(savedEnd);
  }, [setStartDate, setEndDate]);

  useEffect(() => {
    if (startDate !== '') localStorage.setItem('logStartDate', startDate);
    if (endDate !== '') localStorage.setItem('logEndDate', endDate);
    if (onDatePick) onDatePick(startDate, endDate);
  }, [startDate, endDate, onDatePick]);

  const formatZoneInfo = (zone) => {
    const cameraName =
      zone.camera === 'planck_1'
        ? 'Left Camera'
        : zone.camera === 'planck_2'
        ? 'Right Camera'
        : zone.camera;
    const temp = zone.temperature != null ? `${zone.temperature}°` : 'N/A';
    return `Temperature: ${temp}, ${cameraName}, Zone: ${zone.name}`;
  };

  const zonesToDisplay = zones.filter((z) => visibleZones.includes(z.name));

  const getLocalDateStr = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Filter zones within date range (used for display and download)
  const filteredZones = (startDate && endDate)
    ? zonesToDisplay.filter((zone) => {
        if (!zone.lastTriggered) return false;
        const triggeredDate = new Date(zone.lastTriggered);
        if (isNaN(triggeredDate)) return false;
        const triggeredDateStr = getLocalDateStr(triggeredDate);
        return triggeredDateStr >= startDate && triggeredDateStr <= endDate;
      })
    : [];

  const downloadLogs = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates.');
      return;
    }

    if (filteredZones.length === 0) {
      alert('No zone data available to download for selected dates.');
      return;
    }

    const headers = ['Index', 'Last Triggered', 'Temperature', 'Camera', 'Zone Name'];
    const rows = filteredZones.map((zone, index) => [
      index + 1,
      zone.lastTriggered || 'N/A',
      zone.temperature != null ? `${zone.temperature}°` : 'N/A',
      zone.camera === 'planck_1'
        ? 'Left Camera'
        : zone.camera === 'planck_2'
        ? 'Right Camera'
        : zone.camera,
      zone.name,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zone_logs_${todayISO}.csv`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`sidebar-panel ${isDarkMode ? 'dark-panel' : 'light-panel'}`}>
      <div className="sidebar-inner">
        <div className="event-logs">
          <h2 className="log-title">Zone Details</h2>

          <div className="date-inputs">
            <label htmlFor="start-date">Start</label>
            <input
              id="start-date"
              type="date"
              min="1900-01-01"
              max={todayISO}
              value={startDate}
              onChange={(e) => setStartDate(clampDate(e.target.value))}
              className={isDarkMode ? 'dark-input' : ''}
              style={{ marginBottom: '6px' }}
              placeholder="MM/DD/YYYY"
            />
            <label htmlFor="end-date">End</label>
            <input
              id="end-date"
              type="date"
              min="1900-01-01"
              max={todayISO}
              value={endDate}
              onChange={(e) => setEndDate(clampDate(e.target.value))}
              className={isDarkMode ? 'dark-input' : ''}
              placeholder="MM/DD/YYYY"
            />
          </div>

          <div className="log-buttons">
            <button
              className={`download-logs-btn${isDarkMode ? ' dark-btn' : ''}`}
              onClick={downloadLogs}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                style={{ width: '24px', height: '24px' }}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Download Logs
            </button>
          </div>

          <div
            className="logs-scroll-container"
            style={{ maxHeight: '340px', overflowY: 'auto', marginTop: '10px' }}
          >
            <div className="log-entries-list">
              {filteredZones.length === 0 ? (
                <div className="log-empty">No zone data available.</div>
              ) : (
                filteredZones.map((zone, index) => (
                  <div className="log-entry" key={zone.name}>
                    <div className="log-index">{index + 1}.</div>
                    <div className="log-text">
                      <div className="log-timestamp">{zone.lastTriggered || 'N/A'}</div>
                      <div className="log-message">{formatZoneInfo(zone)}</div>
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
  visibleZones: PropTypes.array,
  zones: PropTypes.array,
  startDate: PropTypes.string,
  setStartDate: PropTypes.func,
  endDate: PropTypes.string,
  setEndDate: PropTypes.func,
};