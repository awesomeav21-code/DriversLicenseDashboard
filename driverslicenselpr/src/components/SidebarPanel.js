import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import '../styles/sidebarpanel.css';

export default function SidebarPanel({
  isDarkMode,
  onDatePick,
  visibleZones = [],
  zones = [],
  history = [],
  zoneCameraMap = {},
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) {
  // Use static height to prevent movement
  const staticHeight = 600; // Fixed height that doesn't change





  // Test fallback if history empty
  const [testHistory, setTestHistory] = useState([]);
  useEffect(() => {
    if (history.length === 0) {
      setTestHistory([
        {
          time: new Date('2025-07-26T14:30:00'),
          readings: { 'Zone A': 72 },
        },
        {
          time: new Date('2025-07-27T09:15:00'),
          readings: { 'Zone B': 68 },
        },
        {
          time: new Date('2025-07-27T20:45:00'),
          readings: { 'Zone C': 75 },
        },
      ]);
    } else {
      setTestHistory([]);
    }
  }, [history]);

  const dataToUse = history.length > 0 ? history : testHistory;

  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];

  const formatDateISO = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const clampDate = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr > todayISO) return todayISO;
    return dateStr;
  };

  useEffect(() => {
    if (startDate && startDate > todayISO) setStartDate(todayISO);
    if (endDate && endDate > todayISO) setEndDate(todayISO);
  }, [startDate, endDate, setStartDate, setEndDate, todayISO]);

  useEffect(() => {
    if (onDatePick) onDatePick(startDate, endDate);
  }, [startDate, endDate, onDatePick]);

  // Only include zones that are mapped to a camera
  const mappedVisibleZones = visibleZones.filter(zoneName => zoneCameraMap[zoneName]);

  // Use zoneCameraMap to get camera label here:
  const formatZoneInfo = (zoneName, reading) => {
    const temp = reading != null ? `${reading}°` : 'N/A';
    const cameraRaw = zoneCameraMap[zoneName];
    let cameraLabel;
    if (cameraRaw === 'planck_1') {
      cameraLabel = 'Left Camera';
    } else if (cameraRaw === 'planck_2') {
      cameraLabel = 'Right Camera';
    } else {
      cameraLabel = cameraRaw;
    }
    return `Zone: ${zoneName}, Temperature: ${temp}, Camera: ${cameraLabel}`;
  };

  // Filter history entries by date range & visible zones
  const filteredHistory =
    startDate && endDate
      ? dataToUse.filter(entry => {
          if (!(entry.time instanceof Date) || isNaN(entry.time)) return false;
          const entryDateStr = formatDateISO(entry.time);
          if (entryDateStr < startDate || entryDateStr > endDate) return false;
          return mappedVisibleZones.some(zoneName => entry.readings && entry.readings[zoneName] != null);
        })
      : [];

  // Find latest reading for each visible zone (most recent time)
  const latestReadingsMap = new Map();
  filteredHistory.forEach(entry => {
    mappedVisibleZones.forEach(zoneName => {
      const val = entry.readings?.[zoneName];
      if (val != null) {
        const prev = latestReadingsMap.get(zoneName);
        if (!prev || entry.time > prev.time) {
          latestReadingsMap.set(zoneName, { time: entry.time, reading: val });
        }
      }
    });
  });

  // Entries for latest readings (top cards) — show current time, keep latest reading
  const now = new Date();
  const latestEntries = Array.from(latestReadingsMap.entries()).map(
    ([zoneName, { reading }]) => ({
      zoneName,
      time: now, // current actual time for latest entries
      reading,
    })
  );

  // Entries for previous readings (exclude latest timestamps per zone)
  const previousEntries = filteredHistory.flatMap(entry =>
    mappedVisibleZones.flatMap(zoneName => {
      const val = entry.readings?.[zoneName];
      if (
        val != null &&
        (!latestReadingsMap.has(zoneName) || entry.time.getTime() !== latestReadingsMap.get(zoneName).time.getTime())
      ) {
        return [{ zoneName, time: entry.time, reading: val }];
      }
      return [];
    })
  );

  // Download logs handler (same as before, using filteredHistory)
  const downloadLogs = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates.');
      return;
    }
    if (filteredHistory.length === 0) {
      alert('No zone data available to download for selected dates.');
      return;
    }

    const headers = ['Index', 'Timestamp', ...mappedVisibleZones];
    const rows = filteredHistory.map((entry, index) => {
      const row = [index + 1, entry.time.toLocaleString()];
      mappedVisibleZones.forEach(zoneName => {
        const val = entry.readings && entry.readings[zoneName];
        row.push(val != null ? `${val}°` : 'N/A');
      });
      return row;
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zone_logs_${startDate}_to_${endDate}.csv`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculate scroll container height based on static height
  const getScrollContainerHeight = () => {
    const totalHeight = staticHeight;
    const fixedElementsHeight = 200; // Approximate height of header, inputs, buttons, etc.
    const scrollHeight = Math.max(340, totalHeight - fixedElementsHeight);
    return `${scrollHeight}px`;
  };

  const scrollContainerHeight = getScrollContainerHeight();

  // State to track window width for responsive margins
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [dashboardHeight, setDashboardHeight] = useState(600); // Default height
  
  // Calculate responsive maxHeight for event-logs container - reduced upward movement on smaller screens
  const getEventLogsMaxHeight = () => {
    // Reduced linear reduction: smaller screen = less height reduction (content moves up less)
    const baseHeight = 100; // Start at 100% for very large screens
    const reductionPerPixel = 0.008; // Reduced from 0.015 to 0.008 - less reduction per pixel
    const calculatedHeight = Math.max(92, baseHeight - (windowWidth * 0.003)); // Increased minimum from 87 to 92, reduced multiplier from 0.005 to 0.003
    return `${calculatedHeight}%`;
  };

  // Listen for window resize to update responsive margins and match dashboard height
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      
      // Find the big-dashboard-container and match its height
      const dashboardContainer = document.querySelector('.big-dashboard-container');
      if (dashboardContainer) {
        const height = dashboardContainer.offsetHeight;
        setDashboardHeight(height);
      }
    };

    // Initial measurement
    handleResize();
    
    // Set up a more frequent check for height changes
    const interval = setInterval(handleResize, 100);
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, []);

  // Debug: Monitor margin changes
  useEffect(() => {
    const checkMargin = () => {
      const sidebarEl = document.querySelector('.sidebar-panel');
      if (sidebarEl) {
        const computedStyle = window.getComputedStyle(sidebarEl);
        const topMargin = computedStyle.marginTop;
        const topPosition = computedStyle.top;
        const offsetTop = sidebarEl.offsetTop;
        
        console.log('SidebarPanel Debug:', {
          marginTop: topMargin,
          top: topPosition,
          offsetTop: offsetTop,
          timestamp: new Date().toLocaleTimeString()
        });
        
        const debugEl = document.getElementById('sidebar-debug');
        if (debugEl) {
          debugEl.textContent = `Margin: ${topMargin} | Top: ${topPosition} | Offset: ${offsetTop}px`;
        }
      }
    };

    // Check immediately
    checkMargin();
    
    // Check every 500ms
    const interval = setInterval(checkMargin, 500);
    
    return () => clearInterval(interval);
  }, []);

  // Calculate static right margin - doesn't change with screen size
  const getResponsiveMargin = () => {
    // Static right margin that doesn't change
    return '8px'; // Fixed 8px right margin (reduced from 10px)
  };

  // Calculate uniform bottom margin - same across all screen sizes
  const getUniformBottomMargin = () => {
    // Uniform bottom margin that stays the same on all screen sizes
    return '50px'; // Same 50px margin for all screen sizes
  };

  return (
    <div 
      className={`sidebar-panel ${isDarkMode ? 'dark-panel' : 'light-panel'}`}
      style={{ 
        height: `${dashboardHeight}px`, // Dynamically match dashboard container height
        minHeight: '600px', // Ensure minimum height
        marginRight: getResponsiveMargin(),
        marginBottom: getUniformBottomMargin(), // Uniform bottom margin
        transition: 'margin-right 0.3s ease, margin-bottom 0.3s ease, transform 0.3s ease' // Added margin-bottom transition
      }}
      ref={(el) => {
        if (el) {
          const computedStyle = window.getComputedStyle(el);
          const topMargin = computedStyle.marginTop;
          console.log('SidebarPanel top margin:', topMargin);
          // Update the debug display
          const debugEl = document.getElementById('sidebar-debug');
          if (debugEl) {
            debugEl.textContent = `Top Margin: ${topMargin}`;
          }
        }
      }}
    >


      

      
      <div className="sidebar-inner" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="event-logs" style={{ display: 'flex', flexDirection: 'column', height: 'auto', maxHeight: getEventLogsMaxHeight() }}>
          <h2 className="log-title">Event Logs</h2>
          <hr className="title-divider" />

          <div className="controls-container">
            <div className="date-inputs">
              <label htmlFor="start-date">Start Date</label>
              <input
                id="start-date"
                type="date"
                max={todayISO}
                value={startDate}
                onChange={(e) => setStartDate(clampDate(e.target.value))}
                className={isDarkMode ? 'dark-input' : ''}
                style={{ marginBottom: '6px' }}
                placeholder="MM/DD/YYYY"
              />
              <label htmlFor="end-date">End Date</label>
              <input
                id="end-date"
                type="date"
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
          </div>

                    <div className="logs-container" style={{ flex: '0.98', display: 'flex', flexDirection: 'column', minHeight: '0' }}>
            <div
              className="logs-scroll-container"
              style={{ 
                flex: '1.2',
                overflowY: 'auto', 
                overflowX: 'visible', // Ensure horizontal overflow is visible
                marginTop: '0px', // Fixed to prevent movement
                minHeight: '0' // Allow flex item to shrink
              }}
            >
            <div className="log-entries-list">
              {/* Latest entries top */}
              {latestEntries.length > 0 && (
                <>
                  {latestEntries.map(({ zoneName, time, reading }, idx) => (
                    <div
                      className="log-entry"
                      key={`latest-${zoneName}-${time.toISOString()}-${idx}`}
                    >
                      <div className="log-index">{idx + 1}.</div>
                      <div className="log-text">
                        <div className="log-timestamp">{time.toLocaleString()}</div>
                        <div className="log-message">{formatZoneInfo(zoneName, reading)}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Previous entries */}
              {previousEntries.length > 0 && (
                <>
                  {previousEntries.map(({ zoneName, time, reading }, idx) => (
                    <div
                      className="log-entry"
                      key={`prev-${zoneName}-${time.toISOString()}-${idx}`}
                    >
                      <div className="log-index">{idx + 1}.</div>
                      <div className="log-text">
                        <div className="log-timestamp">{time.toLocaleString()}</div>
                        <div className="log-message">{formatZoneInfo(zoneName, reading)}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* No entries fallback */}
              {startDate && endDate && latestEntries.length === 0 && previousEntries.length === 0 && (
                <div className="log-empty">No zone data available for selected dates.</div>
              )}

              {!startDate || !endDate ? (
                <div className="log-empty">Select start and end dates to view logs.</div>
              ) : null}
            </div>
          </div>
          <div style={{ flex: '0.02', minHeight: '0' }}></div>
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
  history: PropTypes.array,
  zoneCameraMap: PropTypes.object,
  startDate: PropTypes.string,
  setStartDate: PropTypes.func,
  endDate: PropTypes.string,
  setEndDate: PropTypes.func,
};