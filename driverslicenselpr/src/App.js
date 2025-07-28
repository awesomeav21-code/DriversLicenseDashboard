import React, { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import Navigation from './components/Navigation'
import VideoFeed from './components/VideoFeed'
import ThermalPlot from './components/ThermalPlot'
import SidebarPanel from './components/SidebarPanel'
import Footer from './components/Footer'
import SurveillanceStreams from './components/SurveillanceStreams'
import Surveillance from './components/images/Surveillance.png'
import Thermal from './components/images/Thermal.png'
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
    <div
      style={{
        margin: 8,
        border: '1px solid #ccc',
        borderRadius: 6,
        padding: 4,
        width: 320,
        textAlign: 'center',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{zone.name}</div>
      <video
        src={zone.videoFeedUrl || 'https://www.w3schools.com/html/mov_bbb.mp4'}
        controls
        width="300"
        height="170"
        style={{ borderRadius: 6, background: '#000' }}
        autoPlay
        muted
        loop
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}

// New icon: square box with left-pointing arrow
function ArrowBoxIcon({ size = 32, color = "#233046" }) {
  const boxSize = size
  const arrowSize = size * 0.4
  const arrowX = size * 0.55
  const arrowY = size * 0.3

  return (
    <svg width={boxSize} height={boxSize} viewBox={`0 0 ${boxSize} ${boxSize}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Square */}
      <rect
        x="0"
        y="0"
        width={boxSize}
        height={boxSize}
        rx={4}
        ry={4}
        fill={color}
      />
      {/* Left-pointing arrow */}
      <path
        d={`
          M ${arrowX} ${arrowY}
          L ${arrowX - arrowSize} ${boxSize / 2}
          L ${arrowX} ${boxSize - arrowY}
        `}
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function HamburgerMenu({
  show,
  locked,
  onHover,
  onUnhover,
  onClick,
}) {
  const visible = show || locked
  return (
    <div
      className="hamburger-area"
      onMouseEnter={onHover}
      onMouseLeave={onUnhover}
    >
      <div
        className={`hamburger-menu${visible ? ' open' : ''}${locked ? ' locked' : ''}`}
        onClick={e => {
          e.stopPropagation()
          onClick()
        }}
        title="Show/Hide Event Logs"
        style={{ position: 'relative', top: '-28px' }}
      >
        <ArrowBoxIcon size={31} />
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard')
  const [zones, setZones] = useState([])
  const [allZones, setAllZones] = useState([])
  const [history, setHistory] = useState([])
  const [visibleZones, setVisibleZones] = useState([])
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [tempUnit, setTempUnit] = useState('F')
  const [selectedCamera, setSelectedCamera] = useState(() => {
    const saved = localStorage.getItem('selectedCamera')
    return saved || 'planck_1'
  })

  // Popup states
  const [show360Popup, setShow360Popup] = useState(false)
  const [selectedThermalCamera, setSelectedThermalCamera] = useState(null)
  const [selectedOpticalCamera, setSelectedOpticalCamera] = useState(null)
  
  // Fullscreen state for all popups
  const [isFullscreen, setIsFullscreen] = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(() => localStorage.getItem('logStartDate') || todayStr)
  const [endDate, setEndDate] = useState(() => localStorage.getItem('logEndDate') || todayStr)
  const [filteredLogs, setFilteredLogs] = useState([])

  // Hamburger state (persisted to localStorage)
  const [hamburgerHovered, setHamburgerHovered] = useState(false)
  const [hamburgerLocked, setHamburgerLocked] = useState(() => {
    const saved = localStorage.getItem('hamburgerLocked')
    return saved === null ? true : saved === 'true'
  })
  const [eventLogsVisible, setEventLogsVisible] = useState(() => {
    const saved = localStorage.getItem('eventLogsVisible')
    return saved === null ? true : saved === 'true'
  })

  // Persist hamburgerLocked and eventLogsVisible to localStorage
  useEffect(() => {
    localStorage.setItem('hamburgerLocked', hamburgerLocked)
    localStorage.setItem('eventLogsVisible', eventLogsVisible)
  }, [hamburgerLocked, eventLogsVisible])

  useEffect(() => {
    let mounted = true

    fetch('/SSAM.temperature_logs.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then((json) => {
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
        setVisibleZones(selectedZonesArr.map((z) => z.name))

        const fullHistory = recent.map((entry) => {
          const camera = entry.camera_id ? entry.camera_id.trim().toLowerCase() : null
          const readings = {}
          selectedZonesArr.forEach((z) => {
            let found = null
            if (camera === z.camera) {
              ;(entry.zones || []).forEach((zoneObj) => {
                if (Object.keys(zoneObj)[0] === z.name) found = zoneObj[z.name]
              })
            }
            readings[z.name] = typeof found === 'number' ? Math.round(found) : null
          })

          const entryTime =
            entry.timestamp && entry.timestamp.$date ? new Date(entry.timestamp.$date) : new Date(NaN)

          return {
            time: entryTime,
            readings,
          }
        })
        setHistory(fullHistory)

        const curZones = selectedZonesArr.map((z) => {
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
            temperature: typeof value === 'number' ? Math.round(value) : null,
            threshold: 75,
            lastTriggered: new Date().toLocaleString(),
          }
        })
        setZones(curZones)
      })
      .catch(() => {
        setZones([])
        setAllZones([])
        setHistory([])
        setVisibleZones([])
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('selectedCamera', selectedCamera)
  }, [selectedCamera])

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
    document.body.classList.toggle('dark-mode', isDarkMode)
    document.body.classList.toggle('light-mode', !isDarkMode)
  }, [activeTab, isDarkMode])

  useEffect(() => {
    if (!startDate || !endDate || !history.length) {
      setFilteredLogs([])
      return
    }

    const startDateObj = new Date(startDate + 'T00:00:00')
    const endDateObj = new Date(endDate + 'T23:59:59.999')

    const filtered = history
      .filter((entry) => {
        if (!(entry.time instanceof Date) || isNaN(entry.time)) return false
        return (
          entry.time >= startDateObj &&
          entry.time <= endDateObj &&
          visibleZones.some((zoneName) => entry.readings[zoneName] != null)
        )
      })
      .map((entry) => {
        const messageZones = visibleZones
          .filter((zoneName) => entry.readings[zoneName] != null)
          .map((zoneName) => `${zoneName}: ${entry.readings[zoneName]}`)
          .join('; ')
        return {
          timestamp: entry.time.toLocaleString(),
          message: messageZones || 'No data',
        }
      })

    setFilteredLogs(filtered)
  }, [startDate, endDate, history, visibleZones])

  function addZone() {}

  const camera1Zones = zones.filter((z) => z.camera?.trim().toLowerCase() === 'planck_1')
  const camera2Zones = zones.filter((z) => z.camera?.trim().toLowerCase() === 'planck_2')

  const filterZonesByCamera = (cameraName) => zones.filter((z) => z.camera?.trim().toLowerCase() === cameraName)

  // Hamburger handlers
  const handleHamburgerHover = () => setHamburgerHovered(true)
  const handleHamburgerUnhover = () => {
    if (!hamburgerLocked) setHamburgerHovered(false)
  }
  const handleHamburgerClick = () => {
    setHamburgerLocked(prevLocked => {
      const willLock = !prevLocked
      setEventLogsVisible(willLock)
      return willLock
    })
  }

  // Removed refs and effect related to camera panels

  return (
    <>
      <Header isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} tempUnit={tempUnit} setTempUnit={setTempUnit} />
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} isDarkMode={isDarkMode} />
      <div className="app-layout">
        <div className="main-content">
          {activeTab === 'dashboard' && (
            <div className="sidebarpanel-hamburger-row">
              {eventLogsVisible && (
                <SidebarPanel
                  isDarkMode={isDarkMode}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  logs={filteredLogs}
                  visibleZones={visibleZones}
                  addZone={addZone}
                  onDatePick={(start, end) => {
                    setStartDate(start)
                    setEndDate(end)
                  }}
                />
              )}
              <HamburgerMenu
                show={hamburgerHovered}
                locked={hamburgerLocked}
                onHover={handleHamburgerHover}
                onUnhover={handleHamburgerUnhover}
                onClick={handleHamburgerClick}
              />
            </div>
          )}
          <div className="content-area">
            <div className="scroll-container">
              {activeTab === 'dashboard' && (
                <div className={`big-dashboard-container${!eventLogsVisible ? ' big-dashboard-container--fullwidth' : ''}`}>
                  <div>
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
              {activeTab === 'streams' && <SurveillanceStreams camera1Zones={camera1Zones} camera2Zones={camera2Zones} />}
            </div>
          </div>
        </div>
        <Footer />
      </div>

      {/* 360° Camera Popup */}
      {show360Popup && (
        <FixedPopup
          style={{
            position: 'fixed',
            top: isFullscreen ? 0 : '100px',
            right: isFullscreen ? 0 : '20px',
            left: isFullscreen ? 0 : 'auto',
            bottom: isFullscreen ? 0 : 'auto',
            width: isFullscreen ? '100vw' : '700px',
            height: isFullscreen ? '100vh' : 'auto',
            maxHeight: isFullscreen ? '100vh' : '80vh',
            backgroundColor: isDarkMode ? '#0f172a' : '#fff',
            border: '2px solid #333',
            boxShadow: isDarkMode ? '0 4px 12px rgba(255,255,255,0.15)' : '0 4px 12px rgba(0,0,0,0.3)',
            padding: '16px',
            overflowY: 'auto',
            borderRadius: '8px',
            zIndex: 100000,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.3rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                color: isDarkMode ? '#fff' : '#333',
                marginRight: '10px',
                lineHeight: 1,
              }}
              onClick={() => {
                setShow360Popup(false)
                setIsFullscreen(false)
              }}
              aria-label="Close"
            >
              ×
            </button>
            <button
              onClick={() => setIsFullscreen(prev => !prev)}
              aria-label="Toggle Fullscreen"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.3rem',
                cursor: 'pointer',
                color: isDarkMode ? '#fff' : '#333',
                lineHeight: 1,
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? '🞬' : '⬜'}
            </button>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4, color: isDarkMode ? '#eee' : '#000' }}>
              360° Camera 1
            </div>
            <video
              src="https://www.w3schools.com/html/mov_bbb.mp4"
              controls
              width={isFullscreen ? '100%' : '650'}
              height={isFullscreen ? '100%' : '350'}
              style={{ borderRadius: 6, background: '#000' }}
              autoPlay
              muted
              loop
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </FixedPopup>
      )}

      {/* Thermal Camera Popup */}
      {selectedThermalCamera && (
        <FixedPopup
          style={{
            position: 'fixed',
            top: isFullscreen ? 0 : '100px',
            right: isFullscreen ? 0 : '20px',
            left: isFullscreen ? 0 : 'auto',
            bottom: isFullscreen ? 0 : 'auto',
            width: isFullscreen ? '100vw' : '700px',
            height: isFullscreen ? '100vh' : 'auto',
            maxHeight: isFullscreen ? '100vh' : '80vh',
            backgroundColor: isDarkMode ? '#0f172a' : '#fff',
            border: '2px solid #333',
            boxShadow: isDarkMode ? '0 4px 12px rgba(255,255,255,0.15)' : '0 4px 12px rgba(0,0,0,0.3)',
            padding: '16px',
            overflowY: 'auto',
            zIndex: 100000,
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button
              onClick={() => {
                setSelectedThermalCamera(null)
                setIsFullscreen(false)
              }}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: isDarkMode ? '#fff' : '#333',
                marginRight: '10px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <button
              onClick={() => setIsFullscreen(prev => !prev)}
              aria-label="Toggle Fullscreen"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: isDarkMode ? '#fff' : '#333',
                lineHeight: 1,
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? '🞬' : '⬜'}
            </button>
          </div>
          {filterZonesByCamera(selectedThermalCamera).map((zone) => (
            <ZoneVideoFeed key={zone.name} zone={zone} />
          ))}
        </FixedPopup>
      )}

      {/* Optical Camera Popup */}
      {selectedOpticalCamera && (
        <FixedPopup
          style={{
            position: 'fixed',
            top: isFullscreen ? 0 : '100px',
            right: isFullscreen ? 0 : '20px',
            left: isFullscreen ? 0 : 'auto',
            bottom: isFullscreen ? 0 : 'auto',
            width: isFullscreen ? '100vw' : '700px',
            height: isFullscreen ? '100vh' : 'auto',
            maxHeight: isFullscreen ? '100vh' : '80vh',
            backgroundColor: isDarkMode ? '#0f172a' : '#fff',
            border: '2px solid #333',
            boxShadow: isDarkMode ? '0 4px 12px rgba(255,255,255,0.15)' : '0 4px 12px rgba(0,0,0,0.3)',
            padding: '16px',
            overflowY: 'auto',
            zIndex: 100000,
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button
              onClick={() => {
                setSelectedOpticalCamera(null)
                setIsFullscreen(false)
              }}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: isDarkMode ? '#fff' : '#333',
                marginRight: '10px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <button
              onClick={() => setIsFullscreen(prev => !prev)}
              aria-label="Toggle Fullscreen"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: isDarkMode ? '#fff' : '#333',
                lineHeight: 1,
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? '🞬' : '⬜'}
            </button>
          </div>
          {filterZonesByCamera(selectedOpticalCamera).map((zone) => (
            <ZoneVideoFeed key={zone.name} zone={zone} />
          ))}
        </FixedPopup>
      )}
    </>
  )
}