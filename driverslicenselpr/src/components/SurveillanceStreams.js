import React, { useState, useMemo, useRef } from 'react';
import '../styles/surveillancestreams.css';

const THUMBNAIL_PLACEHOLDER = 'https://dummyimage.com/600x340/cccccc/222222&text=Camera+Frame';

function parseLocalDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function formatYYYYMMDD(dateObj) {
  if (!dateObj) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getStatus(zone) {
  if (zone.status) return zone.status;
  if (typeof zone.temperature === 'number' && typeof zone.threshold !== 'undefined') {
    return zone.temperature >= zone.threshold ? 'ACTIVE' : 'CLEARED';
  }
  return 'CLEARED';
}

const ArchiveCard = ({ event, index }) => {
  const status = getStatus(event);

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
        <img src={THUMBNAIL_PLACEHOLDER} alt="Camera frame" />
      </div>
      <div className="archive-card-caption">
        <span className="archive-card-time">
          {event.time ? formatEventTime(event.time) : currentTimeStr}
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

function getLatestEventDateInMonth(events, month) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const dates = events
    .map(ev => ev.time && ev.time.slice(0, 10))
    .filter(date =>
      !!date &&
      new Date(date).getMonth() === m &&
      new Date(date).getFullYear() === year
    );
  if (dates.length === 0) return '';
  return dates.sort((a, b) => b.localeCompare(a))[0];
}

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose} aria-label="Close popup">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

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
                  <span className="sidebar-date-text">
                    {formatYYYYMMDD(parseLocalDate(dateObj.date))}
                  </span>
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
  const nowISOString = new Date().toISOString();

  // For adding custom events to the main timeline
  const [customEvents, setCustomEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({
    time: '',
    temperature: '',
    threshold: '',
    duration: '',
  });

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
    ...customEvents, // <<<<<< Include custom events in main event list
  ], [camera1Zones, camera2Zones, nowISOString, customEvents]);

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() =>
    getLatestEventDateInMonth([
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
    ], new Date())
  );
  const [isSidebarHover, setIsSidebarHover] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const cardsGridRef = useRef(null);

  const filteredEvents = useMemo(() => {
    if (!selectedDate) return [];
    return allEvents.filter(ev => ev.time && ev.time.slice(0, 10) === selectedDate);
  }, [allEvents, selectedDate]);

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

  const handleDownloadTempEvents = () => setIsModalOpen(true);

  // Handle adding new custom event to the main timeline/grid!
  const handleAddCustomEvent = (e) => {
    e.preventDefault();
    if (!newEvent.time || !newEvent.temperature || !newEvent.threshold) {
      alert("Fill time, temperature, and threshold!");
      return;
    }
    setCustomEvents(prev => [
      ...prev,
      {
        ...newEvent,
        temperature: parseFloat(newEvent.temperature),
        threshold: parseFloat(newEvent.threshold),
        duration: newEvent.duration,
        camera: 'Extra Camera',
        eventType: 'Thermal',
      }
    ]);
    setNewEvent({
      time: '',
      temperature: '',
      threshold: '',
      duration: '',
    });
    setIsModalOpen(false); // auto-close after add
  };

  return (
    <>
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
          <SidebarDates
            allEvents={allEvents}
            selectedDate={selectedDate}
            selectedMonth={selectedMonth}
            onMonthChange={(month) => {
              setSelectedMonth(month);
              setSelectedDate(getLatestEventDateInMonth(allEvents, month));
            }}
            onDateSelect={setSelectedDate}
            onHoverChange={setIsSidebarHover}
          />

          <div className="archive-content-column">
            <div className="surveillance-container">
              <div className="surveillance-header-row">
                <div className="showing-entries-text">
                  {selectedDate && (
                    <span className="formatted-date">
                      {parseLocalDate(selectedDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <button className="archive-download-btn" onClick={handleDownloadAll}>
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

              {filteredEvents.length > 0 && <hr className="archive-divider" />}

              <div className="surveillance-cards-scroll">
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
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2 style={{ marginTop: 0 }}>Add Thermal Event (Extra Camera)</h2>
        <form onSubmit={handleAddCustomEvent} style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <label>
              Time:&nbsp;
              <input
                type="datetime-local"
                value={newEvent.time}
                onChange={e => setNewEvent(ev => ({ ...ev, time: e.target.value }))}
                required
              />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              Temperature:&nbsp;
              <input
                type="number"
                step="0.1"
                value={newEvent.temperature}
                onChange={e => setNewEvent(ev => ({ ...ev, temperature: e.target.value }))}
                required
              />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              Threshold:&nbsp;
              <input
                type="number"
                step="0.1"
                value={newEvent.threshold}
                onChange={e => setNewEvent(ev => ({ ...ev, threshold: e.target.value }))}
                required
              />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              Duration (optional):&nbsp;
              <input
                type="text"
                value={newEvent.duration}
                onChange={e => setNewEvent(ev => ({ ...ev, duration: e.target.value }))}
              />
            </label>
          </div>
          <button type="submit" style={{ fontWeight: 600 }}>Add Event</button>
        </form>
      </Modal>
    </>
  );
};

export default SurveillanceStreams;
