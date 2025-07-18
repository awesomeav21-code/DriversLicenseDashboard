import React, { useState, useMemo, useEffect, useRef } from 'react';
import '../styles/surveillancestreams.css';

const THUMBNAIL_PLACEHOLDER = 'https://dummyimage.com/600x340/cccccc/222222&text=Camera+Frame';

// Utility functions
function getStatus(zone) {
  if (zone.status) return zone.status;
  if (typeof zone.temperature === 'number' && typeof zone.threshold !== 'undefined') {
    return zone.temperature >= zone.threshold ? 'ACTIVE' : 'CLEARED';
  }
  return 'CLEARED';
}

// ArchiveCard component
const ArchiveCard = ({ event, index }) => {
  const status = getStatus(event);

  // NEW: format only time (without date)
  function formatEventTime(timeStr) {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    if (isNaN(d)) return timeStr;
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Get current time formatted as fallback if event.time missing
  const currentTimeStr = formatEventTime(new Date().toISOString());

  function getStatusClass(status) {
    if (status === 'ACTIVE') return 'card-badge active';
    if (status === 'CLEARED') return 'card-badge cleared';
    return 'card-badge';
  }

  function getDuration(zone) {
    if (zone.duration) return zone.duration;
    return '';
  }

  return (
    <div className="archive-card">
      <div className="archive-card-img">
        <img src={THUMBNAIL_PLACEHOLDER} alt="Camera frame 1" />
        <img src={THUMBNAIL_PLACEHOLDER} alt="Camera frame 2" />
        <img src={THUMBNAIL_PLACEHOLDER} alt="Camera frame 3" />
        <img src={THUMBNAIL_PLACEHOLDER} alt="Camera frame 4" />
      </div>
      <div className="archive-card-caption">
        <span className="archive-card-time">
          {event.time
            ? formatEventTime(event.time)
            : currentTimeStr /* dynamically show current time fallback */}
        </span>
        <span className={getStatusClass(status)}>{status}</span>
      </div>
      <div className="archive-card-meta">
        <div>
          <span className="meta-label">Event Type:</span>
          <span className="meta-value">{event.eventType || 'VMD'}</span>
        </div>
        <div>
          <span className="meta-label">Camera:</span>
          <span className="meta-value">{event.camera || '360 Camera'}</span>
        </div>
        <div>
          <span className="meta-label">Duration:</span>
          <span className="meta-value">{getDuration(event)}</span>
        </div>
      </div>
      <button className="archive-no-video-btn" disabled>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
          style={{ marginRight: 6 }}
        >
          <path
            d="M17 7l5 4-5 4V7zM3 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
            fill="#767d88"
          />
        </svg>
        No Video
      </button>
    </div>
  );
};

// Short time: "2:45 PM"
function formatShortTime(timeStr) {
  if (!timeStr) return '';
  const d = new Date(timeStr);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Group events by date, include actual times for each
function aggregateEventDatesWithTimes(events, selectedMonth) {
  const dateMap = {};
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();

  events.forEach(event => {
    if (!event.time) return;
    const d = new Date(event.time);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const dayStr = d.toISOString().slice(0, 10);
    if (!dateMap[dayStr]) dateMap[dayStr] = [];
    dateMap[dayStr].push(event.time);
  });

  return Object.entries(dateMap)
    .map(([date, times]) => ({
      date,
      times: times.sort(),
      count: times.length,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// UPDATED formatMonth: returns JSX with separate month and year spans
function formatMonth(date) {
  const monthStr = date.toLocaleString('default', { month: 'long' });
  const yearStr = date.getFullYear();

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className="month-text">{monthStr}</span>
      <span className="year-text">{yearStr}</span>
    </span>
  );
}

function getPrevMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - 1);
  return d;
}
function getNextMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

// SidebarDates
const SidebarDates = ({
  allEvents,
  selectedDate,
  selectedMonth,
  onMonthChange,
  onDateSelect,
  onHoverChange,
}) => {
  const eventDates = useMemo(
    () => aggregateEventDatesWithTimes(allEvents, selectedMonth),
    [allEvents, selectedMonth]
  );

  return (
    <aside
      className="sidebar-event-dates"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {/* Event Dates title OUTSIDE container, left-aligned */}
      <div
        className="sidebar-title"
        style={{
          marginBottom: 8,
          marginLeft: 8,
          alignSelf: 'flex-start',
          textAlign: 'left',
        }}
      >
        Event Dates
      </div>

      {/* Month selector is now below the title, above the dates list */}
      <div className="inner-container month-nav">
        <button
          aria-label="Previous Month"
          style={{
            background: 'none',
            border: 'none',
            fontSize: 22,
            cursor: 'pointer',
            color: '#233046',
            padding: '2px 6px'
          }}
          onClick={() => onMonthChange(getPrevMonth(selectedMonth))}
        >&lt;</button>
        <span
          style={{
            fontWeight: 400,
            fontSize: '1.09rem',
            color: '#233046'
          }}
        >
          {formatMonth(selectedMonth)}
        </span>
        <button
          aria-label="Next Month"
          style={{
            background: 'none',
            border: 'none',
            fontSize: 22,
            cursor: 'pointer',
            color: '#233046',
            padding: '2px 6px'
          }}
          onClick={() => onMonthChange(getNextMonth(selectedMonth))}
        >&gt;</button>
      </div>

      <div className="inner-container date-list-container">
        <div className="sidebar-date-list">
          {eventDates && eventDates.length > 0 ? (
            eventDates.map(dateObj => (
              <div key={dateObj.date}>
                <div
                  className={`sidebar-date-item${dateObj.date === selectedDate ? ' selected' : ''}`}
                  style={{
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (selectedDate === dateObj.date) {
                      onDateSelect('');
                    } else {
                      onDateSelect(dateObj.date);
                    }
                  }}
                >
                  {/* FIX: Removed inner div so flex works as expected */}
                  <span className="sidebar-date-text">{dateObj.date}</span>
                  <span className="sidebar-date-badge">{dateObj.count}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="sidebar-date-item empty">No Dates</div>
          )}
        </div>
      </div>
    </aside>
  );
};

const SurveillanceStreams = ({
  camera1Zones = [],
  camera2Zones = [],
  isDarkMode = false,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowISOString = new Date().toISOString();

  const allEvents = useMemo(() => [
    ...camera1Zones.map((zone) => ({
      ...zone,
      camera: '360 Camera',
      eventType: 'VMD',
      time: zone.time || nowISOString,
    })),
    ...camera2Zones.map((zone) => ({
      ...zone,
      camera: '360 Camera',
      eventType: 'VMD',
      time: zone.time || nowISOString,
    })),
  ], [camera1Zones, camera2Zones, nowISOString]);

  function getDefaultMonth() {
    if (allEvents.length === 0) return new Date();
    const dates = allEvents.map(e => e.time).filter(Boolean).map(t => new Date(t));
    dates.sort((a, b) => b - a);
    return dates[0] || new Date();
  }

  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
  const [selectedDate, setSelectedDate] = useState('');
  const [isSidebarHover, setIsSidebarHover] = useState(false);

  // Add refs
  const cardsGridRef = useRef(null);

  const filteredEvents = useMemo(() => {
    if (!selectedDate) {
      return [];
    }
    return allEvents.filter(ev => ev.time && ev.time.slice(0, 10) === selectedDate);
  }, [allEvents, selectedDate]);

  useEffect(() => {
    function clampScroll() {
      if (!selectedDate || filteredEvents.length === 0 || isSidebarHover) return;
      if (!cardsGridRef.current) return;

      const grid = cardsGridRef.current;
      const gridBottomAbs = grid.offsetTop + grid.offsetHeight;
      const maxScrollTop = gridBottomAbs - window.innerHeight;

      if (window.scrollY > maxScrollTop) {
        window.scrollTo(0, Math.max(0, maxScrollTop));
      }
    }

    window.addEventListener('scroll', clampScroll, { passive: true });
    window.addEventListener('resize', clampScroll);

    let timeoutId = setTimeout(clampScroll, 40);
    return () => {
      window.removeEventListener('scroll', clampScroll);
      window.removeEventListener('resize', clampScroll);
      clearTimeout(timeoutId);
    };
  }, [selectedDate, filteredEvents.length, isSidebarHover]);

  const handleDownloadAll = () => {
    if (filteredEvents.length === 0) {
      alert('No events to download.');
      return;
    }
    const jsonStr = JSON.stringify(filteredEvents, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'camera_events.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTempEvents = () => {
    const tempEvents = filteredEvents.filter(
      (event) => getStatus(event) === 'ACTIVE'
    );
    if (tempEvents.length === 0) {
      alert('No temperature-active events to download.');
      return;
    }
    const jsonStr = JSON.stringify(tempEvents, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'temperature_active_events.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Mini-navbar OUTSIDE of .page! */}
      <div className="mini-navbar-outer">
        <div className="mini-navbar">
          <div className="mini-navbar-title">Surveillance Camera Recordings</div>
          <button
            className="archive-temp-event-btn"
            onClick={handleDownloadTempEvents}
            style={{ minWidth: 200, fontWeight: 700 }}
          >
            Temperature Event Recordings
          </button>
        </div>
      </div>

      <div className={`page${isDarkMode ? ' dark-mode' : ''}`}>
        <div className="archive-main-row">
          {/* Sidebar */}
          <SidebarDates
            allEvents={allEvents}
            selectedDate={selectedDate}
            selectedMonth={selectedMonth}
            onMonthChange={(month) => {
              setSelectedMonth(month);
              setSelectedDate('');
            }}
            onDateSelect={setSelectedDate}
            onHoverChange={setIsSidebarHover}
          />

          {/* Main surveillance content */}
          <div className="archive-content-column">
            <div className="surveillance-container">
              {/* Header row */}
              <div className="surveillance-header-row">
                <div className="showing-entries-text">
                  {selectedDate && (
                    <span className = "formatted-date">
                      {new Date(selectedDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <button
                  className="archive-download-btn"
                  onClick={handleDownloadAll}
                >
                  <span className="download-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10 3v9m0 0l-4-4m4 4l4-4m-9 7h10"
                        stroke="#fff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  Download All
                </button>
              </div>

              {/* Horizontal divider only if events exist */}
              {filteredEvents.length > 0 && <hr className="archive-divider" />}

              {/* Cards Grid */}
              <div className="archive-cards-grid" ref={cardsGridRef}>
                {filteredEvents.length === 0 ? (
                  <div className="archive-no-events">
                    {selectedDate
                      ? 'No events for this date.'
                      : 'Please select a date to see events.'}
                  </div>
                ) : (
                  filteredEvents.map((event, i) => (
                    <ArchiveCard event={event} key={i} index={i} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SurveillanceStreams;
