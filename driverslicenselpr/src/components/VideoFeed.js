import React, { useState, useEffect } from 'react';
import ZoneCard from './ZoneCard';
import Surveillance from '../components/images/Surveillance.png';
import Thermal from '../components/images/Thermal.png';
import '../styles/zonecards.css';
import '../styles/videofeed.css';

export default function VideoFeed({
  isDarkMode,
  tempUnit,
  camera1Zones = [],
  camera2Zones = [],
  center = false, // <-- NEW
  // Camera panel control props added here
  show360Popup,
  setShow360Popup,
  selectedThermalCamera,
  setSelectedThermalCamera,
  isHoveringThermal,
  setIsHoveringThermal,
  selectedOpticalCamera,
  setSelectedOpticalCamera,
  isHoveringOptical,
  setIsHoveringOptical,
  filterZonesByCamera,
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
          <span className="section-livedata-tite">Live Data</span>
          <span
            className={`status-dot live-data-dot ${isAlertOn ? 'alert-on' : 'alert-off'}`}
            onClick={toggleAlert}
            style={{ cursor: 'pointer' }}
            title="Toggle Alert"
          />
        </div>

        <div className={`cameras-row${center ? ' center' : ''}`}>
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

      {/* Camera panels UI */}
      <div className="camera-streams-panel" style={{ marginTop: '20px' }}>
        <div className="stream-group" style={{ textAlign: 'center' }}>
          <h3>360° Stream</h3>
          <img
            src="/assets/cam-360.png"
            alt="360 Stream"
            style={{ width: '180px', borderRadius: '50%', marginBottom: '12px', background: '#e7ffe7' }}
          />
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '8px', padding: 0, margin: 0 }}>
            <button
              className="camera-btn"
              onClick={() => setShow360Popup(true)}
            >
              Camera 1
            </button>
          </div>
        </div>

        <div
          className="stream-group"
          style={{ textAlign: 'center', position: 'relative' }}
          onMouseEnter={() => setIsHoveringThermal(true)}
          onMouseLeave={() => setIsHoveringThermal(false)}
        >
          <h3>Thermal Stream</h3>
          <img
            src={Thermal}
            alt="Thermal Stream"
            style={{ width: '180px', borderRadius: '50%', marginBottom: '12px', background: '#e7ffe7' }}
          />
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '8px', padding: 0, margin: 0 }}>
            <button
              className="camera-btn"
              onClick={() => setSelectedThermalCamera((prev) => (prev === 'planck_1' ? null : 'planck_1'))}
            >
              Left Camera
            </button>
            <button
              className="camera-btn"
              onClick={() => setSelectedThermalCamera((prev) => (prev === 'planck_2' ? null : 'planck_2'))}
            >
              Right Camera
            </button>
          </div>
        </div>

        <div
          className="stream-group"
          style={{ textAlign: 'center', position: 'relative' }}
          onMouseEnter={() => setIsHoveringOptical(true)}
          onMouseLeave={() => setIsHoveringOptical(false)}
        >
          <h3>Optical Stream</h3>
          <img
            src={Surveillance}
            alt="Optical Stream"
            style={{ width: '180px', borderRadius: '50%', marginBottom: '12px', background: '#e7ffe7' }}
          />
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '8px', padding: 0, margin: 0 }}>
            <button
              className="camera-btn"
              onClick={() => setSelectedOpticalCamera((prev) => (prev === 'planck_1' ? null : 'planck_1'))}
            >
              Left Camera
            </button>
            <button
              className="camera-btn"
              onClick={() => setSelectedOpticalCamera((prev) => (prev === 'planck_2' ? null : 'planck_2'))}
            >
              Right Camera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
