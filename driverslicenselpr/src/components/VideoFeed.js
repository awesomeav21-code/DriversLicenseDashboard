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

  const getProportionalScale = () => {
    if (windowWidth >= 1424) {
      const extraPixels = windowWidth - 1424;
      const baseScale = 1;
      const scaleReduction = extraPixels * 0.00005;
      return baseScale - scaleReduction;
    }
    return 1;
  };

  const getDynamicWidth = () => {
    if (windowWidth >= 2136) {
      const extraPixels = windowWidth - 2136;
      const baseWidth = 100;
      const growthRate = 0.05;
      return `${baseWidth + (extraPixels * growthRate)}%`;
    } else if (windowWidth >= 1899) {
      const range = 2136 - 1899;
      const progress = (windowWidth - 1899) / range;
      const minWidth = 85;
      const maxWidth = 100;
      return `${minWidth + (progress * (maxWidth - minWidth))}%`;
    } else if (windowWidth >= 1582) {
      const extraPixels = windowWidth - 1582;
      const baseWidth = 80;
      const growthRate = 0.03;
      return `${baseWidth + (extraPixels * growthRate)}%`;
    } else if (windowWidth >= 1424) {
      const range = 1582 - 1424;
      const progress = (windowWidth - 1424) / range;
      const minWidth = 75;
      const maxWidth = 80;
      return `${minWidth + (progress * (maxWidth - minWidth))}%`;
    }
    return 'auto';
  };

  const getCameraStreamsBgColor = () => {
    if (windowWidth >= 2136) return 'pink';
    if (windowWidth >= 1899) return 'red';
    if (windowWidth >= 1582) return 'green';
    if (windowWidth >= 1424) return 'yellow';
    return '';
  };

  const getDynamicHeight = () => {
    if (windowWidth >= 2136) {
      const extraPixels = windowWidth - 2136;
      const baseHeight = 35;
      const heightGrowth = extraPixels * 0.01;
      return `${baseHeight + heightGrowth}vh`;
    } else if (windowWidth >= 1899) {
      const range = 2136 - 1899;
      const progress = (windowWidth - 1899) / range;
      const minHeight = 30;
      const maxHeight = 35;
      return `${minHeight + (progress * (maxHeight - minHeight))}vh`;
    } else if (windowWidth >= 1582) {
      const extraPixels = windowWidth - 1582;
      const baseHeight = 25;
      const heightGrowth = extraPixels * 0.008;
      return `${baseHeight + heightGrowth}vh`;
    } else if (windowWidth >= 1424) {
      const range = 1582 - 1424;
      const progress = (windowWidth - 1424) / range;
      const minHeight = 20;
      const maxHeight = 25;
      return `${minHeight + (progress * (maxHeight - minHeight))}vh`;
    }
    return 'auto';
  };

  const getDynamicPadding = () => {
    if (windowWidth >= 2136) {
      const extraPixels = windowWidth - 2136;
      const basePadding = 1.5;
      const paddingGrowth = extraPixels * 0.001;
      return `${basePadding + paddingGrowth}rem`;
    } else if (windowWidth >= 1899) {
      const range = 2136 - 1899;
      const progress = (windowWidth - 1899) / range;
      const minPadding = 1;
      const maxPadding = 1.5;
      return `${minPadding + (progress * (maxPadding - minPadding))}rem`;
    } else if (windowWidth >= 1582) {
      const extraPixels = windowWidth - 1582;
      const basePadding = 0.9;
      const paddingGrowth = extraPixels * 0.0005;
      return `${basePadding + paddingGrowth}rem`;
    } else if (windowWidth >= 1424) {
      const range = 1582 - 1424;
      const progress = (windowWidth - 1424) / range;
      const minPadding = 0.8;
      const maxPadding = 0.9;
      return `${minPadding + (progress * (maxPadding - minPadding))}rem`;
    }
    return '0.8rem';
  };

  const getDynamicFontScale = () => {
    if (windowWidth >= 2136) {
      const extraPixels = windowWidth - 2136;
      const baseFontSize = 1;
      const fontGrowth = extraPixels * 0.0002;
      return baseFontSize + fontGrowth;
    } else if (windowWidth >= 1899) {
      const range = 2136 - 1899;
      const progress = (windowWidth - 1899) / range;
      const minScale = 0.95;
      const maxScale = 1;
      return minScale + (progress * (maxScale - minScale));
    } else if (windowWidth >= 1582) {
      const extraPixels = windowWidth - 1582;
      const baseFontSize = 0.9;
      const fontGrowth = extraPixels * 0.0001;
      return baseFontSize + fontGrowth;
    } else if (windowWidth >= 1424) {
      const range = 1582 - 1424;
      const progress = (windowWidth - 1424) / range;
      const minScale = 0.85;
      const maxScale = 0.9;
      return minScale + (progress * (maxScale - minScale));
    }
    return 0.85;
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
  const containerStyle = { fontSize: `${sizing.fontSize}px` };
  const scale = getProportionalScale();

  return (
    <div className="video-feed-inner-wrapper" style={{ width: '100%' }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        background: 'black',
        color: 'white',
        padding: '4px 8px',
        fontSize: '12px',
        zIndex: 9999
      }}>
        Width: {windowWidth}px
      </div>

      <div className={`video-feed-wrapper ${isDarkMode ? 'dark-video' : 'light-video'}`} style={containerStyle}>
        <div className={`live-data-wrapper ${expandFullWidth ? 'fullwidth' : ''}`}>
          <div className="live-data-header">
            <span className="section-livedata-title">Live Data</span>
            <span className={`status-dot ${isAlertOn ? 'alert-on' : 'alert-off'}`} onClick={toggleAlert} title="Toggle Alert" />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            transition: 'transform 0.3s ease-in-out'
          }}>
            <div
              ref={camerasRowRef}
              className={`cameras-row ${center ? 'center' : ''} ${expandFullWidth ? 'fullwidth' : ''}`}
              style={{
                gap: '0',
                width: `${100 / scale}%`,
                transition: 'width 0.3s ease-in-out'
              }}
            >
              <div ref={leftCameraSectionRef} className="camera-section" style={{ flex: 1, minWidth: '50%' }}>
                <div className="camera-header" ref={leftHeaderRef}>
                  <span className="section-title">Left Camera</span>
                  <span className="status-dot" />
                </div>
                <div className="zone-grid-wrapper">
                  <div ref={leftGridRef} className="zone-grid">
                    {camera1Zones.map(zone => (
                      <ZoneCard key={`${zone.camera}-${zone.name}`} zone={zone} tempUnit={tempUnit} isDarkMode={isDarkMode} expandFullWidth={expandFullWidth} isAlertOn={isAlertOn} extraClass={zone.name.toLowerCase() === 'global' ? 'global-zone' : ''} sizing={sizing} />
                    ))}
                  </div>
                </div>
              </div>

              <div ref={rightCameraSectionRef} className="camera-section right-camera" style={{ flex: 1, minWidth: '50%' }}>
                <div className="camera-header" ref={rightHeaderRef}>
                  <span className="section-title">Right Camera</span>
                  <span className="status-dot" />
                </div>
                <div className="zone-grid-wrapper">
                  <div ref={rightGridRef} className="zone-grid">
                    {camera2Zones.map(zone => (
                      <ZoneCard key={`${zone.camera}-${zone.name}`} zone={zone} tempUnit={tempUnit} isDarkMode={isDarkMode} expandFullWidth={expandFullWidth} isAlertOn={isAlertOn} extraClass={zone.name.toLowerCase() === 'global' ? 'global-zone' : ''} sizing={sizing} />
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
          style={{ 
            backgroundColor: getCameraStreamsBgColor(),
            width: getDynamicWidth(),
            height: getDynamicHeight(),
            padding: getDynamicPadding(),
            fontSize: `${getDynamicFontScale()}rem`,
            transition: 'all 0.3s ease-in-out',
            boxSizing: 'border-box'
          }}
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
