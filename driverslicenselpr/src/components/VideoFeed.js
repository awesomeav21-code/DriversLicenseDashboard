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
  center = false,
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
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shiftRight = windowWidth >= 1400 && windowWidth <= 1500;

  const cameraSectionStyle = {
    flexShrink: 0,
    boxSizing: 'border-box',
    maxWidth: 'calc(50% - 8px + 18px)',
    minWidth: '238px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: windowWidth >= 1400 && windowWidth <= 1500 ? '260px' : 'auto',
    position: 'relative',
    zIndex: 1000,
  };

  const zoneGridWrapperStyle = {
    marginLeft: 'auto',
    marginRight: 'auto',
    overflowX: 'auto',
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
    height: windowWidth >= 1400 && windowWidth <= 1500 ? 'calc(100% - 40px)' : 'auto',
    position: 'relative',
    zIndex: 1000,
  };

  const zoneGridStyle = {
    flex: '1 1 auto',
    overflowY: 'auto',
  };

  const liveDataWrapperStyle = {
    width:
      windowWidth >= 1400 && windowWidth <= 1500
        ? `${1200 - (windowWidth - 1400) * 5 + 13}px`
        : windowWidth > 1500
        ? `${1200 + 13}px`
        : '100%',
    height: windowWidth >= 1400 && windowWidth <= 1500 ? '260px' : 'auto',
    overflow: 'visible',
    marginLeft: 'auto',
    marginRight: 'auto',
    position: 'relative',
    transition: 'width 0.3s ease, transform 0.3s ease, height 0.3s ease',
    transform: shiftRight ? 'translateX(-20px)' : 'none',
  };

  const videoFeedWrapperStyle = {
    width: windowWidth > 1400 ? '1400px' : '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    position: 'relative',
    transition: 'transform 0.3s ease, height 0.3s ease',
    transform: shiftRight ? 'translateX(15px)' : 'none',
    height: 'auto',
    overflow: 'visible',
  };

  const camerasRowStyle = {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    alignItems: 'stretch',
    gap: '16px',
    justifyContent: center ? 'center' : 'flex-start',
    flexWrap: 'nowrap',
    transform: 'translateX(-15px)',
    height: '100%',
    position: 'relative',
    zIndex: 1000,
  };

  // Your requested cameraStreamsPanelStyle with smooth decrease only in 1500-1600px range
  const cameraStreamsPanelStyle = {
    marginTop: '20px',
    width: (() => {
      if (windowWidth >= 1400 && windowWidth <= 1500) {
        // Keep original 1400-1500 logic untouched
        return `${Math.max(300, 1400 - (windowWidth - 1400) * 14.4)}px`;
      } else if (windowWidth > 1500 && windowWidth <= 1600) {
        // Smoothly decrease width from 1300px down to 1240px between 1500 and 1600px
        const baseWidth = 1300;
        const maxDecrease = 60;
        const progress = (windowWidth - 1500) / 100; // 0 to 1
        return `${baseWidth - progress * maxDecrease}px`;
      } else if (windowWidth > 1600) {
        // Fix width at 1240px after 1600px
        return '1240px';
      } else {
        // Below 1400px full width
        return '100%';
      }
    })(),
    maxWidth: '1400px',
    marginLeft: 'auto',
    marginRight: 'auto',
    overflowY: 'auto',
    transition: 'width 0.3s ease, transform 0.3s ease',
    transform: 'translateX(-14px)',
  };

  const [isAlertOn, setIsAlertOn] = useState(() => {
    const saved = localStorage.getItem('isAlertOn');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('isAlertOn', isAlertOn);
  }, [isAlertOn]);

  const toggleAlert = () => setIsAlertOn((prev) => !prev);

  return (
    <div
      className={`video-feed-wrapper ${isDarkMode ? 'dark-video' : 'light-video'}`}
      style={videoFeedWrapperStyle}
    >
      <div className="live-data-wrapper" style={liveDataWrapperStyle}>
        <div
          className="live-data-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            transform: 'translateX(10px)',
            transition: 'transform 0.3s ease',
          }}
        >
          <span
            className="section-livedata-tite"
            style={shiftRight ? { transform: 'translateX(15px)', transition: 'transform 0.3s ease' } : {}}
          >
            Live Data
          </span>
          <span
            className={`status-dot live-data-dot ${isAlertOn ? 'alert-on' : 'alert-off'}`}
            onClick={toggleAlert}
            style={{
              cursor: 'pointer',
              marginLeft: shiftRight ? '15px' : '0',
              transition: 'margin-left 0.3s ease',
            }}
            title="Toggle Alert"
          />
        </div>

        <div className={`cameras-row${center ? ' center' : ''}`} style={camerasRowStyle}>
          {/* Left Camera Section */}
          <div
            className="camera-section"
            style={{
              ...cameraSectionStyle,
              transform: 'translateX(10px)',
              transition: 'transform 0.3s ease',
            }}
          >
            <div className="camera-header">
              <span className="section-title">Left Camera</span>
              <span className="status-dot"></span>
            </div>
            <div
              className="zone-grid-wrapper"
              style={{
                ...zoneGridWrapperStyle,
                transform: 'translateX(10px)',
                transition: 'transform 0.3s ease',
              }}
            >
              <div className="zone-grid" style={zoneGridStyle}>
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
          </div>

          {/* Right Camera Section */}
          <div
            className="camera-section right-camera"
            style={{
              ...cameraSectionStyle,
              transform: 'translateX(10px)',
              transition: 'transform 0.3s ease',
            }}
          >
            <div className="camera-header">
              <span className="section-title">Right Camera</span>
              <span className="status-dot"></span>
            </div>
            <div
              className="zone-grid-wrapper"
              style={{
                ...zoneGridWrapperStyle,
                transform: 'translateX(10px)',
                transition: 'transform 0.3s ease',
              }}
            >
              <div className="zone-grid" style={zoneGridStyle}>
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

      <div className="camera-streams-panel" style={cameraStreamsPanelStyle}>
        {/* 360 Stream */}
        <div className="stream-group" style={{ textAlign: 'center' }}>
          <h3>360° Stream</h3>
          <img
            src="/assets/cam-360.png"
            alt="360 Stream"
            style={{ width: '180px', borderRadius: '50%', marginBottom: '12px', background: '#e7ffe7' }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: '8px',
              padding: 0,
              margin: 0,
            }}
          >
            <button className="camera-btn" onClick={() => setShow360Popup(true)}>
              Camera 1
            </button>
          </div>
        </div>

        {/* Thermal Stream */}
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: '8px',
              padding: 0,
              margin: 0,
            }}
          >
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

        {/* Optical Stream */}
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: '8px',
              padding: 0,
              margin: 0,
            }}
          >
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
