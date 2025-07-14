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

// Helper: randomly pick N zones from array
function getRandomZones(arr, count) {
  const shuffled = arr.slice().sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.max(1, Math.min(count, arr.length)));
}

// New helper: always include at least 1 from each camera if possible
function pickZonesWithBothCameras(allZonesArr, count) {
  const cam1 = allZonesArr.filter(z => z.camera === 'planck_1');
  const cam2 = allZonesArr.filter(z => z.camera === 'planck_2');
  let picks = [];
  if (cam1.length > 0) picks.push(cam1[Math.floor(Math.random() * cam1.length)]);
  if (cam2.length > 0) picks.push(cam2[Math.floor(Math.random() * cam2.length)]);
  const remainingZones = allZonesArr.filter(
    z => !picks.find(p => p.camera === z.camera && p.name === z.name)
  );
  const restCount = Math.max(0, count - picks.length);
  picks = picks.concat(getRandomZones(remainingZones, restCount));
  return picks;
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

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [filteredLogs, setFilteredLogs] = useState([])

  useEffect(() => {
    let mounted = true

    fetch('/SSAM.temperature_logs.json')
      .then(res => res.json())
      .then(json => {
        if (!mounted) return

        const recent = Array.isArray(json) ? json.slice(-20) : [];

        // Only those zones with actual numeric data
        const validZoneMap = {};
        recent.forEach(entry => {
          const camera = entry.camera_id ? entry.camera_id.trim().toLowerCase() : null
          if (!camera) return
          (entry.zones || []).forEach(zoneObj => {
            const name = Object.keys(zoneObj)[0]
            const value = zoneObj[name]
            if (name && typeof value === 'number') {
              validZoneMap[`${camera}__${name}`] = { name, camera }
            }
          })
        });
        const validZonesArr = Object.values(validZoneMap);

        // Pick 1-12 zones, guarantee both cameras if possible
        const zoneCount = Math.floor(Math.random() * 12) + 1; // 1..12
        const selectedZonesArr = pickZonesWithBothCameras(validZonesArr, zoneCount);

        setAllZones(selectedZonesArr);
        setVisibleZones(selectedZonesArr.map(z => z.name));

        // Build history, rounding values
        const fullHistory = recent.map(entry => {
          const camera = entry.camera_id ? entry.camera_id.trim().toLowerCase() : null;
          const readings = {};
          selectedZonesArr.forEach(z => {
            let found = null
            if (camera === z.camera) {
              (entry.zones || []).forEach(zoneObj => {
                if (Object.keys(zoneObj)[0] === z.name) found = zoneObj[z.name]
              })
            }
            readings[z.name] = typeof found === 'number' ? Math.round(found) : null
          });
          return {
            time: new Date(entry.time || entry.timestamp),
            readings
          }
        });
        setHistory(fullHistory);

        // For each selected zone, find latest value from the correct camera, rounding it
        if (recent.length) {
          const curZones = selectedZonesArr.map(z => {
            let value = null
            for (let i = recent.length - 1; i >= 0; i--) {
              const entry = recent[i];
              const camera = entry.camera_id ? entry.camera_id.trim().toLowerCase() : null;
              if (camera === z.camera) {
                for (const zoneObj of (entry.zones || [])) {
                  if (Object.keys(zoneObj)[0] === z.name) {
                    value = zoneObj[z.name];
                    break;
                  }
                }
                if (value !== null) break;
              }
            }
            return {
              name: z.name,
              camera: z.camera,
              temperature: typeof value === 'number' ? Math.round(value) : null
            }
          })
          setZones(curZones)
        } else {
          setZones(selectedZonesArr.map(z => ({
            name: z.name,
            camera: z.camera,
            temperature: null
          })))
        }
      })
      .catch(err => {
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
    if (!startDate || !endDate) {
      setFilteredLogs([]);
      return
    }
    const start = new Date(startDate + 'T00:00:00').getTime()
    const end = new Date(endDate + 'T23:59:59').getTime()
    if (start > end) {
      setFilteredLogs([])
      return
    }
    setFilteredLogs([]);
  }, [startDate, endDate, zones])

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
                <SurveillanceStreams />
              )}
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
