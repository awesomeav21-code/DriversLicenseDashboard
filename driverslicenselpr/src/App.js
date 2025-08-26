import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import Navigation from './components/Navigation'
import VideoFeed from './components/VideoFeed'
import ThermalPlot from './components/ThermalPlot'
import SidebarPanel from './components/SidebarPanel'
import Footer from './components/Footer'
import SurveillanceStreams from './components/SurveillanceStreams'
import FixedPopup from './components/FixedPopup'
import './styles/videofeed.css'
import './App.css'

function pickZonesAtLeastOnePerCameraUniqueNames(allZonesArr, count) {
  const cameras = ['planck_1', 'planck_2']
  const byName = new Map()
  allZonesArr.forEach((z) => {
    if (!byName.has(z.name)) byName.set(z.name, [])
    byName.get(z.name).push(z)
  })

  const picks = []
  const usedNames = new Set()

  cameras.forEach((cam) => {
    const candidates = Array.from(byName.values())
      .map((arr) => arr.find((z) => z.camera === cam))
      .filter(Boolean)
      .filter((z) => !usedNames.has(z.name))
    if (candidates.length) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)]
      picks.push(pick)
      usedNames.add(pick.name)
    }
  })

  const remaining = Array.from(byName.entries())
    .filter(([name]) => !usedNames.has(name))
    .map(([name, arr]) => arr[0])
  const shuffled = remaining.sort(() => 0.5 - Math.random())

  for (let z of shuffled) {
    if (picks.length >= count) break
    picks.push(z)
    usedNames.add(z.name)
  }

  return picks
}

