import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import Navigation from './components/Navigation'
import VideoFeed from './components/VideoFeed'
import ThermalPlot from './components/ThermalPlot'
import SidebarPanel from './components/SidebarPanel'
import Footer from './components/Footer'
import SurveillanceStreams from './components/SurveillanceStreams'

import './styles/videofeed.css'
import './App.css'

function getRandomZones(arr, count) {
  const shuffled = arr.slice().sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.max(1, Math.min(count, arr.length)))
}

function pickZonesWithBothCameras(allZonesArr, count) {
  const cam1 = allZonesArr.filter(z => z.camera === 'planck_1')
  const cam2 = allZonesArr.filter(z => z.camera === 'planck_2')
  let picks = []
  if (cam1.length > 0) picks.push(cam1[Math.floor(Math.random() * cam1.length)])
  if (cam2.length > 0) picks.push(cam2[Math.floor(Math.random() * cam2.length)])
  const remainingZones = allZonesArr.filter(
    z => !picks.find(p => p.camera === z.camera && p.name === z.name)
  )
  const restCount = Math.max(0, count - picks.length)
  picks = picks.concat(getRandomZones(remainingZones, restCount))
  return picks
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

  const todayStr = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(() => localStorage.getItem('logStartDate') || todayStr)
  const [endDate, setEndDate] = useState(() => localStorage.getItem('logEndDate') || todayStr)
  const [filteredLogs, setFilteredLogs] = useState([])

  useEffect(() => {
    let mounted = true

    fetch('/SSAM.temperature_logs.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then(json => {
        console.log('JSON loaded:', json) // Log JSON data to debug
        if (!mounted) return

        const recent = Array.isArray(json) ? json.slice(-20) : []
        console.log('Recent entries:', recent.length)

        const validZoneMap = {}
        recent.forEach(entry => {
          const camera = entry.camera_id ? entry.camera_id.trim().toLowerCase() : null
          if (!camera) return
          ;(entry.zones || []).forEach(zoneObj => {
            const name = Object.keys(zoneObj)[0]
            const value = zoneObj[name]
            if (name && typeof value === 'number') {
              validZoneMap[`${camera}__${name}`] = { name, camera }
            }
          })
        })
        const validZonesArr = Object.values(validZoneMap)
        console.log('Valid zones:', validZonesArr.length)

        const zoneCount = Math.floor(Math.random() * 12) + 1
        const selectedZonesArr = pickZonesWithBothCameras(validZonesArr, zoneCount)
        console.log('Selected zones:', selectedZonesArr.length)

        setAllZones(selectedZonesArr)
        setVisibleZones(selectedZonesArr.map(z => z.name))

        const fullHistory = recent.map(entry => {
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

          const entryTime =
            entry.timestamp && entry.timestamp.$date
              ? new Date(entry.timestamp.$date)
              : new Date(NaN)

          return {
            time: entryTime,
            readings
          }
        })
        setHistory(fullHistory)

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
            name: z.name,
            camera: z.camera,
            temperature: typeof value === 'number' ? Math.round(value) : null,
            threshold: 75,
            lastTriggered: new Date().toLocaleString()
          }
        })
        setZones(curZones)
      })
      .catch(err => {
        console.error('Fetch or parsing error:', err) // Log errors for debugging
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

  if (zones.length === 0) {
    return <div>Loading zones...</div>
  }

  return (
    <>
      <Header
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        tempUnit={tempUnit}
        setTempUnit={setTempUnit}
      />
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
      />
      <div className="app-layout">
        <div className="main-content">
          {activeTab === 'dashboard' && (
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
          <div className="content-area">
            <div className="scroll-container">
              {activeTab === 'dashboard' && (
                <VideoFeed
                  isDarkMode={isDarkMode}
                  tempUnit={tempUnit}
                  camera1Zones={camera1Zones}
                  camera2Zones={camera2Zones}
                />
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
                <SurveillanceStreams
                  camera1Zones={camera1Zones}
                  camera2Zones={camera2Zones}
                />
              )}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  )
}
