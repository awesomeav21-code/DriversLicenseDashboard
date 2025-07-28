import React, { useState, useMemo, useRef, useEffect } from 'react';
import '../styles/surveillancestreams.css';

const THUMBNAIL_PLACEHOLDER = 'https://dummyimage.com/600x340/cccccc/222222&text=Camera+Frame';

// Helper: always returns yyyy-mm-dd in your local time zone
function getLocalYYYYMMDD(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const datePart = dateString.includes('T') ? dateString.split('T')[0] : dateString;
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return null;
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

const ArchiveCard = ({ event, index, showDownloadButton }) => {
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

  function handleDownloadVideo() {
    const eventDateStr = getLocalYYYYMMDD(event.time);
    const jsonStr = JSON.stringify(event, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Event_${eventDateStr}_${index}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        <hr className="meta-divider" />
      </div>

      {showDownloadButton ? (
        <button
          className="archive-download-iconn"
          onClick={handleDownloadVideo}
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
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="size-6"
            aria-hidden="true"
            focusable="false"
            width='20px'
            height='20px'
            style={{ marginRight: 6 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.407-.407.659-.97.659-1.591v-9a2.25 2.25 0 0 0-2.25-2.25h-9c-.621 0-1.184.252-1.591.659m12.182 12.182L2.909 5.909M1.5 4.5l1.409 1.409"
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
    const dayStr = getLocalYYYYMMDD(event.time);
    if (!dateMap[dayStr]) dateMap[dayStr] = [];
    dateMap[dayStr].push(event.time);
  });

  return Object.entries(dateMap)
    .map(([date, times]) => ({
      date,
      times: times.sort(),
      count: times.length,
    }))
    .filter(obj => obj.count > 0)
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
    .map(ev => ev.time && getLocalYYYYMMDD(ev.time))
    .filter(date =>
      !!date &&
      new Date(date).getMonth() === m &&
      new Date(date).getFullYear() === year
    );
  if (dates.length === 0) return '';
  return dates.sort((a, b) => b.localeCompare(a))[0];
}

function getEarliestEventDateInMonth(events, month) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const dates = events
    .map(ev => ev.time && getLocalYYYYMMDD(ev.time))
    .filter(date =>
      !!date &&
      new Date(date).getMonth() === m &&
      new Date(date).getFullYear() === year
    );
  if (dates.length === 0) return '';
  return dates.sort((a, b) => a.localeCompare(b))[0];
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

const LeftArrowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="24"
    height="24"
    viewBox="0 0 256 256"
    xmlSpace="preserve"
  >
    <g
      style={{
        stroke: '#6ca956',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        fill: '#6ca956',
        fillRule: 'nonzero',
        opacity: 1,
      }}
      transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)"
    >
      <path
        d="M 24.25 90 c -0.896 0 -1.792 -0.342 -2.475 -1.025 c -1.367 -1.366 -1.367 -3.583 0 -4.949 L 60.8 45 L 21.775 5.975 c -1.367 -1.367 -1.367 -3.583 0 -4.95 c 1.367 -1.366 3.583 -1.366 4.95 0 l 41.5 41.5 c 1.367 1.366 1.367 3.583 0 4.949 l -41.5 41.5 C 26.042 89.658 25.146 90 24.25 90 z"
      />
    </g>
  </svg>
);

const RightArrowIcon = () => (
  <div style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>
    <LeftArrowIcon />
  </div>
);

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

  eventDates.sort((a, b) => a.date.localeCompare(b.date));

  const [isActive, setIsActive] = useState(false);

  const toggleActive = () => {
    setIsActive(prev => !prev);
  };

  const hasEventsThisMonth = eventDates.length > 0;

  const now = new Date();
  const isNextMonthAllowed = () => {
    const nextMonth = getNextMonth(selectedMonth);
    if (nextMonth.getFullYear() > now.getFullYear()) return false;
    if (nextMonth.getFullYear() === now.getFullYear() && nextMonth.getMonth() > now.getMonth()) return false;
    return true;
  };

  return (
    <aside
      className={`sidebar-event-dates${isActive ? ' active' : ''}`}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onClick={toggleActive}
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
            fontSize: 16,
            cursor: 'pointer',
            color: '#233046',
            padding: '2px 1.5px',
          }}
          onClick={() => onMonthChange(getPrevMonth(selectedMonth))}
        >
          <span className="right-arrow">
            <RightArrowIcon />
          </span>
        </button>
        <span
          style={{
            fontWeight: 400,
            fontSize: 16,
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
            fontSize: 16,
            cursor: isNextMonthAllowed() ? 'pointer' : 'not-allowed',
            padding: '2px 1.5px',
            opacity: isNextMonthAllowed() ? 1 : 0.5,
          }}
          onClick={() => {
            if (isNextMonthAllowed()) {
              onMonthChange(getNextMonth(selectedMonth));
            }
          }}
          disabled={!isNextMonthAllowed()}
        >
          <span className="left-arrow">
            <LeftArrowIcon />
          </span>
        </button>
        <button
          aria-label="Today"
          className="today-button"
          onClick={() => {
            const todayDate = new Date();
            const todayLocal = getLocalYYYYMMDD(todayDate);
            onMonthChange(todayDate);
            onDateSelect(todayLocal);
          }}
        >
          Today
        </button>
      </div>

      {hasEventsThisMonth ? (
        <div className="inner-container date-list-container">
          <div className="sidebar-date-list">
            {eventDates.map(dateObj => (
              <div key={dateObj.date}>
                <div
                  className={`sidebar-date-item${dateObj.date === selectedDate ? ' selected' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (selectedDate !== dateObj.date) {
                      onDateSelect(dateObj.date);
                    }
                  }}
                >
                  <span className="sidebar-date-text">
                    {formatYYYYMMDD(parseLocalDate(dateObj.date))}
                  </span>
                  <span className="sidebar-date-badge">
                    {dateObj.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-eventsbtn"
          style={{
            marginTop: 16,
            padding: 20,
            marginLeft: 9,
            marginRight: 8,
            border: 'none',
            borderRadius: 8,
            backgroundColor: '#e6f4ea',
            textAlign: 'center',
            color: '#666',
            fontStyle: 'italic',
            fontSize: '0.77rem',
            position: 'relative',
            top: '-14px',
            userSelect: 'none',
          }}
        >
          No events for this month
        </div>
      )}
    </aside>
  );
};

const SurveillanceStreams = ({
  camera1Zones = [],
  camera2Zones = [],
  isDarkMode = false,
}) => {
  const nowISOString = new Date().toISOString();

  const generateDynamicMayEvents = () => {
    const fixedDates = [
      '2025-05-03T08:15:00Z',
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

  const [videoRandoms] = useState(() => {
    const total =
      camera1Zones.length +
      camera2Zones.length +
      may2025Events.length;
    return Array.from({ length: total }, () =>
      Math.random() < 0.5
        ? 'https://dummyimage.com/600x340/cccccc/222222&text=Video+File'
        : null
    );
  });

  const allEvents = useMemo(() => {
    return [
      ...camera1Zones.map((zone, idx) => ({
        ...zone,
        camera: '360 Camera',
        eventType: 'Detection',
        time: zone.time || nowISOString,
        objects: zone.objects || 'Person',
        videoSize: zone.videoSize || getRandomVideoSize(),
        videoUrl: videoRandoms[idx],
        duration: zone.duration || getRandomDuration(),
      })),
      ...camera2Zones.map((zone, idx) => ({
        ...zone,
        camera: '360 Camera',
        eventType: 'Detection',
        time: zone.time || nowISOString,
        objects: zone.objects || 'Person',
        videoSize: zone.videoSize || getRandomVideoSize(),
        videoUrl: videoRandoms[idx + camera1Zones.length],
        duration: zone.duration || getRandomDuration(),
      })),
      ...may2025Events.map((event, idx) => ({
        ...event,
        videoUrl: videoRandoms[
          idx + camera1Zones.length + camera2Zones.length
        ],
      })),
    ];
  }, [camera1Zones, camera2Zones, nowISOString, may2025Events, videoRandoms]);

  const currentDate = new Date();
  const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  const isValidStoredDate = (dateStr) => {
    if (!dateStr) return false;
    const d = parseLocalDate(dateStr);
    if (!d) return false;
    return d.getFullYear() === currentMonth.getFullYear() && d.getMonth() === currentMonth.getMonth();
  };

  const storedDate = typeof window !== 'undefined' ? localStorage.getItem('selectedDate') : null;

  const initialSelectedDate = (() => {
    if (isValidStoredDate(storedDate)) {
      return storedDate;
    }

    const hasEventsInCurrentMonth = allEvents.some(ev => {
      if (!ev.time) return false;
      const d = new Date(ev.time);
      return d.getFullYear() === currentMonth.getFullYear() && d.getMonth() === currentMonth.getMonth();
    });

    if (!hasEventsInCurrentMonth) {
      return '';
    }

    const todayLocal = getLocalYYYYMMDD(currentDate);
    const hasEventsToday = allEvents.some(ev => ev.time && getLocalYYYYMMDD(ev.time) === todayLocal);
    if (hasEventsToday) {
      return todayLocal;
    }

    const earliest = getEarliestEventDateInMonth(allEvents, currentMonth);
    return earliest || '';
  })();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [isSidebarHover, setIsSidebarHover] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isInitialized, setIsInitialized] = useState(false);

  const [customEvents, setCustomEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({
    time: '',
    temperature: '',
    threshold: '',
    duration: '',
  });

  const cardsGridRef = useRef(null);

  const [gridTemplateColumns, setGridTemplateColumns] = useState('repeat(auto-fit, minmax(260px, 1fr))');

  // New state: array of booleans, true = show Download Video button, false = show No Video button
  const [videoButtonStates] = useState(() => {
    const total = camera1Zones.length + camera2Zones.length + may2025Events.length;
    // Generate array of true/false randomly, once per page load
    return Array.from({ length: total }, () => Math.random() < 0.5);
  });

  useEffect(() => {
    function updateGridColumns() {
      const width = window.innerWidth;

      if (width < 700) {
        setGridTemplateColumns('1fr');
      } else if (width < 1024) {
        setGridTemplateColumns('repeat(2, 1fr)');
      } else if (width < 1350) {
        setGridTemplateColumns('repeat(3, 1fr)');
      } else {
        setGridTemplateColumns('repeat(auto-fit, minmax(260px, 1fr))');
      }
    }

    updateGridColumns();

    window.addEventListener('resize', updateGridColumns);
    return () => window.removeEventListener('resize', updateGridColumns);
  }, []);

  useEffect(() => {
    if (selectedDate) {
      localStorage.setItem('selectedDate', selectedDate);
    } else {
      localStorage.removeItem('selectedDate');
    }
  }, [selectedDate]);

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      const earliest = getEarliestEventDateInMonth(allEvents, selectedMonth);
      if (earliest) setSelectedDate(earliest);
      return;
    }
    const d = parseLocalDate(selectedDate);
    if (
      !d ||
      d.getFullYear() !== selectedMonth.getFullYear() ||
      d.getMonth() !== selectedMonth.getMonth() ||
      !allEvents.some(ev => ev.time && getLocalYYYYMMDD(ev.time) === selectedDate)
    ) {
      const earliest = getEarliestEventDateInMonth(allEvents, selectedMonth);
      if (earliest) setSelectedDate(earliest);
      else setSelectedDate('');
    }
  }, [selectedMonth, allEvents, selectedDate]);

  const filteredEvents = useMemo(() => {
    if (!selectedDate) return [];
    return allEvents.filter(ev => ev.time && getLocalYYYYMMDD(ev.time) === selectedDate);
  }, [allEvents, selectedDate]);

  const hasEventsInMonth = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    return allEvents.some(ev => {
      if (!ev.time) return false;
      const d = new Date(ev.time);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [allEvents, selectedMonth]);

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
        const eventsOnNext = allEvents.filter(ev => ev.time && getLocalYYYYMMDD(ev.time) === next);
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
    // Implement if needed
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

  if (!isInitialized) {
    return null;
  }

  return (
    <>
      <div className="mini-navbar-outer">
        <div className="mini-navbar">
          <div className="mini-navbar-title">
            <div
              className="mini-navbar-icon-container"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, lineHeight: 1, userSelect: 'none' }}
            >
              <svg
                className="video-icon"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 24 24"
                style={{ width: 29, height: 29 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>{' '}
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
            }}
            onDateSelect={setSelectedDate}
            onHoverChange={setIsSidebarHover}
          />

          <div className="archive-content-column">
            <div className="surveillance-container">
              <div className="surveillance-header-row">
                <div className="showing-entries-text">
                  <span className="formatted-date">
                    {(() => {
                      if (selectedDate) {
                        const d = parseLocalDate(selectedDate);
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
                              ,{' '}
                            </span>
                            {year}
                          </>
                        );
                      } else {
                        const month = selectedMonth.toLocaleString('default', { month: 'long' });
                        const year = selectedMonth.getFullYear();
                        return (
                          <>
                            {month} {year}
                          </>
                        );
                      }
                    })()}
                  </span>
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

              <hr className="archive-divider" />

              <div className="surveillance-cards-scroll">
                <div
                  className="archive-cards-grid"
                  ref={cardsGridRef}
                  style={{ gridTemplateColumns }}
                >
                  {filteredEvents.length === 0 ? (
                    hasEventsInMonth ? (
                      <div className="archive-no-events">
                        {selectedDate
                          ? `No events for this date. Moving to next date...`
                          : 'Please select a date to see events.'}
                      </div>
                    ) : (
                      <div
                        className="archive-no-events"
                        style={{
                          marginTop: 16,
                          padding: 20,
                          marginLeft: 8,
                          marginRight: 8,
                          border: '1px solid #ccc',
                          borderRadius: 8,
                          backgroundColor: 'transparent',
                          textAlign: 'center',
                          color: '#666',
                          fontStyle: 'italic',
                          userSelect: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 12,
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="1.5"
                          stroke="currentColor"
                          className="size-6"
                          aria-hidden="true"
                          focusable="false"
                          style={{ marginRight: 6 }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.407-.407.659-.97.659-1.591v-9a2.25 2.25 0 0 0-2.25-2.25h-9c-.621 0-1.184.252-1.591.659m12.182 12.182L2.909 5.909M1.5 4.5l1.409 1.409"
                          />
                        </svg>
                        <span>No camera events found</span>
                      </div>
                    )
                  ) : (
                    filteredEvents.map((event, i) => (
                      <ArchiveCard
                        event={event}
                        key={i}
                        index={i}
                        showDownloadButton={videoButtonStates[i] || false}
                      />
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
                    <ArchiveCard event={event} key={i} index={i} showDownloadButton={false} />
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