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
  expandFullWidth = false,
}) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shiftRight = windowWidth >= 1400 && windowWidth <= 1500;

  const MAX_WINDOW_WIDTH = 8000;
  const BASE_WIDTH = 1250;
  const STEP_SIZE_WIDTH = 50;
  const STEP_INTERVAL_WIDTH = 50;
  const BASE_HEIGHT = 300;
  const STEP_SIZE_HEIGHT = 150;
  const STEP_INTERVAL_HEIGHT = 1000;

  const cameraStreamsWidth = shiftRight
    ? Math.max(300, 1400 - (windowWidth - 1400) * 14.4)
    : windowWidth > 1500
    ? (() => {
        const cappedWidth = Math.min(windowWidth, MAX_WINDOW_WIDTH);
        const extraWidth = ((cappedWidth - 1500) / STEP_INTERVAL_WIDTH) * STEP_SIZE_WIDTH;
        return BASE_WIDTH + extraWidth;
      })()
    : '100%';

  const cameraStreamsHeight = (() => {
    if (windowWidth <= 2000) return BASE_HEIGHT;
    const cappedWidth = Math.min(windowWidth, MAX_WINDOW_WIDTH);
    const extraHeight = ((cappedWidth - 2000) / STEP_INTERVAL_HEIGHT) * STEP_SIZE_HEIGHT;
    return BASE_HEIGHT + extraHeight;
  })();

  const extraWidth = typeof cameraStreamsWidth === 'number' ? cameraStreamsWidth - BASE_WIDTH : 0;
  const leftShift = extraWidth > 0 ? -extraWidth / 2 : 0;

  const cameraStreamsPanelStyle = {
    marginTop: '20px',
    position: 'relative',
    left: '9px',
    marginLeft: 'auto',
    marginRight: 0,
    width: typeof cameraStreamsWidth === 'number'
      ? (expandFullWidth ? `${cameraStreamsWidth + 465}px` : `${cameraStreamsWidth + 235}px`)
      : cameraStreamsWidth,

      transform: expandFullWidth
      ? `translateX(calc(${leftShift}px - 40px + 17px))`  // also subtract 10px as you want
      : `translateX(calc(${leftShift}px - 20px - 1px))`,
    
    overflowY: 'auto',

    height:
      windowWidth >= 1400 && windowWidth <= 1500
        ? expandFullWidth
          ? '360px'
          : '350px'
        : expandFullWidth
        ? '400px'
        : '300px',
  };

  // Increase width by 10px only when expandFullWidth true
  const cameraSectionStyle = {
    flexShrink: 0,
    boxSizing: 'border-box',
    maxWidth: expandFullWidth
      ? 'calc(50.2% - 44px + 15px + 10px)'  // +10px added width
      : 'calc(50% - 8px + 18px)',
    minWidth: expandFullWidth
      ? 'calc(45% - 40px + 15px + 10px)'    // +10px added width
      : '240px',
    width: expandFullWidth
      ? 'calc(100% - 40px + 15px + 10px)'   // +10px added width
      : undefined,
    overflow: 'hidden',
    display: 'flex',
    flexWrap: 'wrap',
    flexDirection: 'column',
    height: shiftRight ? '260px' : 'auto',
    position: 'relative',
    zIndex: 1000,
    ...(expandFullWidth && { marginLeft: '20px' }),
  };

  // Decrease gap by 10px only when expandFullWidth true (from ~15px to 0.5px)
  const camerasRowStyle = {
    display: 'flex',
    flexDirection: 'row',
    width: expandFullWidth ? 'calc(100% + 380px)' : 'calc(100% + 100px)',
    minWidth: expandFullWidth ? 'auto' : '1000px',
    alignItems: 'stretch',
    gap: expandFullWidth ? '0.5px' : undefined,  // reduced gap when true
    justifyContent: center ? 'center' : 'flex-start',
    flexWrap: 'nowrap',
    transform: expandFullWidth ? 'translateX(-200px)' : 'translateX(-85px)',
    height: '100%',
    position: 'relative',
    left: '0',
    zIndex: 1000,
  };

  const zoneGridStyle = expandFullWidth
    ? {
        flex: '1 1 auto',
        overflowY: 'auto',
        width: 'calc(100% - 40px + 15px)',
        marginLeft: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px 30px', // you can keep or tweak this independently
      }
    : {
        flex: '1 1 auto',
        overflowY: 'auto',
        width: '100%',
      };

  const zoneGridWrapperStyle = {
    marginLeft: 'auto',
    marginRight: 'auto',
    overflowX: 'auto',
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
    height: shiftRight ? 'calc(100% - 40px)' : 'auto',
    position: 'relative',
    zIndex: 1000,
    width: expandFullWidth ? '100%' : 'auto',
  };

  const liveDataWrapperStyle = {
    width:
      shiftRight
        ? `${1200 - (windowWidth - 1400) * 5 + 13}px`
        : windowWidth > 1500
        ? `${1200 + 13}px`
        : '100%',
    height: shiftRight ? '260px' : 'auto',
    overflow: 'visible',
    marginLeft: 'auto',
    marginRight: 'auto',
    position: 'relative',
    transform: expandFullWidth ? 'translateX(-20px)' : 'none',
  };

  const liveDataHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transform: expandFullWidth ? 'translateX(-150px)' : 'translateX(-43px)',
    ...(expandFullWidth && { marginLeft: '10px' }),
  };

  const statusDotStyle = {
    cursor: 'pointer',
    marginLeft: 0,
    transition: 'margin-left 0.3s ease',
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
        <div className="live-data-header" style={liveDataHeaderStyle}>
          <span className="section-livedata-tite">Live Data</span>
          <span
            className={`status-dot live-data-dot ${isAlertOn ? 'alert-on' : 'alert-off'}`}
            onClick={toggleAlert}
            style={statusDotStyle}
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
              transition: 'transform 0.3s ease, width 0.2s cubic-bezier(.42,0,.58,1)',
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
              <div
                className="zone-grid"
                style={{
                  ...zoneGridStyle,
                  backgroundColor: expandFullWidth ? 'yellow' : undefined,
                  ...(shiftRight ? { transform: 'translateX(-10px)' } : {}),
                }}
              >
                {camera1Zones.map((zone) => (
                  <ZoneCard
                    key={`${zone.camera}-${zone.name}`}
                    zone={zone}
                    tempUnit={tempUnit}
                    isDarkMode={isDarkMode}
                    isAlertOn={isAlertOn}
                    extraClass={zone.name.toLowerCase() === 'global' ? 'global-zone' : ''}
                    style={expandFullWidth ? { minWidth: '300px', border: '3px solid red' } : undefined}
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
              // Shift left by 2px ONLY when expandFullWidth is true
              transform: expandFullWidth ? 'translateX(-2px)' : 'translateX(10px)',
              transition: 'transform 0.3s ease, width 0.2s cubic-bezier(.42,0,.58,1)',
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
              }}
            >
              <div
                className="zone-grid"
                style={{
                  ...zoneGridStyle,
                  backgroundColor: expandFullWidth ? 'yellow' : undefined,
                  ...(shiftRight ? { transform: 'translateX(-10px)' } : {}),
                }}
              >
                {camera2Zones.map((zone) => (
                  <ZoneCard
                    key={`${zone.camera}-${zone.name}`}
                    zone={zone}
                    tempUnit={tempUnit}
                    isDarkMode={isDarkMode}
                    isAlertOn={isAlertOn}
                    extraClass={zone.name.toLowerCase() === 'global' ? 'global-zone' : ''}
                    style={
                      expandFullWidth
                        ? { minWidth: '280px', height: 'auto' }
                        : undefined
                    }
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
