// src/components/VideoFeed.js

import React from 'react';
import ZoneCards from './ZoneCard';
import '../styles/zonecards.css';
import '../styles/videofeed.css';

export default function VideoFeed({ isDarkMode, camera1Zones = [], camera2Zones = [] }) {
  return (
    <div className={`video-feed-wrapper ${isDarkMode ? 'dark-video' : 'light-video'}`}>
      {/* Live Data Full Section Block */}
      <div className="live-data-wrapper">
        <div className="live-data-header">
          <span className="section-title">Live Data</span>
          <span className="status-dot"></span>
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
                  isDarkMode={isDarkMode}
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
                  isDarkMode={isDarkMode}
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
