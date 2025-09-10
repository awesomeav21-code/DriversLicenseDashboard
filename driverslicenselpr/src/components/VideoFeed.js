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

  // Header movement disabled - keeping fixed position
  // useEffect(() => {
  //   const calculateHeaderOffset = () => {
  //     const screenWidth = window.innerWidth;
  //     const baseWidth = 1200; // Base width where movement starts
  //     const movementPer100px = -1; // Move up 1px for every 100px increase
  //     
  //     if (screenWidth <= baseWidth) {
  //       return 0; // No movement below base width
  //     }
  //     
  //     const extraWidth = screenWidth - baseWidth;
  //     const offset = Math.floor(extraWidth / 100) * movementPer100px;
  //     return Math.max(offset, -10); // Limit maximum upward movement to 10px
  //   };

  //   const updateHeaderOffset = () => {
  //     const offset = calculateHeaderOffset();
  //     document.documentElement.style.setProperty('--header-offset', `${offset}px`);
  //   };

  //   // Update immediately
  //   updateHeaderOffset();
  //   
  //   // Update on window resize
  //   window.addEventListener('resize', updateHeaderOffset);
  //   
  //   return () => window.removeEventListener('resize', updateHeaderOffset);
  // }, []);

  // Use only the scaling from App.js - no additional scaling here
  // App.js already sets --content-scale CSS custom property

  const toggleAlert = () => setIsAlertOn(prev => !prev);

  // Dynamic positioning for camera sections based on screen size
  const [cameraSectionOffset, setCameraSectionOffset] = useState(0);

  useEffect(() => {
    const calculateCameraOffset = () => {
      const screenWidth = window.innerWidth;
      const movementPerVw = -0.01; // Move 0.01vw for every 1vw increase in screen width
      
      // Calculate movement using viewport units for consistent scaling across devices
      // Truly continuous, no breakpoints
      const offset = screenWidth * movementPerVw / 100;
      
      return Math.round(offset);
    };

    const updateCameraOffset = () => {
      const offset = calculateCameraOffset();
      setCameraSectionOffset(offset);
    };

    // Update immediately
    updateCameraOffset();
    
    // Update on window resize
    window.addEventListener('resize', updateCameraOffset);
    
    return () => window.removeEventListener('resize', updateCameraOffset);
  }, []);

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
              style={{
                marginTop: `${cameraSectionOffset}px`
              }}
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
                    {camera1Zones
                      .sort((a, b) => {
                        // Put Global card at the end
                        if (a.name.toLowerCase() === 'global') return 1;
                        if (b.name.toLowerCase() === 'global') return -1;
                        return 0;
                      })
                      .map((zone) => (
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
                    {camera2Zones
                      .sort((a, b) => {
                        // Put Global card at the end
                        if (a.name.toLowerCase() === 'global') return 1;
                        if (b.name.toLowerCase() === 'global') return -1;
                        return 0;
                      })
                      .map((zone) => (
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
      >
        <div 
          className="stream-group"
          style={{
            width: '180px',
            minWidth: '180px',
            maxWidth: '180px',
            padding: '8px',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px'
          }}
        >
          <h3>360° Stream</h3>
                      <img 
            src="/assets/cam-360.png" 
            alt="360 Stream TEST" 
            className="dynamic-stream-image"
          />
          <div style={{
            justifyContent: 'center',
            alignItems: 'center'
          }}>
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
          onMouseEnter={() => setIsHoveringThermal(true)}
          onMouseLeave={() => setIsHoveringThermal(false)}
          style={{
            width: '180px',
            minWidth: '180px',
            maxWidth: '180px',
            padding: '8px',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px'
          }}
        >
          <h3>Thermal Stream</h3>
          <img 
            src={Thermal} 
            alt="Thermal Stream" 
            className="dynamic-stream-image"
          />
          <div style={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingLeft: '10px'
          }}>
            <button
              className="camera-btn left-camera-btn"
              onClick={() => setShow360Popup(true)}
            >
              Left Camera
            </button>
            <button
              className="camera-btn right-camera-btn"
              onClick={() => setShow360Popup(true)}
            >
              Right Camera
            </button>
          </div>
        </div>

        <div
          className="stream-group"
          onMouseEnter={() => setIsHoveringOptical(true)}
          onMouseLeave={() => setIsHoveringOptical(false)}
          style={{
            width: '180px',
            minWidth: '180px',
            maxWidth: '180px',
            padding: '8px',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px'
          }}
        >
          <h3>Optical Stream</h3>
          <img 
            src={Surveillance} 
            alt="Optical Stream" 
            className="dynamic-stream-image"
          />
          <div style={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingLeft: '10px'
          }}>
            <button
              className="camera-btn left-camera-btn"
              onClick={() =>
                setSelectedOpticalCamera((prev) =>
                  prev === 'planck_1' ? null : 'planck_1'
                )
              }
            >
              Left Camera
            </button>
            <button
              className="camera-btn right-camera-btn"
              onClick={() =>
                setSelectedOpticalCamera((prev) =>
                  prev === 'planck_2' ? null : 'planck_2'
                )
              }
            >
              Right Camera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}