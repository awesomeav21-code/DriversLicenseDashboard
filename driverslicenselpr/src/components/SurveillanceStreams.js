import React, { useState, useMemo, useRef, useEffect } from 'react';
import '../styles/surveillancestreams.css';
import CameraIcon from '../components/images/Camera-icon.png';

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

function getRandomVideoSize() {
  const size = (0.5 + Math.random() * 2.5).toFixed(1);
  return `${size} GB`;
}

function getRandomDuration() {
  const isMinutes = Math.random() > 0.5;
  if (isMinutes) {
    const minutes = Math.floor(Math.random() * 10) + 1;
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    const seconds = Math.floor(Math.random() * 59) + 1;
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }
}

function getRandomTemperature(min = 60, max = 85) {
  return +(min + Math.random() * (max - min)).toFixed(1);
}

function getRandomThreshold(min = 60, max = 80) {
  return +(min + Math.random() * (max - min)).toFixed(1);
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
    return getRandomDuration();
  }

  const cameraName = event.camera || '360 Camera';
  const formattedTime = event.time ? formatEventTime(event.time) : currentTimeStr;

  const objects = event.objects || 'Person';
  const videoSize = event.videoSize || getRandomVideoSize();

  const hasVideo = !!event.videoUrl;

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
          {cameraName} <span className="dash-separator">-</span> {formattedTime}
        </span>
        <span className={getStatusClass(status)}>{status}</span>
      </div>
      <div className="archive-card-meta">
        <div>
          <span className="meta-label">Event Type:</span>
          <span className="meta-value">{event.eventType}</span>
        </div>
        <hr className="meta-divider" />
        <div>
          <span className="meta-label">Objects:</span>
          <span className="meta-value">{objects}</span>
        </div>
        <hr className="meta-divider" />
        <div>
          <span className="meta-label">Camera:</span>
          <span className="meta-value">{cameraName}</span>
        </div>
        <hr className="meta-divider" />
        <div>
          <span className="meta-label">Duration:</span>
          <span className="meta-value">{getDuration(event)}</span>
        </div>
        <hr className="meta-divider" />
        <div>
          <span className="meta-label">Video Size:</span>
          <span className="meta-value">{videoSize}</span>
        </div>
      </div>

      {hasVideo ? (
        <button
          className="archive-download-btn"
          onClick={() => {
            alert(`Downloading video for event at ${formattedTime}`);
          }}
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
          Download Video
        </button>
      ) : (
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
      )}
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

  // Add explicit no data day May 15, 2025
  if (year === 2025 && month === 4) {
    if (!dateMap['2025-05-15']) {
      dateMap['2025-05-15'] = [];
    }
  }

  return Object.entries(dateMap)
    .map(([date, times]) => ({
      date,
      times: times.sort(),
      count: times.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
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
};

const SidebarDates = ({
  allEvents,
  selectedDate,
  selectedMonth,
  onMonthChange,
  onDateSelect,
  onHoverChange,
}) => {
  let eventDates = useMemo(
    () => aggregateEventDatesWithTimes(allEvents, selectedMonth),
    [allEvents, selectedMonth]
  );

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (
    today.getFullYear() === selectedMonth.getFullYear() &&
    today.getMonth() === selectedMonth.getMonth() &&
    !eventDates.some(ed => ed.date === todayStr)
  ) {
    eventDates = [{ date: todayStr, times: [], count: 0 }, ...eventDates];
  }

  // Sort ascending for chronological display
  eventDates.sort((a, b) => a.date.localeCompare(b.date));

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
            padding: '2px 1.5px',
          }}
          onClick={() => onMonthChange(getPrevMonth(selectedMonth))}
        >
          ‹
        </button>
        <span
          style={{
            fontWeight: 400,
            fontSize: '1.09rem',
            color: '#233046',
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
            padding: '2px 1.5px',
          }}
          onClick={() => onMonthChange(getNextMonth(selectedMonth))}
        >
          ›
        </button>
        {/* Today button with toggle logic */}
        <button
          aria-label="Today"
          className="today-button"
          onClick={() => {
            const todayDate = new Date();
            const todayStrISO = todayDate.toISOString().slice(0, 10);
            if (selectedDate === todayStrISO) {
              onDateSelect('');
            } else {
              onMonthChange(todayDate);
              onDateSelect(todayStrISO);
            }
          }}
        >
          Today
        </button>
      </div>
      <div className="inner-container date-list-container">
        <div className="sidebar-date-list">
          {eventDates && eventDates.length > 0 ? (
            eventDates.map(dateObj => (
              <div key={dateObj.date}>
                <div
                  className={`sidebar-date-item${dateObj.date === selectedDate ? ' selected' : ''}`}
                  style={{ cursor: 'pointer' }}
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
                  <span className="sidebar-date-badge">
                    {dateObj.count === 0 ? 'No Data' : dateObj.count}
                  </span>
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

  // Generate dynamic May events with fixed dates but randomized details
  const generateDynamicMayEvents = () => {
    const fixedDates = [
      '2025-05-03T08:15:00Z',
      // '2025-05-15T14:45:00Z', // no event this day (simulate no data)
      '2025-05-22T19:30:00Z',
      '2025-05-30T12:00:00Z',
    ];

    return fixedDates.map(dateISO => ({
      camera: '360 Camera',
      eventType: 'Detection',
      time: dateISO,
      objects: ['Person', 'Car', 'Animal'][Math.floor(Math.random() * 3)],
      videoSize: getRandomVideoSize(),
      videoUrl: null,
      duration: getRandomDuration(),
      temperature: getRandomTemperature(),
      threshold: getRandomThreshold(),
    }));
  };

  const [may2025Events] = useState(generateDynamicMayEvents);

  const allEvents = useMemo(() => {
    const baseEvents = [
      ...camera1Zones.map(zone => ({
        ...zone,
        camera: '360 Camera',
        eventType: 'Detection',
        time: zone.time || nowISOString,
        objects: zone.objects || 'Person',
        videoSize: zone.videoSize || getRandomVideoSize(),
        videoUrl: zone.videoUrl || null,
        duration: zone.duration || getRandomDuration(),
      })),
      ...camera2Zones.map(zone => ({
        ...zone,
        camera: '360 Camera',
        eventType: 'Detection',
        time: zone.time || nowISOString,
        objects: zone.objects || 'Person',
        videoSize: zone.videoSize || getRandomVideoSize(),
        videoUrl: zone.videoUrl || null,
        duration: zone.duration || getRandomDuration(),
      })),
    ];

    return [...baseEvents, ...may2025Events];
  }, [camera1Zones, camera2Zones, nowISOString, may2025Events]);

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() =>
    getLatestEventDateInMonth(allEvents, new Date())
  );
  const [isSidebarHover, setIsSidebarHover] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [customEvents, setCustomEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({
    time: '',
    temperature: '',
    threshold: '',
    duration: '',
  });

  const cardsGridRef = useRef(null);

  // filteredEvents for selectedDate
  const filteredEvents = useMemo(() => {
    if (!selectedDate) return [];
    return allEvents.filter(ev => ev.time && ev.time.slice(0, 10) === selectedDate);
  }, [allEvents, selectedDate]);

  // Effect: If selectedDate has no events, auto move to next date with events
  useEffect(() => {
    if (!selectedDate) return;
    const hasEvents = filteredEvents.length > 0;
    if (!hasEvents) {
      const allDatesSorted = aggregateEventDatesWithTimes(allEvents, selectedMonth)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => d.date);
      const currentIndex = allDatesSorted.indexOf(selectedDate);
      let nextDate = null;
      for (let i = currentIndex + 1; i < allDatesSorted.length; i++) {
        const next = allDatesSorted[i];
        const eventsOnNext = allEvents.filter(ev => ev.time && ev.time.slice(0, 10) === next);
        if (eventsOnNext.length > 0) {
          nextDate = next;
          break;
        }
      }
      if (nextDate) {
        setTimeout(() => {
          alert(`No events for ${selectedDate}. Moving to next date with data: ${nextDate}`);
          setSelectedDate(nextDate);
        }, 200);
      }
    }
  }, [selectedDate, filteredEvents, allEvents, selectedMonth]);

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
    // Intentionally left blank or implement as needed
  };

  const handleAddCustomEvent = e => {
    e.preventDefault();
    if (!newEvent.time || !newEvent.temperature || !newEvent.threshold) {
      alert('Fill time, temperature, and threshold!');
      return;
    }
    setCustomEvents([
      ...customEvents,
      {
        ...newEvent,
        temperature: parseFloat(newEvent.temperature),
        threshold: parseFloat(newEvent.threshold),
        duration: newEvent.duration || getRandomDuration(),
        camera: 'Extra Camera',
        eventType: 'Detection',
        objects: 'Person',
        videoSize: getRandomVideoSize(),
        videoUrl: null,
      },
    ]);
    setNewEvent({
      time: '',
      temperature: '',
      threshold: '',
      duration: '',
    });
  };

  return (
    <>
      <div className="mini-navbar-outer">
        <div className="mini-navbar">
          <div className="mini-navbar-title">
            <div className="mini-navbar-icon-container">
              <img
                src={CameraIcon}
                alt="Camera Icon"
                style={{
                  width: 32,
                  height: 24,
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  display: 'block',
                  margin: 0,
                  padding: 0,
                  background: 'transparent',
                }}
              />
              <span>Surveillance Camera Recordings</span>
            </div>
          </div>
          <button className="archive-temp-event-btn" onClick={handleDownloadTempEvents}>
            <span className="thermo-icon">🌡️</span>
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
            onMonthChange={month => {
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
                      {(() => {
                        const d = parseLocalDate(selectedDate);
                        if (!d) return '';
                        const month = d.toLocaleString('default', { month: 'long' });
                        const day = d.getDate();
                        const year = d.getFullYear();
                        return (
                          <>
                            {month} {day}
                            <span
                              className="comma-normal"
                              style={{
                                textDecoration: 'none',
                                border: 'none',
                                textShadow: 'none',
                                background: 'none',
                                color: 'inherit',
                                cursor: 'default',
                              }}
                            >
                              ,
                            </span>{' '}
                            {year}
                          </>
                        );
                      })()}
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
                        ? `No events for this date. Moving to next date...`
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
        <div>
          {customEvents.length === 0 ? (
            <div>No custom thermal events added.</div>
          ) : (
            <div>
              <h3>Added Events:</h3>
              <div className="surveillance-cards-scroll">
                <div className="archive-cards-grid">
                  {customEvents.map((event, i) => (
                    <ArchiveCard event={event} key={i} index={i} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default SurveillanceStreams;

