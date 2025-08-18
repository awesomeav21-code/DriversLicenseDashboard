import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ZoneCard from './ZoneCard';
import Surveillance from '../components/images/Surveillance.png';
import Thermal from '../components/images/Thermal.png';
import '../styles/zonecards.css';
import '../styles/videofeed.css';

function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = useState({
    isHighDPI: false,
    screenType: 'desktop',
    pixelRatio: 1,
    screenSize: 'large',
    browserZoom: 1
  });

  useEffect(() => {
    const updateDeviceInfo = () => {
      const pixelRatio = window.devicePixelRatio || 1;
      const viewportWidth = window.innerWidth;

      let screenSize = 'large';
      if (viewportWidth < 768) screenSize = 'small';
      else if (viewportWidth < 1024) screenSize = 'medium';

      setDeviceInfo({
        isHighDPI: pixelRatio > 1.5,
        screenType: 'desktop',
        pixelRatio,
        screenSize,
        browserZoom: window.outerWidth / window.innerWidth
      });
    };

    updateDeviceInfo();
    window.addEventListener('resize', updateDeviceInfo);
    return () => window.removeEventListener('resize', updateDeviceInfo);
  }, []);

  return deviceInfo;
}

function useConsistentSizing() {
  const [sizing, setSizing] = useState({
    baseUnit: 16,
    cardWidth: 200,
    cardHeight: 120,
    fontSize: 14,
    spacing: 8
  });

  useEffect(() => {
    const baseUnit = 16;
    const scale = 1;
    setSizing({
      baseUnit,
      cardWidth: Math.round(200 * scale),
      cardHeight: Math.round(120 * scale),
      fontSize: Math.round(14 * scale),
      spacing: Math.round(8 * scale)
    });
  }, []);

  return sizing;
}

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

  const sizing = useConsistentSizing();
  const [cameraSectionHeight, setCameraSectionHeight] = useState(null);
  const [isAlertOn, setIsAlertOn] = useState(() => {
    const saved = localStorage.getItem('isAlertOn');
    return saved === 'true';
  });

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // ✅ shrink for both smaller and larger than 1424px
  const getProportionalScale = () => {
    const baseWidth = 1424;
    const minScale = 0.1; // prevent disappearing

    if (windowWidth === baseWidth) return 1;

    if (windowWidth < baseWidth) {
      // smaller screen → scale down
      return Math.max(minScale, windowWidth / baseWidth);
    } else {
      // larger screen → scale down as width grows
      return Math.max(minScale, baseWidth / windowWidth);
    }
  };

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('isAlertOn', isAlertOn);
  }, [isAlertOn]);

  useLayoutEffect(() => {
    const measure = () => {
      const lGridH = leftGridRef.current?.scrollHeight || 0;
      const rGridH = rightGridRef.current?.scrollHeight || 0;
      const lHeaderH = leftHeaderRef.current?.offsetHeight || 0;
      const rHeaderH = rightHeaderRef.current?.offsetHeight || 0;
      const paddingY = sizing.spacing * 2;
      const baseMin = expandFullWidth ? 280 : 260;
      const min = Math.round(baseMin);

      setCameraSectionHeight(Math.max(
        lHeaderH + lGridH + paddingY,
        rHeaderH + rGridH + paddingY,
        min
      ));
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (leftGridRef.current) ro.observe(leftGridRef.current);
    if (rightGridRef.current) ro.observe(rightGridRef.current);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [camera1Zones, camera2Zones, expandFullWidth, sizing.spacing]);

  const toggleAlert = () => setIsAlertOn(prev => !prev);
  const scale = getProportionalScale();

  return (
    <div 
      className="video-feed-inner-wrapper"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        transition: 'transform 0.6s ease-in-out'
      }}
    >
      <div className="debug-width">
        Width: {windowWidth}px | Scale: {scale.toFixed(4)}
      </div>

      <div className={`video-feed-wrapper ${isDarkMode ? 'dark-video' : 'light-video'}`}>
        <div className={`live-data-wrapper ${expandFullWidth ? 'fullwidth' : ''}`}>
          <div className="live-data-header">
            <span className="section-livedata-title">Live Data</span>
            <span
              className={`status-dot ${isAlertOn ? 'alert-on' : 'alert-off'}`}
              onClick={toggleAlert}
              title="Toggle Alert"
            />
          </div>

          <div className="cameras-scale-wrapper">
            <div
              ref={camerasRowRef}
              className={`cameras-row ${center ? 'center' : ''} ${expandFullWidth ? 'fullwidth' : ''}`}
            >
              <div 
                ref={leftCameraSectionRef} 
                className="camera-section left-camera"
              >
                <div className="camera-header" ref={leftHeaderRef}>
                  <span className="section-title">Left Camera</span>
                  <span className="status-dot" />
                </div>
                <div className="zone-grid-wrapper">
                  <div ref={leftGridRef} className="zone-grid">
                    {camera1Zones.map(zone => (
                      <ZoneCard 
                        key={`${zone.camera}-${zone.name}`} 
                        zone={zone} 
                        tempUnit={tempUnit} 
                        isDarkMode={isDarkMode} 
                        expandFullWidth={expandFullWidth} 
                        isAlertOn={isAlertOn} 
                        extraClass={zone.name.toLowerCase() === 'global' ? 'global-zone' : ''} 
                        sizing={sizing} 
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div 
                ref={rightCameraSectionRef} 
                className="camera-section right-camera"
              >
                <div className="camera-header" ref={rightHeaderRef}>
                  <span className="section-title">Right Camera</span>
                  <span className="status-dot" />
                </div>
                <div className="zone-grid-wrapper">
                  <div ref={rightGridRef} className="zone-grid">
                    {camera2Zones.map(zone => (
                      <ZoneCard 
                        key={`${zone.camera}-${zone.name}`} 
                        zone={zone} 
                        tempUnit={tempUnit} 
                        isDarkMode={isDarkMode} 
                        expandFullWidth={expandFullWidth} 
                        isAlertOn={isAlertOn} 
                        extraClass={zone.name.toLowerCase() === 'global' ? 'global-zone' : ''} 
                        sizing={sizing} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div 
          ref={cameraStreamsRef} 
          className="camera-streams-panel"
        >
          <div className="stream-group">
            <h3>360° Stream</h3>
            <img src="/assets/cam-360.png" alt="360 Stream" />
            <div>
              <button className="camera-btn" onClick={() => setShow360Popup(true)}>Camera 1</button>
            </div>
          </div>

          <div className="stream-group" onMouseEnter={() => setIsHoveringThermal(true)} onMouseLeave={() => setIsHoveringThermal(false)}>
            <h3>Thermal Stream</h3>
            <img src={Thermal} alt="Thermal Stream" />
            <div>
              <button className="camera-btn" onClick={() => setShow360Popup(true)}>Left Camera</button>
            </div>
          </div>

          <div className="stream-group" onMouseEnter={() => setIsHoveringOptical(true)} onMouseLeave={() => setIsHoveringOptical(false)}>
            <h3>Optical Stream</h3>
            <img src={Surveillance} alt="Optical Stream" />
            <div>
              <button className="camera-btn" onClick={() => setSelectedOpticalCamera(prev => (prev === 'planck_1' ? null : 'planck_1'))}>Left Camera</button>
              <button className="camera-btn" onClick={() => setSelectedOpticalCamera(prev => (prev === 'planck_2' ? null : 'planck_2'))}>Right Camera</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
