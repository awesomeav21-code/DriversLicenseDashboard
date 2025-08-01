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
    <div className="m-2 border border-gray-300 rounded-md p-1 w-[320px] text-center">
      <div className="font-bold mb-1">{zone.name}</div>
      <video
        src={zone.videoFeedUrl || 'https://www.w3schools.com/html/mov_bbb.mp4'}
        controls
        width="300"
        height="170"
        className="rounded-md bg-black"
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
        className={`hamburger-menu${visible ? ' open' : ''}${locked ? ' locked' : ''} bg-white rounded-md p-1 w-10 h-10 flex items-center justify-center shadow-sm cursor-pointer relative -top-6`}
        onClick={e => {
          e.stopPropagation()
          onClick()
        }}
        title="Show/Hide Event Logs"
      >
        <LeftArrowIcon size={24} color="#233046" />
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
    localStorage.setItem('thermalHistory', JSON.stringify(history))
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

            return {
              time: entryTime,
              readings
            }
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
  }, [])

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
        return {
          timestamp: entry.time.toLocaleString(),
          message: messageZones || 'No data'
        }
      })

    setFilteredLogs(filtered)
  }, [startDate, endDate, history, visibleZones])

  function addZone() {}

  const camera1Zones = zones.filter(z => z.camera?.trim().toLowerCase() === 'planck_1')
  const camera2Zones = zones.filter(z => z.camera?.trim().toLowerCase() === 'planck_2')

  const filterZonesByCamera = cameraName => zones.filter(z => z.camera?.trim().toLowerCase() === cameraName)

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
                  zones={zones}
                  history={history}
                  addZone={addZone}
                  zoneCameraMap={zoneCameraMap}
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

      {show360Popup && (
        <FixedPopup
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: popup360Minimized ? '400px' : '100vw',
            height: popup360Minimized ? '240px' : '100vh',
            backgroundColor: '#fff',
            border: '2px solid #333',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            padding: '0',
            borderRadius: '0',
            zIndex: 100000,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ddd',
            padding: '8px 12px',
            userSelect: 'none',
            flexShrink: 0,
            borderBottom: '1px solid #ccc',
            position: 'sticky',
            top: 0,
            zIndex: 100001,
          }}>
            <div style={{ fontWeight: 'bold' }}>360° Camera 1</div>
            <div>
              <button
                onClick={() => setPopup360Minimized(!popup360Minimized)}
                aria-label={popup360Minimized ? 'Maximize popup' : 'Minimize popup'}
                style={{
                  cursor: 'pointer',
                  fontSize: '20px',
                  background: '#bbb',
                  border: '1px solid #888',
                  borderRadius: '4px',
                  padding: '0 8px',
                  minWidth: '28px',
                  height: '28px',
                  marginRight: '10px',
                  userSelect: 'none',
                }}
              >
                {popup360Minimized ? '⬜' : '—'}
              </button>
              <button
                onClick={() => {
                  setShow360Popup(false)
                  setPopup360Minimized(false)
                }}
                aria-label="Close popup"
                style={{
                  cursor: 'pointer',
                  fontSize: '20px',
                  background: '#bbb',
                  border: '1px solid #888',
                  borderRadius: '4px',
                  padding: '0 8px',
                  minWidth: '28px',
                  height: '28px',
                  userSelect: 'none',
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', background: '#000' }}>
            <video
              src="https://www.w3schools.com/html/mov_bbb.mp4"
              controls
              style={{ width: '100%', height: '100%', borderRadius: 0 }}
              autoPlay
              muted
              loop
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </FixedPopup>
      )}

      {selectedThermalCamera && (
        <FixedPopup
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: popupThermalMinimized ? '400px' : '100vw',
            height: popupThermalMinimized ? '240px' : '100vh',
            backgroundColor: '#fff',
            border: '2px solid #333',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            padding: '0',
            borderRadius: '0',
            zIndex: 100000,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ddd',
            padding: '8px 12px',
            userSelect: 'none',
            flexShrink: 0,
            borderBottom: '1px solid #ccc',
            position: 'sticky',
            top: 0,
            zIndex: 100001,
          }}>
            <div style={{ fontWeight: 'bold' }}>Thermal Camera</div>
            <div>
              <button
                onClick={() => setPopupThermalMinimized(!popupThermalMinimized)}
                aria-label={popupThermalMinimized ? 'Maximize popup' : 'Minimize popup'}
                style={{
                  cursor: 'pointer',
                  fontSize: '20px',
                  background: '#bbb',
                  border: '1px solid #888',
                  borderRadius: '4px',
                  padding: '0 8px',
                  minWidth: '28px',
                  height: '28px',
                  marginRight: '10px',
                  userSelect: 'none',
                }}
              >
                {popupThermalMinimized ? '⬜' : '—'}
              </button>
              <button
                onClick={() => {
                  setSelectedThermalCamera(null)
                  setPopupThermalMinimized(false)
                }}
                aria-label="Close popup"
                style={{
                  cursor: 'pointer',
                  fontSize: '20px',
                  background: '#bbb',
                  border: '1px solid #888',
                  borderRadius: '4px',
                  padding: '0 8px',
                  minWidth: '28px',
                  height: '28px',
                  userSelect: 'none',
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#fff',
          }}>
            {filterZonesByCamera(selectedThermalCamera).map(zone => (
              <ZoneVideoFeed key={zone.name} zone={zone} />
            ))}
          </div>
        </FixedPopup>
      )}

      {selectedOpticalCamera && (
        <FixedPopup
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: popupOpticalMinimized ? '400px' : '100vw',
            height: popupOpticalMinimized ? '240px' : '100vh',
            backgroundColor: '#fff',
            border: '2px solid #333',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            padding: '0',
            borderRadius: '0',
            zIndex: 100000,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ddd',
            padding: '8px 12px',
            userSelect: 'none',
            flexShrink: 0,
            borderBottom: '1px solid #ccc',
            position: 'sticky',
            top: 0,
            zIndex: 100001,
          }}>
            <div style={{ fontWeight: 'bold' }}>Optical Camera</div>
            <div>
              <button
                onClick={() => setPopupOpticalMinimized(!popupOpticalMinimized)}
                aria-label={popupOpticalMinimized ? 'Maximize popup' : 'Minimize popup'}
                style={{
                  cursor: 'pointer',
                  fontSize: '20px',
                  background: '#bbb',
                  border: '1px solid #888',
                  borderRadius: '4px',
                  padding: '0 8px',
                  minWidth: '28px',
                  height: '28px',
                  marginRight: '10px',
                  userSelect: 'none',
                }}
              >
                {popupOpticalMinimized ? '⬜' : '—'}
              </button>
              <button
                onClick={() => {
                  setSelectedOpticalCamera(null)
                  setPopupOpticalMinimized(false)
                }}
                aria-label="Close popup"
                style={{
                  cursor: 'pointer',
                  fontSize: '20px',
                  background: '#bbb',
                  border: '1px solid #888',
                  borderRadius: '4px',
                  padding: '0 8px',
                  minWidth: '28px',
                  height: '28px',
                  userSelect: 'none',
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#fff',
          }}>
            {filterZonesByCamera(selectedOpticalCamera).map(zone => (
              <ZoneVideoFeed key={zone.name} zone={zone} />
            ))}
          </div>
        </FixedPopup>
      )}
    </>
  )
}

