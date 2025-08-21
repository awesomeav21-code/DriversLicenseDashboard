import React, { useState, useEffect, useRef } from 'react';
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
  expandFullWidth = false,
}) {

  const cameraStreamsRef = useRef(null);
  const leftGridRef = useRef(null);
  const rightGridRef = useRef(null);
  const leftHeaderRef = useRef(null);
  const rightHeaderRef = useRef(null);
  const leftCameraSectionRef = useRef(null);
  const rightCameraSectionRef = useRef(null);
  const camerasRowRef = useRef(null);

  const [isAlertOn, setIsAlertOn] = useState(() => {
    const saved = localStorage.getItem('isAlertOn');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('isAlertOn', isAlertOn);
  }, [isAlertOn]);

  // Use only the scaling from App.js - no additional scaling here
  // App.js already sets --content-scale CSS custom property

  const toggleAlert = () => setIsAlertOn(prev => !prev);

  return (
    <div className="video-feed-inner-wrapper">
      {/* Live data header outside of scaling wrapper */}
      <div className="live-data-header">
        <span className="section-livedata-title">Live Data</span>
        <span
          className={`status-dot ${isAlertOn ? 'alert-on' : 'alert-off'}`}
          onClick={toggleAlert}
          title="Toggle Alert"
        />
      </div>
      
      <div
        className={`video-feed-wrapper ${isDarkMode ? 'dark-video' : 'light-video'}`}
      >
        <div className={`live-data-wrapper ${expandFullWidth ? 'fullwidth' : ''}`}>

          <div className="cameras-scale-wrapper">
            <div
              ref={camerasRowRef}
              className={`cameras-row ${center ? 'center' : ''} ${
                expandFullWidth ? 'cameras-row--fullwidth' : ''
              }`}
            >
              <div
                ref={leftCameraSectionRef}
                className={`camera-section left-camera ${expandFullWidth ? 'camera-section--fullwidth' : ''}`}
              >
                <div className="camera-header" ref={leftHeaderRef}>
                  <span className="section-title">Left Camera</span>
                  <span className="status-dot" />
                </div>
                <div className={`zone-grid-wrapper ${expandFullWidth ? 'zone-grid-wrapper--fullwidth' : ''}`}>
                  <div ref={leftGridRef} className={`zone-grid ${expandFullWidth ? 'zone-grid--fullwidth' : ''}`}>
                    {camera1Zones.map((zone) => (
                      <ZoneCard
                        key={`${zone.camera}-${zone.name}`}
                        zone={zone}
                        tempUnit={tempUnit}
                        isDarkMode={isDarkMode}
                        expandFullWidth={expandFullWidth}
                        isAlertOn={isAlertOn}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div
                ref={rightCameraSectionRef}
                className={`camera-section right-camera ${expandFullWidth ? 'camera-section--fullwidth' : ''}`}
              >
                <div className="camera-header" ref={rightHeaderRef}>
                  <span className="section-title">Right Camera</span>
                  <span className="status-dot" />
                </div>
                <div className={`zone-grid-wrapper ${expandFullWidth ? 'zone-grid-wrapper--fullwidth' : ''}`}>
                  <div ref={rightGridRef} className={`zone-grid ${expandFullWidth ? 'zone-grid--fullwidth' : ''}`}>
                    {camera2Zones.map((zone) => (
                      <ZoneCard
                        key={`${zone.camera}-${zone.name}`}
                        zone={zone}
                        tempUnit={tempUnit}
                        isDarkMode={isDarkMode}
                        expandFullWidth={expandFullWidth}
                        isAlertOn={isAlertOn}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Camera streams panel outside of scaling wrapper */}
      <div 
        ref={cameraStreamsRef} 
        className={`camera-streams-panel ${expandFullWidth ? 'camera-streams-panel--fullwidth' : ''}`}
        style={{
          border: '3px solid #0066ff',
          animation: 'flash-blue 1s infinite'
        }}
      >
        <div className="stream-group">
          <h3>360° Stream</h3>
          <img src="/assets/cam-360.png" alt="360 Stream" />
          <div>
            <button 
              className="camera-btn" 
              onClick={() => setShow360Popup(true)}
              style={{
                position: 'relative',
                width: '120px',
                height: '32px',
                margin: '0',
                padding: '8px 16px',
                transform: 'none',
                left: '0',
                top: '0'
              }}
            >
              Camera 1
            </button>
          </div>
        </div>

        <div
          className="stream-group"
          onMouseEnter={() => setIsHoveringThermal(true)}
          onMouseLeave={() => setIsHoveringThermal(false)}
        >
          <h3>Thermal Stream</h3>
          <img src={Thermal} alt="Thermal Stream" />
          <div>
            <button
              className="camera-btn"
              onClick={() => setShow360Popup(true)}
              style={{
                position: 'relative',
                width: '120px',
                height: '32px',
                margin: '0',
                padding: '8px 16px',
                transform: 'none',
                left: '0',
                top: '0'
              }}
            >
              Left Camera
            </button>
            <button
              className="camera-btn"
              onClick={() => setShow360Popup(true)}
              style={{
                position: 'relative',
                width: '120px',
                height: '32px',
                margin: '0',
                padding: '8px 16px',
                transform: 'none',
                left: '0',
                top: '0'
              }}
            >
              Right Camera
            </button>
          </div>
        </div>

        <div
          className="stream-group"
          onMouseEnter={() => setIsHoveringOptical(true)}
          onMouseLeave={() => setIsHoveringOptical(false)}
        >
          <h3>Optical Stream</h3>
          <img src={Surveillance} alt="Optical Stream" />
          <div>
            <button
              className="camera-btn"
              onClick={() =>
                setSelectedOpticalCamera((prev) =>
                  prev === 'planck_1' ? null : 'planck_1'
                )
              }
              style={{
                position: 'relative',
                width: '120px',
                height: '32px',
                margin: '0',
                padding: '8px 16px',
                transform: 'none',
                left: '0',
                top: '0'
              }}
            >
              Left Camera
            </button>
            <button
              className="camera-btn"
              onClick={() =>
                setSelectedOpticalCamera((prev) =>
                  prev === 'planck_2' ? null : 'planck_2'
                )
              }
              style={{
                position: 'relative',
                width: '120px',
                height: '32px',
                margin: '0',
                padding: '8px 16px',
                transform: 'none',
                left: '0',
                top: '0'
              }}
            >
              Right Camera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}