function ZoneVideoFeed({ zone }) {
  return (
    <div className="zone-video-feed">
      <div className="zone-video-title">{zone.name}</div>
      <video
        className="zone-video-player"
        src={zone.videoFeedUrl || 'https://www.w3schools.com/html/mov_bbb.mp4'}
        controls
        width="300"
        height="170"
        autoPlay
        muted
        loop
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}

function LeftArrowIcon({ size = 24, color = "#233046" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function RightArrowIcon({ size = 24, color = "#233046" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function HamburgerMenu({ show, locked, onHover, onUnhover, onClick }) {
  const visible = show || locked
  
  const buttonStyle = {
    width: '40px',
    height: '40px',
    minWidth: '40px',
    minHeight: '40px',
    maxWidth: '40px',
    maxHeight: '40px',
    borderRadius: '50%', // Make it a perfect circle
    border: '2px solid #eee',
    boxShadow: '0 4px 8px rgba(20,30,50,0.11)',
    marginTop: '-50px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 10
  }
  
  const arrowStyle = {
    width: 'clamp(24px, 2.5vw, 32px)',
    height: 'clamp(24px, 2.5vw, 32px)'
  }
  
  return (
    <div
      className="hamburger-area"
      onMouseEnter={onHover}
      onMouseLeave={onUnhover}
    >
      <div
        className={`hamburger-menu${visible ? ' open' : ''}${locked ? ' locked' : ''}`}
        style={buttonStyle}
        onClick={e => {
          e.stopPropagation()
          console.log('Hamburger menu clicked!')
          onClick()
        }}
        title="Show/Hide Event Logs"
      >
        {locked ? (
          <RightArrowIcon size={24} color="#233046" style={arrowStyle} />
        ) : (
          <LeftArrowIcon size={24} color="#233046" style={arrowStyle} />
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard')
  const [zones, setZones] = useState([])
  const [allZones, setAllZones] = useState([])
  const [history, setHistory] = useState(() => {
    const stored = localStorage.getItem('thermalHistory')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        return parsed.map(entry => ({
          ...entry,
          time: new Date(entry.time)
        }))
      } catch {
        return []
      }
    }
    return []
  })
  const [visibleZones, setVisibleZones] = useState([])
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [tempUnit, setTempUnit] = useState('F')
  const [selectedCamera, setSelectedCamera] = useState(() => {
    const saved = localStorage.getItem('selectedCamera')
    return saved || 'planck_1'
  })
  const [show360Popup, setShow360Popup] = useState(false)
  const [popup360Minimized, setPopup360Minimized] = useState(false)
  const [selectedThermalCamera, setSelectedThermalCamera] = useState(null)
  const [popupThermalMinimized, setPopupThermalMinimized] = useState(false)
  const [selectedOpticalCamera, setSelectedOpticalCamera] = useState(null)
  const [popupOpticalMinimized, setPopupOpticalMinimized] = useState(false)
  const [startDate, setStartDate] = useState(() => localStorage.getItem('logStartDate') || '')
  const [endDate, setEndDate] = useState(() => localStorage.getItem('logEndDate') || '')
  const [filteredLogs, setFilteredLogs] = useState([])
  const [hamburgerHovered, setHamburgerHovered] = useState(false)
  const [hamburgerLocked, setHamburgerLocked] = useState(() => {
    const saved = localStorage.getItem('hamburgerLocked')
    return saved === null ? true : saved === 'true'
  })
  const [eventLogsVisible, setEventLogsVisible] = useState(() => {
    const saved = localStorage.getItem('eventLogsVisible')
    return saved === null ? true : saved === 'true'
  })

  

  useEffect(() => {
    localStorage.setItem('hamburgerLocked', hamburgerLocked)
    localStorage.setItem('eventLogsVisible', eventLogsVisible)
  }, [hamburgerLocked, eventLogsVisible])

  useEffect(() => {
    if (startDate) localStorage.setItem('logStartDate', startDate)
    else localStorage.removeItem('logStartDate')
    if (endDate) localStorage.setItem('logEndDate', endDate)
    else localStorage.removeItem('logEndDate')
  }, [startDate, endDate])

  useEffect(() => {
    localStorage.setItem('selectedCamera', selectedCamera)
  }, [selectedCamera])

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
    document.body.classList.toggle('dark-mode', isDarkMode)
    document.body.classList.toggle('light-mode', !isDarkMode)
  }, [activeTab, isDarkMode])

  useEffect(() => {
    try {
      const trimmed = history.slice(-500)
      localStorage.setItem('thermalHistory', JSON.stringify(trimmed))
    } catch (e) {
      console.error('Storage quota exceeded for thermalHistory, clearing old data', e)
      localStorage.removeItem('thermalHistory')
    }
  }, [history])

  const zoneCameraMap = {}
  zones.forEach(z => {
    if (z.name && z.camera) {
      zoneCameraMap[z.name] = z.camera.trim().toLowerCase()
    }
  })

  useEffect(() => {
    let mounted = true
    fetch('/SSAM.temperature_logs.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!mounted) return
        const recent = Array.isArray(json) ? json.slice(-100) : []
        const validZones = []
        recent.forEach((entry) => {
          const camera = entry.camera_id ? entry.camera_id.trim().toLowerCase() : null
          if (!camera) return
          ;(entry.zones || []).forEach((zoneObj) => {
            const name = Object.keys(zoneObj)[0]
            const value = zoneObj[name]
            if (name && typeof value === 'number') {
              validZones.push({ name, camera, videoFeedUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' })
            }
          })
        })
        const zoneCount = Math.floor(Math.random() * 12) + 1
        const selectedZonesArr = pickZonesAtLeastOnePerCameraUniqueNames(validZones, zoneCount)
        setAllZones(selectedZonesArr)
        const allZoneNames = new Set([
          ...selectedZonesArr.map(z => z.name),
          ...history.flatMap(entry => Object.keys(entry.readings || {})),
        ])
        setVisibleZones(Array.from(allZoneNames))
        const testEntries = [
          {
            time: new Date(new Date().setDate(new Date().getDate() - 2)),
            readings: selectedZonesArr.reduce((acc, z) => {
              acc[z.name] = Math.floor(Math.random() * 100)
              return acc
            }, {})
          },
          {
            time: new Date(new Date().setDate(new Date().getDate() - 1)),
            readings: selectedZonesArr.reduce((acc, z) => {
              acc[z.name] = Math.floor(Math.random() * 100)
              return acc
            }, {})
          }
        ]
        const combinedHistory = [
          ...history,
          ...testEntries,
          ...recent.map(entry => {
            const camera = entry.camera_id ? entry.camera_id.trim().toLowerCase() : null
            const readings = {}
            selectedZonesArr.forEach(z => {
              let found = null
              if (camera === z.camera) {
                ;(entry.zones || []).forEach(zoneObj => {
                  if (Object.keys(zoneObj)[0] === z.name) found = zoneObj[z.name]
                })
              }
              readings[z.name] = typeof found === 'number' ? Math.round(found) : null
            })
            const entryTime = entry.timestamp && entry.timestamp.$date ? new Date(entry.timestamp.$date) : new Date(NaN)
            return { time: entryTime, readings }
          })
        ]
        combinedHistory.sort((a, b) => a.time - b.time)
        setHistory(combinedHistory)
        const curZones = selectedZonesArr.map(z => {
          let value = null
          for (let i = recent.length - 1; i >= 0; i--) {
            const entry = recent[i]
            const camera = entry.camera_id ? entry.camera_id.trim().toLowerCase() : null
            if (camera === z.camera) {
              for (const zoneObj of entry.zones || []) {
                if (Object.keys(zoneObj)[0] === z.name) {
                  value = zoneObj[z.name]
                  break
                }
              }
              if (value !== null) break
            }
          }
          return {
            ...z,
            camera: z.camera?.trim().toLowerCase(),
            temperature: typeof value === 'number' ? Math.round(value) : null,
            threshold: 75,
            lastTriggered: new Date().toLocaleString()
          }
        })
        setZones(curZones)
      })
      .catch(() => {
        setZones([])
        setAllZones([])
      })
    return () => {
      mounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!startDate || !endDate || !history.length) {
      setFilteredLogs([])
      return
    }
    const startDateObj = new Date(startDate + 'T00:00:00')
    const endDateObj = new Date(endDate + 'T23:59:59.999')
    const filtered = history
      .filter(entry => {
        if (!(entry.time instanceof Date) || isNaN(entry.time)) return false
        return (
          entry.time >= startDateObj &&
          entry.time <= endDateObj &&
          visibleZones.some(zoneName => entry.readings[zoneName] != null)
        )
      })
      .map(entry => {
        const messageZones = visibleZones
          .filter(zoneName => entry.readings[zoneName] != null)
          .map(zoneName => `${zoneName}: ${entry.readings[zoneName]}`)
          .join('; ')
        return { timestamp: entry.time.toLocaleString(), message: messageZones || 'No data' }
      })
    setFilteredLogs(filtered)
  }, [startDate, endDate, history, visibleZones])

  function addZone() {}

  const camera1Zones = zones.filter(z => z.camera?.trim().toLowerCase() === 'planck_1')
  const camera2Zones = zones.filter(z => z.camera?.trim().toLowerCase() === 'planck_2')
  const filterZonesByCamera = cameraName => zones.filter(z => z.camera?.trim().toLowerCase() === cameraName)

  // Add responsive margin logic for dashboard container
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate responsive left margin for dashboard container
  const getDashboardLeftMargin = () => {
    const screenWidth = windowWidth;
    
    // Use smaller margins to prevent excessive shrinking on smaller screens
    if (screenWidth >= 1920) {
      return '0.3vw'; // Large screens - reduced margin
    } else if (screenWidth >= 1600) {
      return '0.4vw'; // Medium-large screens - reduced margin
    } else if (screenWidth >= 1366) {
      return '0.5vw'; // Standard laptop screens - reduced margin
    } else if (screenWidth >= 1024) {
      return '0.6vw'; // Small laptop screens - reduced margin
    } else if (screenWidth >= 768) {
      return '0.7vw'; // Tablet screens - reduced margin
    } else {
      return '0.8vw'; // Mobile and small screens - reduced margin
    }
  };




  // Set fixed horizontal gaps that never change with screen size
  useEffect(() => {
    document.documentElement.style.setProperty('--horizontal-gap', '10px');
    document.documentElement.style.setProperty('--hamburger-margin', '10px');
    document.documentElement.style.setProperty('--dashboard-left-margin', '21px');
  }, []);

  // Header movement disabled - keeping fixed position
  // useEffect(() => {
  //   const calculateHeaderOffset = () => {
  //     const screenWidth = window.innerWidth;
  //     const baseWidth = 1200; // Base width where movement starts
  //     const movementPer100px = -1; // Move up 1px for every 100px increase (reduced from -2)
  //     
  //     if (screenWidth <= baseWidth) {
  //       return 0; // No movement below base width
  //     }
  //     
  //     const extraWidth = screenWidth - baseWidth;
  //     const offset = Math.floor(extraWidth / 100) * movementPer100px;
  //     return Math.max(offset, -10); // Limit maximum upward movement to 10px (reduced from -20)
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

  // Add blue flash effect when margin changes
  const [isFlashing, setIsFlashing] = useState(false);
  
  useEffect(() => {
    // Flash blue when window width changes
    console.log('Window width changed to:', windowWidth, 'Margin will be:', getDashboardLeftMargin());
    setIsFlashing(true);
    const timer = setTimeout(() => setIsFlashing(false), 800);
    return () => clearTimeout(timer);
  }, [windowWidth]);

  const handleHamburgerHover = () => setHamburgerHovered(true)
  const handleHamburgerUnhover = () => { if (!hamburgerLocked) setHamburgerHovered(false) }
  const handleHamburgerClick = () => {
    setHamburgerLocked(prevLocked => {
      const willLock = !prevLocked
      setEventLogsVisible(willLock)
      return willLock
    })
  }

  return (
    <>
      <Header isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} tempUnit={tempUnit} setTempUnit={setTempUnit} />
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} isDarkMode={isDarkMode} />

      <div className="app-layout">
        <HamburgerMenu
          show={hamburgerHovered}
          locked={hamburgerLocked}
          onHover={handleHamburgerHover}
          onUnhover={handleHamburgerUnhover}
          onClick={handleHamburgerClick}
        />
        <div className="main-content">
          {activeTab === 'dashboard' && eventLogsVisible && (
            <SidebarPanel
              isDarkMode={isDarkMode}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              logs={filteredLogs}
              visibleZones={visibleZones}
              zones={zones}
              history={history}
              addZone={addZone}
              zoneCameraMap={zoneCameraMap}
              onDatePick={(start, end) => { setStartDate(start); setEndDate(end) }}
            />
          )}
          <div className="content-area">
            {activeTab === 'dashboard' && (
              <div className="dashboard-wrapper">
                <div 
                  className={`big-dashboard-container${!eventLogsVisible ? ' --fullwidth' : ''}`}
                  style={{ 
                    marginLeft: `${getDashboardLeftMargin()}`,
                    marginRight: !eventLogsVisible ? `${getDashboardLeftMargin()}` : '0px',
                    width: !eventLogsVisible ? 'calc(100% + 300px)' : 'auto',
                    maxWidth: '100%',
                    transition: 'margin-left 0.3s ease, margin-right 0.3s ease, width 0.3s ease !important',
                    zIndex: 1000,
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >

                  <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                    <VideoFeed
                      isDarkMode={isDarkMode}
                      tempUnit={tempUnit}
                      camera1Zones={camera1Zones}
                      camera2Zones={camera2Zones}
                      show360Popup={show360Popup}
                      setShow360Popup={setShow360Popup}
                      selectedThermalCamera={selectedThermalCamera}
                      setSelectedThermalCamera={setSelectedThermalCamera}
                      isHoveringThermal={false}
                      setIsHoveringThermal={() => {}}
                      selectedOpticalCamera={selectedOpticalCamera}
                      setSelectedOpticalCamera={setSelectedOpticalCamera}
                      isHoveringOptical={false}
                      setIsHoveringOptical={() => {}}
                      filterZonesByCamera={filterZonesByCamera}
                    />
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'thermal' && (
              <ThermalPlot
                zones={zones}
                visibleZones={visibleZones}
                setVisibleZones={setVisibleZones}
                allZones={allZones}
                tempUnit={tempUnit}
                startDate={startDate}
                endDate={endDate}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
                isDarkMode={isDarkMode}
                selectedCamera={selectedCamera}
                setSelectedCamera={setSelectedCamera}
                history={history}
              />
            )}
            {activeTab === 'streams' && (
              <SurveillanceStreams camera1Zones={camera1Zones} camera2Zones={camera2Zones} />
            )}
          </div>
        </div>
        <Footer />
      </div>

      {show360Popup && (
        <FixedPopup className={`popup-360 ${popup360Minimized ? 'minimized' : ''}`}>
          <div className="popup-header">
            <div className="popup-title">360° Camera 1</div>
            <div>
              <button onClick={() => setPopup360Minimized(!popup360Minimized)}>
                {popup360Minimized ? '⬜' : '—'}
              </button>
              <button onClick={() => { setShow360Popup(false); setPopup360Minimized(false) }}>×</button>
            </div>
          </div>
          <div className="popup-body">
            <video src="https://www.w3schools.com/html/mov_bbb.mp4" controls autoPlay muted loop>
              Your browser does not support the video tag.
            </video>
          </div>
        </FixedPopup>
      )}

      {selectedThermalCamera && (
        <FixedPopup className={`popup-thermal ${popupThermalMinimized ? 'minimized' : ''}`}>
          <div className="popup-header">
            <div className="popup-title">Thermal Camera</div>
            <div>
              <button onClick={() => setPopupThermalMinimized(!popupThermalMinimized)}>
                {popupThermalMinimized ? '⬜' : '—'}
              </button>
              <button onClick={() => { setSelectedThermalCamera(null); setPopupThermalMinimized(false) }}>×</button>
            </div>
          </div>
          <div className="popup-body">
            {filterZonesByCamera(selectedThermalCamera).map(zone => (
              <ZoneVideoFeed key={zone.name} zone={zone} />
            ))}
          </div>
        </FixedPopup>
      )}

      {selectedOpticalCamera && (
        <FixedPopup className={`popup-optical ${popupOpticalMinimized ? 'minimized' : ''}`}>
          <div className="popup-header">
            <div className="popup-title">Optical Camera</div>
            <div>
              <button onClick={() => setPopupOpticalMinimized(!popupOpticalMinimized)}>
                {popupOpticalMinimized ? '⬜' : '—'}
              </button>
              <button onClick={() => { setSelectedOpticalCamera(null); setPopupOpticalMinimized(false) }}>×</button>
            </div>
          </div>
          <div className="popup-body">
            {filterZonesByCamera(selectedOpticalCamera).map(zone => (
              <ZoneVideoFeed key={zone.name} zone={zone} />
            ))}
          </div>
        </FixedPopup>
      )}
    </>
  )
}