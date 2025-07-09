// src/App.js

import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import Navigation from './components/Navigation'
import VideoFeed from './components/VideoFeed'
import ThermalPlot from './components/ThermalPlot'
import SidebarPanel from './components/SidebarPanel'
import Footer from './components/Footer'
import './styles/videofeed.css'
import './App.css'

export default function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard')
  const [zones, setZones] = useState(() => {
    const saved = localStorage.getItem('zones')
    return saved ? JSON.parse(saved) : []
  })
  const [allZones, setAllZones] = useState([])
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('thermalHistory')
    return saved ? JSON.parse(saved, (key, val) => key === 'time' ? new Date(val) : val) : []
  })
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [tempUnit, setTempUnit] = useState('F')
  const [visibleZones, setVisibleZones] = useState(() => {
    const saved = localStorage.getItem('visibleZones')
    return saved ? JSON.parse(saved) : []
  })

  function getTemp() {
    return Math.round(140 + Math.random() * 20 - 10)
  }

  function nowTime() {
    return new Date().toLocaleTimeString()
  }

  useEffect(() => {
    let mounted = true
    let intervalId = null

    fetch('/zones.json')
      .then(res => res.json())
      .then(json => {
        if (!mounted) return
        setAllZones(json)

        function generateZones() {
          if (!mounted) return

          const leftPool = json.filter(z => z.camera === 'left')
          const rightPool = json.filter(z => z.camera === 'right')
          const shuffle = arr => [...arr].sort(() => 0.5 - Math.random())

          const selectedLeft = shuffle(leftPool).slice(0, Math.floor(Math.random() * 12) + 1)
          const selectedRight = shuffle(rightPool).slice(0, Math.floor(Math.random() * 12) + 1)

          const combined = [...selectedLeft, ...selectedRight].map(z => {
            const temp = getTemp()
            const status = temp > z.threshold ? 'ALERT' : 'NORMAL'
            return {
              ...z,
              temperature: temp,
              status,
              lastTriggered: status === 'ALERT' ? nowTime() : 'Never'
            }
          })

          setZones(combined)
          setHistory(prev => {
            const cutoff = Date.now() - 1000 * 60 * 60
            const recent = prev.filter(item => item.time >= cutoff)
            return [...recent, { time: Date.now(), zones: combined }]
          })

          if (visibleZones.length === 0) {
            const defaultVisible = combined.slice(0, 10).map(z => z.name)
            setVisibleZones(defaultVisible)
          }
        }

        generateZones()
        // intervalId = setInterval(generateZones, 7000)
      })
      .catch(err => console.error('Failed to load zones:', err))

    return () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('zones', JSON.stringify(zones))
  }, [zones])

  useEffect(() => {
    localStorage.setItem('thermalHistory', JSON.stringify(history))
  }, [history])

  useEffect(() => {
    localStorage.setItem('visibleZones', JSON.stringify(visibleZones))
  }, [visibleZones])

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
    document.body.classList.toggle('dark-mode', isDarkMode)
    document.body.classList.toggle('light-mode', !isDarkMode)
  }, [activeTab, isDarkMode])

  function addZone() {}

  const camera1Zones = zones.filter(z => z.camera === 'left')
  const camera2Zones = zones.filter(z => z.camera === 'right')

  return (
    <>
      <Header
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        tempUnit={tempUnit}
        setTempUnit={setTempUnit}
      />

      {/* 🟢 Navigation moved OUTSIDE of main-content */}
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
              startDate=""
              setStartDate={() => {}}
              endDate=""
              setEndDate={() => {}}
              addZone={addZone}
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

              <div style={{ display: activeTab === 'thermal' ? 'block' : 'none' }}>
                <ThermalPlot
                  zones={zones}
                  visibleZones={visibleZones}
                  setVisibleZones={setVisibleZones}
                  allZones={allZones}
                />
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
