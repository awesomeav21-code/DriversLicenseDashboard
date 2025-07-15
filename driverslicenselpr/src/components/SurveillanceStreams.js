import React from 'react';
import '../styles/surveillancestreams.css';

const THUMBNAIL_PLACEHOLDER = 'https://dummyimage.com/600x340/cccccc/222222&text=Camera+Frame';

function getStatus(zone) {
  if (zone.status) return zone.status;
  if (typeof zone.temperature === 'number' && typeof zone.threshold !== 'undefined') {
    return zone.temperature >= zone.threshold ? 'ACTIVE' : 'CLEARED';
  }
  return 'CLEARED';
}

function getStatusClass(status) {
  if (status === 'ACTIVE') return 'card-badge active';
  if (status === 'CLEARED') return 'card-badge cleared';
  return 'card-badge';
}

function getDuration(zone) {
  if (zone.duration) return zone.duration;
  return '';
}

const ArchiveCard = ({ event, index }) => {
  const status = getStatus(event);
  return (
    <div className="archive-card">
      {/* IMAGE AT TOP */}
      <div className="archive-card-img">
        <img src={THUMBNAIL_PLACEHOLDER} alt="Camera frame" />
      </div>
      {/* BLUE BAR: TIME AND BADGE */}
      <div className="archive-card-caption">
        <span className="archive-card-time">
          {event.time || event.name || `360 Camera - 12:0${index} PM`}
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
        <span style={{ marginRight: 5 }}>🎬</span>
        No Video
      </button>
    </div>
  );
};

const SidebarDates = ({ eventDates, selectedDate, onDateSelect }) => (
  <aside className="sidebar-panel">
    <div className="sidebar-title">Event Dates</div>
    <div className="sidebar-date-list">
      {eventDates && eventDates.length > 0 ? (
        eventDates.map((dateObj, idx) => (
          <div
            key={dateObj.date}
            className={`sidebar-date-item${dateObj.date === selectedDate ? ' active' : ''}`}
            onClick={() => onDateSelect && onDateSelect(dateObj.date)}
          >
            <span className="sidebar-date-text">{dateObj.date}</span>
            <span className="sidebar-date-badge">{dateObj.count}</span>
          </div>
        ))
      ) : (
        <div className="sidebar-date-item empty">No Dates</div>
      )}
    </div>
  </aside>
);

const SurveillanceStreams = ({
  camera1Zones = [],
  camera2Zones = [],
  eventDates = [],
  selectedDate = '',
  onDateSelect = () => {},
  onDownloadAll = () => {},
  onDownloadTempEvents = () => {},
}) => {
  const allEvents = [
    ...camera1Zones.map((zone, i) => ({
      ...zone,
      camera: '360 Camera',
      eventType: 'VMD',
      time: zone.time || `360 Camera - 12:0${i} PM`,
    })),
    ...camera2Zones.map((zone, i) => ({
      ...zone,
      camera: '360 Camera',
      eventType: 'VMD',
      time: zone.time || `360 Camera - 12:1${i} PM`,
    })),
  ];

  return (
    <div className="page">
      <div className="archive-main-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 28 }}>
        {/* Sidebar */}
        <SidebarDates eventDates={eventDates} selectedDate={selectedDate} onDateSelect={onDateSelect} />

        {/* Main Content in Outer Container */}
        <div className="surveillance-container">
          {/* Heading Row with Video Camera SVG */}
          <div className="surveillance-header-row" style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span className="camera-icon" style={{ marginRight: 10, display: 'inline-flex', alignItems: 'center' }}>
              <svg width="28" height="22" viewBox="0 0 56 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="6" width="36" height="28" rx="8" fill="#222" />
                <polygon points="38,20 54,9 54,31" fill="#222" />
              </svg>
            </span>
            <span className="surveillance-header-text" style={{ fontWeight: 700, fontSize: '1.34rem', color: '#222' }}>
              Surveillance Data Recordings
            </span>
          </div>
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
            <button className="archive-temp-btn" onClick={onDownloadTempEvents}>
              Temperature Event Recordings
            </button>
            <button className="archive-download-btn" onClick={onDownloadAll}>
              <span
                className="download-icon"
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  marginRight: 6,
                  verticalAlign: 'middle',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 3v9m0 0l-4-4m4 4l4-4m-9 7h10"
                    stroke="#fff"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Download All
            </button>
          </div>
          {/* Card Grid */}
          <div className="archive-cards-grid">
            {allEvents.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>No events for this date.</div>
            ) : (
              allEvents.map((event, i) => <ArchiveCard event={event} key={i} index={i} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveillanceStreams;
