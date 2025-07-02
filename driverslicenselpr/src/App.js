// src/App.js

import React, { useState, useEffect } from 'react'
import Header       from './components/Header'
import Navigation   from './components/Navigation'
import VideoFeed    from './components/VideoFeed'
import ThermalPlot  from './components/ThermalPlot'
import SidebarPanel from './components/SidebarPanel'
import Footer       from './components/Footer'
import './styles/videofeed.css'
import './App.css'

export default function App() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('activeTab') || 'dashboard'
  )
  const [zones, setZones] = useState([])
  const [history, setHistory] = useState([])
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [tempUnit, setTempUnit] = useState('F')

  function getTemp() {
    return Math.round(140 + Math.random() * 20 - 10)
  }

  function nowTime() {
    return new Date().toLocaleTimeString()
  }

  useEffect(() => {
    let mounted = true
    let baseZones = []

    // Load static JSON once
    fetch('/zones.json')
      .then(res => res.json())
      .then(json => {
        baseZones = json

        // Immediately generate first random subset
        generateZones()

        // Then every 7s, pick a new random subset of 1–12 per camera
        const intervalId = setInterval(generateZones, 7000)

        function generateZones() {
          if (!mounted) return

          // split into left/right pools
          const leftPool  = baseZones.filter(z => z.camera === 'left')
          const rightPool = baseZones.filter(z => z.camera === 'right')

          // pick 1–12 random from each
          const leftCount  = Math.floor(Math.random() * 12) + 1
          const rightCount = Math.floor(Math.random() * 12) + 1

          const shuffle = arr => [...arr].sort(() => 0.5 - Math.random())

          const selectedLeft  = shuffle(leftPool).slice(0, leftCount)
          const selectedRight = shuffle(rightPool).slice(0, rightCount)

          // assign temps/status
          const combined = [...selectedLeft, ...selectedRight].map(z => {
            const temp   = getTemp()
            const status = temp > z.threshold ? 'ALERT' : 'NORMAL'
            return {
              ...z,
              temperature:   temp,
              status,
              lastTriggered: status === 'ALERT' ? nowTime() : 'Never'
            }
          })

          setZones(combined)

          setHistory(prev => {
            const cutoff = Date.now() - 1000 * 60 * 60
            const recent = prev.filter(item => item.time >= cutoff)
            return recent.concat({ time: Date.now(), zones: combined })
          })
        }

        return () => clearInterval(intervalId)
      })
      .catch(err => console.error('Failed to load zones:', err))

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
    document.body.classList.toggle('dark-mode', isDarkMode)
    document.body.classList.toggle('light-mode', !isDarkMode)
  }, [activeTab, isDarkMode])

  function addZone() {
    // Placeholder for adding via backend if needed
  }

  const camera1Zones = zones.filter(z => z.camera === 'left')
  const camera2Zones = zones.filter(z => z.camera === 'right')

  const visibleNames = [
    ...camera1Zones.map(z => z.name),
    ...camera2Zones.map(z => z.name)
  ]

  return (
    <>
      <Header
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        tempUnit={tempUnit}
        setTempUnit={setTempUnit}
      />

      <div className="app-layout">
        <div className="main-content">
          <SidebarPanel
            isDarkMode={isDarkMode}
            startDate=""
            setStartDate={() => {}}
            endDate=""
            setEndDate={() => {}}
            addZone={addZone}
          />

          <div className="content-area">
            <Navigation
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isDarkMode={isDarkMode}
            />

            <div className="scroll-container">
              {activeTab === 'dashboard' && (
                <VideoFeed
                  isDarkMode={isDarkMode}
                  tempUnit={tempUnit}
                  camera1Zones={camera1Zones}
                  camera2Zones={camera2Zones}
                />
              )}

              {/* ThermalPlot always mounted; hide when not active */}
              <div style={{ display: activeTab === 'thermal' ? 'block' : 'none' }}>
                <ThermalPlot zones={zones} visibleZones={visibleNames} />
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
