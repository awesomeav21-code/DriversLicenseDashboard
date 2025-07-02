import React, { useState, useEffect } from 'react';
import ZoneCards from './ZoneCard';
import '../styles/zonecards.css';
import '../styles/videofeed.css';

export default function VideoFeed({ isDarkMode, tempUnit, camera1Zones = [], camera2Zones = [] }) {
  // Initialize alert toggle state with localStorage
  const [isAlertOn, setIsAlertOn] = useState(() => {
    const saved = localStorage.getItem('isAlertOn');
    return saved === 'true'; // default false if not set
  });

  // Persist changes to localStorage
  useEffect(() => {
    localStorage.setItem('isAlertOn', isAlertOn);
  }, [isAlertOn]);

  // Toggle handler
  const toggleAlert = () => setIsAlertOn(prev => !prev);

  return (
    <div className={`video-feed-wrapper ${isDarkMode ? 'dark-video' : 'light-video'}`}>
      <div className="live-data-wrapper">
        <div className="live-data-header">
          <span className="section-title">Live Data</span>
          <span 
            className={`status-dot ${isAlertOn ? 'alert-on' : 'alert-off'}`} 
            onClick={toggleAlert}
            style={{cursor: 'pointer'}}
            title="Toggle Alert"
          />
        </div>

        <div className="cameras-row">
          {/* Left Camera */}
          <div className="camera-section">
            <div className="camera-header">
              <span className="section-title">Left Camera</span>
              <span className="status-dot"></span>
            </div>
            <div className="zone-grid">
              {camera1Zones.map((zone) => (
                <ZoneCards
                  key={zone.id}
                  zone={zone}
                  tempUnit={tempUnit}
                  isDarkMode={isDarkMode}
                  isAlertOn={isAlertOn}          // pass alert state down if needed
                  extraClass={zone.name.toLowerCase() === 'global' ? 'global-zone' : ''}
                />
              ))}
            </div>
          </div>

          {/* Right Camera */}
          <div className="camera-section right-camera">
            <div className="camera-header">
              <span className="section-title">Right Camera</span>
              <span className="status-dot"></span>
            </div>
            <div className="zone-grid">
              {camera2Zones.map((zone) => (
                <ZoneCards
                  key={zone.id}
                  zone={zone}
                  tempUnit={tempUnit}
                  isDarkMode={isDarkMode}
                  isAlertOn={isAlertOn}         // pass alert state down if needed
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
