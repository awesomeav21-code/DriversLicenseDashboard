import React, { useState, useEffect } from 'react';
import ZoneCard from './ZoneCard';
import '../styles/zonecards.css';
import '../styles/videofeed.css';

export default function VideoFeed({
  isDarkMode,
  tempUnit,
  camera1Zones = [],
  camera2Zones = [],
  center = false, // <-- NEW
}) {
  const [isAlertOn, setIsAlertOn] = useState(() => {
    const saved = localStorage.getItem('isAlertOn');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('isAlertOn', isAlertOn);
  }, [isAlertOn]);

  const toggleAlert = () => setIsAlertOn(prev => !prev);

  return (
    <div className={`video-feed-wrapper ${isDarkMode ? 'dark-video' : 'light-video'}`}>
      <div className="live-data-wrapper">
        <div className="live-data-header">
          <span className="section-title">Live Data</span>
          <span
            className={`status-dot ${isAlertOn ? 'alert-on' : 'alert-off'}`}
            onClick={toggleAlert}
            style={{ cursor: 'pointer' }}
            title="Toggle Alert"
          />
        </div>

        <div className={`cameras-row${center ? ' center' : ''}`}> {/* Only line changed! */}
          <div className="camera-section">
            <div className="camera-header">
              <span className="section-title">Left Camera</span>
              <span className="status-dot"></span>
            </div>
            <div className="zone-grid">
              {camera1Zones.map((zone) => (
                <ZoneCard
                  key={`${zone.camera}-${zone.name}`}
                  zone={zone}
                  tempUnit={tempUnit}
                  isDarkMode={isDarkMode}
                  isAlertOn={isAlertOn}
                  extraClass={zone.name.toLowerCase() === 'global' ? 'global-zone' : ''}
                />
              ))}
            </div>
          </div>

          <div className="camera-section right-camera">
            <div className="camera-header">
              <span className="section-title">Right Camera</span>
              <span className="status-dot"></span>
            </div>
            <div className="zone-grid">
              {camera2Zones.map((zone) => (
                <ZoneCard
                  key={`${zone.camera}-${zone.name}`}
                  zone={zone}
                  tempUnit={tempUnit}
                  isDarkMode={isDarkMode}
                  isAlertOn={isAlertOn}
                  extraClass={zone.name.toLowerCase() === 'global' ? 'global-zone' : ''}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
