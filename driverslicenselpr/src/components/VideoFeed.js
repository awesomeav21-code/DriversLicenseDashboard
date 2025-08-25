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
          <h3 style={{
            fontSize: 'clamp(0.5rem, 0.7vw, 0.8rem)',
            marginBottom: '5px',
            maxWidth: 'clamp(4rem, 5vw, 8rem)',
            minWidth: 'clamp(3rem, 3.5vw, 4rem)'
          }}>360° Stream</h3>
                      <img 
            src="/assets/cam-360.png" 
            alt="360 Stream" 
            style={{
              width: 'clamp(80px, 12vw, 350px)', /* CHANGED LARGER - test */
              height: 'clamp(60px, 10vw, 330px)', /* CHANGED LARGER - test */
              marginBottom: '5px'
            }}
          />
          <div style={{
            gap: '5px',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <button 
              className="camera-btn" 
              onClick={() => setShow360Popup(true)}
              style={{
                width: 'clamp(3.5rem, 6vw, 7rem)',
                height: 'clamp(1.5rem, 2.2vw, 2.5rem)',
                fontSize: 'clamp(0.35rem, 0.5vw, 0.6rem)',
                padding: 'clamp(0.15rem, 0.4vw, 0.5rem) clamp(0.3rem, 0.8vw, 1rem)'
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
          <h3 style={{
            fontSize: 'clamp(0.5rem, 0.7vw, 0.8rem)',
            marginBottom: '5px',
            maxWidth: 'clamp(4rem, 5vw, 8rem)',
            minWidth: 'clamp(3rem, 3.5vw, 4rem)'
          }}>Thermal Stream</h3>
          <img 
            src={Thermal} 
            alt="Thermal Stream" 
            style={{
              width: 'clamp(80px, 12vw, 350px)', /* CHANGED LARGER - test */
              height: 'clamp(60px, 10vw, 330px)', /* CHANGED LARGER - test */
              marginBottom: '5px'
            }}
          />
          <div style={{
            gap: '5px',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <button
              className="camera-btn"
              onClick={() => setShow360Popup(true)}
              style={{
                width: 'clamp(4rem, 6vw, 7rem)',
                height: 'clamp(1.8rem, 2.2vw, 2.5rem)',
                fontSize: 'clamp(0.4rem, 0.5vw, 0.6rem)',
                padding: 'clamp(0.2rem, 0.4vw, 0.5rem) clamp(0.4rem, 0.8vw, 1rem)'
              }}
            >
              Left Camera
            </button>
            <button
              className="camera-btn"
              onClick={() => setShow360Popup(true)}
              style={{
                width: 'clamp(4rem, 6vw, 7rem)',
                height: 'clamp(1.8rem, 2.2vw, 2.5rem)',
                fontSize: 'clamp(0.4rem, 0.5vw, 0.6rem)',
                padding: 'clamp(0.2rem, 0.4vw, 0.5rem) clamp(0.4rem, 0.8vw, 1rem)'
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
          <h3 style={{
            fontSize: 'clamp(0.5rem, 0.7vw, 0.8rem)',
            marginBottom: '5px',
            maxWidth: 'clamp(4rem, 5vw, 8rem)',
            minWidth: 'clamp(3rem, 3.5vw, 4rem)'
          }}>Optical Stream</h3>
          <img 
            src={Surveillance} 
            alt="Optical Stream" 
            style={{
              width: 'clamp(80px, 12vw, 350px)', /* CHANGED LARGER - test */
              height: 'clamp(60px, 10vw, 330px)', /* CHANGED LARGER - test */
              marginBottom: '5px'
            }}
          />
          <div style={{
            gap: '5px',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <button
              className="camera-btn"
              onClick={() =>
                setSelectedOpticalCamera((prev) =>
                  prev === 'planck_1' ? null : 'planck_1'
                )
              }
              style={{
                width: 'clamp(4rem, 6vw, 7rem)',
                height: 'clamp(1.8rem, 2.2vw, 2.5rem)',
                fontSize: 'clamp(0.4rem, 0.5vw, 0.6rem)',
                padding: 'clamp(0.2rem, 0.4vw, 0.5rem) clamp(0.4rem, 0.8vw, 1rem)'
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
                width: 'clamp(4rem, 6vw, 7rem)',
                height: 'clamp(1.8rem, 2.2vw, 2.5rem)',
                fontSize: 'clamp(0.4rem, 0.5vw, 0.6rem)',
                padding: 'clamp(0.2rem, 0.4vw, 0.5rem) clamp(0.4rem, 0.8vw, 1rem)'
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