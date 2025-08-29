import React, { useState, useEffect, useRef } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import 'chartjs-adapter-date-fns'
import '../styles/thermaldata.css'

const jitterPlugin = {
  id: 'jitterPlugin',
  beforeDatasetsDraw(chart) {
    if (!chart.options.plugins.jitterPlugin?.isChartReady) return
    
    // Check if zoom plugin is active or if zooming/panning is happening
    const zoomPlugin = chart.options.plugins.zoom
    const isZooming = chart._zooming || chart._panning || 
                     (zoomPlugin && zoomPlugin.zoom && zoomPlugin.zoom.enabled) ||
                     (zoomPlugin && zoomPlugin.pan && zoomPlugin.pan.enabled)
    
    // Completely disable plugin during zoom operations
    if (isZooming) {
      return
    }
    
    const tooltip = chart.tooltip
    
    // Show only the exact point being hovered
    if (tooltip.opacity === 1 && tooltip.dataPoints && tooltip.dataPoints.length > 0) {
      const hoveredPoint = tooltip.dataPoints[0]
      const hoveredDatasetIndex = hoveredPoint.datasetIndex
      const hoveredDataIndex = hoveredPoint.dataIndex
      
      // Enable only the specific point being hovered
      chart.data.datasets.forEach((dataset, dsIndex) => {
        if (dsIndex === hoveredDatasetIndex) {
          // For the hovered dataset, enable only the specific point
          dataset.pointRadius = 0
          dataset.pointHoverRadius = 0
          
          // Set the specific point to be visible
          if (dataset.data[hoveredDataIndex]) {
            dataset.data[hoveredDataIndex].pointRadius = 6
          }
        } else {
          // Disable all points for other datasets
          dataset.pointRadius = 0
          dataset.pointHoverRadius = 0
        }
      })
    } else {
      // Disable all points when not hovering
      chart.data.datasets.forEach(dataset => {
        dataset.pointRadius = 0
        dataset.pointHoverRadius = 0
      })
    }
  }
}

const dividerPlugin = {
  id: 'dividerPlugin',
  afterRender(chart) {
    const ctx = chart.ctx;
    const titleBlock = chart.titleBlock;
    if (!titleBlock) return;
    
    // Position divider below the title
    const dividerY = titleBlock.bottom + 5;
    
    ctx.save();
    ctx.strokeStyle = chart.options.plugins.dividerPlugin?.isDarkMode ? '#444' : '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, dividerY);
    ctx.lineTo(chart.width, dividerY);
    ctx.stroke();
    ctx.restore();
  }
}



ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  jitterPlugin,
  dividerPlugin,
  Filler
)

function smoothData(data, windowSize = 5) {
  const smoothed = []
  for (let i = 0; i < data.length; i++) {
    let count = 0
    let sum = 0
    for (
      let j = i - Math.floor(windowSize / 2);
      j <= i + Math.floor(windowSize / 2);
      j++
    ) {
      if (
        j >= 0 &&
        j < data.length &&
        data[j].y !== null &&
        data[j].y !== undefined
      ) {
        sum += data[j].y
        count++
      }
    }
    smoothed.push({
      x: data[i].x,
      y: count > 0 ? sum / count : null
    })
  }
  return smoothed
}

export default function ThermalPlot({
  zones = [],
  allZones = [],
  tempUnit = 'F',
  isDarkMode = false,
  selectedCamera,
  setSelectedCamera,
  visibleZones,
  setVisibleZones,
}) {
  const chartRef = useRef(null)

  const [isChartReady, setIsChartReady] = useState(false)
  const [timeRange, setTimeRange] = useState(() => localStorage.getItem('timeRange') || '1h')
  const [allZonesHidden, setAllZonesHidden] = useState(() => {
    const saved = localStorage.getItem('allZonesHidden')
    return saved ? JSON.parse(saved) : false
  })

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('thermalHistory')
    return saved
      ? JSON.parse(saved, (key, val) => (key === 'time' ? new Date(val) : val))
      : []
  })
  const [initialRange, setInitialRange] = useState(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [zonesVisibility, setZonesVisibility] = useState(() => {
    const saved = localStorage.getItem('zonesVisibility')
    return saved ? JSON.parse(saved) : {}
  })

  useEffect(() => {
    const allZoneNames = allZones.map(z => z.name) // All zones from both cameras (test data)
    let changed = false
    const newVisibility = { ...zonesVisibility }
    allZoneNames.forEach(name => {
      if (!(name in newVisibility)) {
        newVisibility[name] = true
        changed = true
      }
    })
    Object.keys(newVisibility).forEach(name => {
      if (!allZoneNames.includes(name)) {
        delete newVisibility[name]
        changed = true
      }
    })
    if (changed) {
      setZonesVisibility(newVisibility)
      localStorage.setItem('zonesVisibility', JSON.stringify(newVisibility))
    }
    // Update visibleZones in sync with visibility
    const nextVisible = allZoneNames.filter(name => newVisibility[name] !== false)
    setVisibleZones(nextVisible)
    localStorage.setItem('visibleZones', JSON.stringify(nextVisible))
    // eslint-disable-next-line
  }, [allZones, selectedCamera])

  // Force all zones to be visible for all time ranges (test data)
  // REMOVED - This was causing zones to reset when switching cameras




    
  useEffect(() => {
    setIsChartReady(true)
    
    // Generate initial data immediately on component mount
    const config = testDataConfig[timeRange]
    if (config) {
      const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
      
      // Generate initial data if it doesn't exist
      if (!localStorage.getItem(testDataKey)) {
        const testData = []
        const now = new Date()
        const startTime = new Date(now.getTime() - (config.entries * config.interval))
        
        for (let i = 0; i < config.entries; i++) {
          const time = new Date(startTime.getTime() + (i * config.interval))
          const readings = {}
          
          // Generate data for all zones, but apply camera-specific patterns
          allZones.forEach((z, zoneIndex) => {
            const timeMs = time.getTime()
            const timeFactor = i / config.entries
            
            // Camera-specific base temperatures and patterns
            const isLeftCamera = selectedCamera === 'planck_1'
            const cameraOffset = isLeftCamera ? 30 : 0
            const cameraMultiplier = isLeftCamera ? 1.3 : 0.9
            
            // Dynamic base temperature based on time, zone, and camera
            const dynamicBase = 70 + (timeMs % 1000000) / 10000 + (zoneIndex * 12) + cameraOffset
            
            // Camera-specific zone patterns
            const zonePattern = isLeftCamera 
              ? Math.sin(timeMs / (4 * 60 * 60 * 1000) + zoneIndex) * 25 + 
                Math.cos(timeMs / (8 * 60 * 60 * 1000) + zoneIndex * 2) * 20
              : Math.sin(timeMs / (6 * 60 * 60 * 1000) + zoneIndex) * 18 + 
                Math.cos(timeMs / (12 * 60 * 60 * 1000) + zoneIndex * 3) * 12
            
            // Camera-specific time-based variations
            const dailyPattern = Math.sin(timeMs / (24 * 60 * 60 * 1000)) * (25 * cameraMultiplier)
            const weeklyPattern = Math.sin(timeMs / (7 * 24 * 60 * 60 * 1000)) * (20 * cameraMultiplier)
            const monthlyPattern = Math.sin(timeMs / (30 * 60 * 60 * 24 * 1000)) * (15 * cameraMultiplier)
            const seasonalPattern = Math.sin(timeMs / (90 * 60 * 60 * 24 * 1000)) * (30 * cameraMultiplier)
            
            // Camera-specific hour and day patterns
            const hourPattern = isLeftCamera
              ? Math.sin((time.getHours() / 24) * 2 * Math.PI) * 22
              : Math.sin((time.getHours() / 24) * 2 * Math.PI + Math.PI) * 16
            const dayPattern = isLeftCamera
              ? Math.sin((time.getDay() / 7) * 2 * Math.PI) * 15
              : Math.sin((time.getDay() / 7) * 2 * Math.PI + Math.PI) * 10
            
            // Consistent oscillation patterns with camera-specific amplitudes
            const oscillation1 = Math.sin(i / (50 + zoneIndex * 10)) * (isLeftCamera ? 25 : 18)
            const oscillation2 = Math.sin(i / (25 + zoneIndex * 5)) * (isLeftCamera ? 18 : 12)
            const oscillation3 = Math.cos(i / (75 + zoneIndex * 15)) * (isLeftCamera ? 20 : 15)
            
            // Camera-specific random variations
            const timeSeed = Math.floor(timeMs / (30 * 1000)) + zoneIndex + (isLeftCamera ? 1000 : 2000)
            const random1 = Math.sin(timeSeed) * (20 * cameraMultiplier)
            const random2 = Math.cos(timeSeed * 2) * (15 * cameraMultiplier)
            const random3 = Math.sin(timeSeed * 3) * (10 * cameraMultiplier)
            
            // Camera-specific peaks and spikes
            const peakPattern = isLeftCamera
              ? Math.sin(i / (80 + zoneIndex * 15)) * 0.9 + 0.1
              : Math.sin(i / (120 + zoneIndex * 25)) * 0.7 + 0.3
            const dynamicPeak = peakPattern * (isLeftCamera ? (30 + Math.random() * 40) : (20 + Math.random() * 30))
            
            const spikeSeed = Math.sin(timeSeed + zoneIndex * 50) * 0.5 + 0.5
            const dynamicSpike = spikeSeed > (1 - config.peakChance) 
              ? (isLeftCamera ? (Math.random() * 60 + 35) : (Math.random() * 40 + 25))
              : 0
            
            // Camera-specific temperature drift
            const timeDrift = (timeMs - startTime.getTime()) / (24 * 60 * 60 * 1000) * (isLeftCamera ? 4 : 2)
            const driftPattern = Math.sin(timeDrift / (isLeftCamera ? 4 : 6)) * (isLeftCamera ? 10 : 6)
            
            // Calculate final temperature with all camera-specific components
            const finalTemp = dynamicBase + zonePattern + dailyPattern + weeklyPattern + monthlyPattern + 
                             seasonalPattern + hourPattern + dayPattern + oscillation1 + oscillation2 + 
                             oscillation3 + random1 + random2 + random3 + dynamicPeak + dynamicSpike + driftPattern
            
            // Ensure temperature is always greater than 100°F
            const clampedTemp = Math.max(101, Math.round(finalTemp))
            readings[z.name] = clampedTemp
          })
          
          testData.push({ time, readings })
        }
        
        try {
          localStorage.setItem(testDataKey, JSON.stringify(testData))
        } catch (error) {
          console.warn(`Failed to store initial test data:`, error.message)
        }
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('timeRange', timeRange)
  }, [timeRange])

  useEffect(() => {
    localStorage.setItem('allZonesHidden', JSON.stringify(allZonesHidden))
  }, [allZonesHidden])

  const [allZoneNames, setAllZoneNames] = useState(() => {
    const saved = localStorage.getItem('allZoneNames')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    const namesInHistory = new Set()
    history.forEach(entry => {
      Object.keys(entry.readings || {}).forEach(zoneName => {
        const zone = allZones.find(
          z => z.name === zoneName && z.camera === selectedCamera
        )
        if (zone) namesInHistory.add(zoneName)
      })
    })
    const merged = Array.from(new Set([...allZoneNames, ...namesInHistory]))
    if (
      merged.length !== allZoneNames.length ||
      !merged.every(name => allZoneNames.includes(name))
    ) {
      setAllZoneNames(merged)
      localStorage.setItem('allZoneNames', JSON.stringify(merged))
    }
  }, [history, selectedCamera, allZones, allZoneNames])

  useEffect(() => {
    const cameraZoneNames = allZones
      .filter(z => z.camera === selectedCamera)
      .map(z => z.name)

    // Try loading from localStorage
    let stored = localStorage.getItem('visibleZones')
    let storedZones = stored ? JSON.parse(stored) : null

    // Only default if not stored, or not an array, or all empty
    if (!storedZones || !Array.isArray(storedZones) || storedZones.length === 0) {
      setVisibleZones(cameraZoneNames)
      localStorage.setItem('visibleZones', JSON.stringify(cameraZoneNames))
    } else {
      setVisibleZones(storedZones)
    }
    // eslint-disable-next-line
  }, [selectedCamera, allZones, setVisibleZones])

  useEffect(() => {
    const now = new Date()
    const readings = {}
    zones
      .filter(z => z.camera === selectedCamera)
      .forEach(z => {
        readings[z.name] = z.temperature
      })
    if (Object.keys(readings).length > 0) {
      setHistory(prev => {
        const lastEntry = prev[prev.length - 1]
        if (lastEntry && now.getTime() === new Date(lastEntry.time).getTime()) {
          return prev
        }
        const updated = [...prev, { time: now, readings }]
        try {
          localStorage.setItem('thermalHistory', JSON.stringify(updated))
        } catch (error) {
          console.warn('Failed to store thermal history in localStorage:', error.message)
        }
        return updated
      })
    }
    }, [zones, selectedCamera])

  // Test data configuration - dynamic values only
  const testDataConfig = {
    '30m': { entries: 360, interval: 5000, peakChance: 0.05 },
    '1h': { entries: 720, interval: 5000, peakChance: 0.06 },
    '3h': { entries: 1080, interval: 10000, peakChance: 0.07 },
    '6h': { entries: 5000, interval: 43200, peakChance: 0.08 },
    '12h': { entries: 6000, interval: 7200, peakChance: 0.09 },
    '24h': { entries: 8000, interval: 10800, peakChance: 0.10 },
    '48h': { entries: 5000, interval: 34560, peakChance: 0.12 },
    '2d': { entries: 1000, interval: 172800, peakChance: 0.15 },
    '4d': { entries: 800, interval: 432000, peakChance: 0.18 },
    '7d': { entries: 500, interval: 1209600, peakChance: 0.20 },
    '2w': { entries: 300, interval: 4032000, peakChance: 0.25 },
    '1m': { entries: 200, interval: 12960000, peakChance: 0.30 },
    '1y': { entries: 100, interval: 315360000, peakChance: 0.35 }
  }

  // Generate test data for all time ranges
  useEffect(() => {
    const config = testDataConfig[timeRange]
    if (!config) return

    // Force clear ALL test data every time range changes
    const timeMap = {
      '30m': 30 * 60000, '1h': 3600000, '3h': 3 * 3600000, '6h': 6 * 3600000,
      '12h': 12 * 3600000, '24h': 24 * 3600000, '48h': 48 * 3600000,
      '2d': 2 * 86400000, '4d': 4 * 86400000, '7d': 7 * 86400000,
      '2w': 14 * 86400000, '1m': 30 * 86400000, '1y': 365 * 86400000
    }
    
    // Clear ALL test data for ALL time ranges and cameras
    Object.keys(timeMap).forEach(range => {
      localStorage.removeItem(`thermalHistory${range}`)
      localStorage.removeItem(`thermalHistory${range}_planck_1`)
      localStorage.removeItem(`thermalHistory${range}_planck_2`)
    })
    localStorage.removeItem('thermalHistory')

    const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    
    const testData = []
    const now = new Date()
    
    // For longer time ranges, use appropriate intervals
    let interval, entries
    if (['1m', '2w', '1y'].includes(timeRange)) {
      // Daily data points for longer ranges
      interval = 24 * 60 * 60 * 1000 // 24 hours
      entries = timeRange === '1m' ? 30 : timeRange === '2w' ? 14 : 365
    } else if (timeRange === '7d') {
      // 14 data points for 7 days (one every 12 hours)
      interval = 12 * 60 * 60 * 1000 // 12 hours
      entries = 14
    } else if (timeRange === '4d') {
      // 96 data points for 4 days (one every hour)
      interval = 60 * 60 * 1000 // 1 hour
      entries = 96
    } else if (timeRange === '2d') {
      // 96 data points for 2 days (one every 30 minutes)
      interval = 30 * 60 * 1000 // 30 minutes
      entries = 96
    } else {
      // Use original config for shorter ranges
      interval = config.interval
      entries = config.entries
    }
    
    const startTime = new Date(now.getTime() - (entries * interval))
    
    for (let i = 0; i < entries; i++) {
      const time = new Date(startTime.getTime() + (i * interval))
      const readings = {}
      
      // Generate data for all zones, but apply camera-specific patterns
      allZones.forEach((z, zoneIndex) => {
        const timeMs = time.getTime()
        const timeFactor = i / config.entries
        
        // Camera-specific base temperatures and patterns
        const isLeftCamera = selectedCamera === 'planck_1'
        const cameraOffset = isLeftCamera ? 30 : 0 // Left camera runs hotter
        const cameraMultiplier = isLeftCamera ? 1.3 : 0.9 // Left camera has more variation
        
        // Dynamic base temperature based on time, zone, and camera
        const dynamicBase = 70 + (timeMs % 1000000) / 10000 + (zoneIndex * 12) + cameraOffset
        
        // Camera-specific zone patterns
        const zonePattern = isLeftCamera 
          ? Math.sin(timeMs / (4 * 60 * 60 * 1000) + zoneIndex) * 25 + 
            Math.cos(timeMs / (8 * 60 * 60 * 1000) + zoneIndex * 2) * 20
          : Math.sin(timeMs / (6 * 60 * 60 * 1000) + zoneIndex) * 18 + 
            Math.cos(timeMs / (12 * 60 * 60 * 1000) + zoneIndex * 3) * 12
        
        // Camera-specific time-based variations
        const dailyPattern = Math.sin(timeMs / (24 * 60 * 60 * 1000)) * (25 * cameraMultiplier)
        const weeklyPattern = Math.sin(timeMs / (7 * 24 * 60 * 60 * 1000)) * (20 * cameraMultiplier)
        const monthlyPattern = Math.sin(timeMs / (30 * 60 * 60 * 24 * 1000)) * (15 * cameraMultiplier)
        const seasonalPattern = Math.sin(timeMs / (90 * 60 * 60 * 24 * 1000)) * (30 * cameraMultiplier)
        
        // Camera-specific hour and day patterns
        const hourPattern = isLeftCamera
          ? Math.sin((time.getHours() / 24) * 2 * Math.PI) * 22
          : Math.sin((time.getHours() / 24) * 2 * Math.PI + Math.PI) * 16 // Opposite phase
        const dayPattern = isLeftCamera
          ? Math.sin((time.getDay() / 7) * 2 * Math.PI) * 15
          : Math.sin((time.getDay() / 7) * 2 * Math.PI + Math.PI) * 10 // Opposite phase
        
        // Consistent oscillation patterns with camera-specific amplitudes
        const oscillation1 = Math.sin(i / (50 + zoneIndex * 10)) * (isLeftCamera ? 25 : 18)
        const oscillation2 = Math.sin(i / (25 + zoneIndex * 5)) * (isLeftCamera ? 18 : 12)
        const oscillation3 = Math.cos(i / (75 + zoneIndex * 15)) * (isLeftCamera ? 20 : 15)
        
        // Camera-specific random variations
        const timeSeed = Math.floor(timeMs / (30 * 1000)) + zoneIndex + (isLeftCamera ? 1000 : 2000)
        const random1 = Math.sin(timeSeed) * (20 * cameraMultiplier)
        const random2 = Math.cos(timeSeed * 2) * (15 * cameraMultiplier)
        const random3 = Math.sin(timeSeed * 3) * (10 * cameraMultiplier)
        
        // Camera-specific peaks and spikes
        const peakPattern = isLeftCamera
          ? Math.sin(i / (80 + zoneIndex * 15)) * 0.9 + 0.1
          : Math.sin(i / (120 + zoneIndex * 25)) * 0.7 + 0.3
        const dynamicPeak = peakPattern * (isLeftCamera ? (30 + Math.random() * 40) : (20 + Math.random() * 30))
        
        const spikeSeed = Math.sin(timeSeed + zoneIndex * 50) * 0.5 + 0.5
        const dynamicSpike = spikeSeed > (1 - config.peakChance) 
          ? (isLeftCamera ? (Math.random() * 60 + 35) : (Math.random() * 40 + 25))
          : 0
        
        // Camera-specific temperature drift
        const timeDrift = (timeMs - startTime.getTime()) / (24 * 60 * 60 * 1000) * (isLeftCamera ? 4 : 2)
        const driftPattern = Math.sin(timeDrift / (isLeftCamera ? 4 : 6)) * (isLeftCamera ? 10 : 6)
        
        // Calculate final temperature with all camera-specific components
        const finalTemp = dynamicBase + zonePattern + dailyPattern + weeklyPattern + monthlyPattern + 
                         seasonalPattern + hourPattern + dayPattern + oscillation1 + oscillation2 + 
                         oscillation3 + random1 + random2 + random3 + dynamicPeak + dynamicSpike + driftPattern
        
        // Ensure temperature is always greater than 100°F
        const clampedTemp = Math.max(101, Math.round(finalTemp))
        readings[z.name] = clampedTemp
      })
      
      testData.push({ time, readings })
    }
    
    try {
      localStorage.setItem(testDataKey, JSON.stringify(testData))
    } catch (error) {
      console.warn(`Failed to store ${timeRange} test data in localStorage:`, error.message)
    }
  }, [timeRange, selectedCamera, allZones])

  useEffect(() => {
    if (history.length && !initialRange) {
      const sortedAll = history
        .slice()
        .sort((a, b) => new Date(a.time) - new Date(b.time))
      const first = new Date(sortedAll[0].time).getTime()
      const last = new Date(sortedAll[sortedAll.length - 1].time).getTime()
      setInitialRange({ min: first, max: last })
    }
  }, [history, initialRange])

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update()
    }
  }, [tempUnit, isDarkMode])

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update()
    }
  }, [history])

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update()
    }
  }, [timeRange, selectedCamera])





  // Update chart and advance data every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Generate new data entry
      const now = new Date()
      const readings = {}
      
      // Generate new temperature readings for all zones
      allZones.forEach((z, zoneIndex) => {
        const timeMs = now.getTime()
        
        // Camera-specific base temperatures and patterns
        const isLeftCamera = selectedCamera === 'planck_1'
        const cameraOffset = isLeftCamera ? 30 : 0
        const cameraMultiplier = isLeftCamera ? 1.3 : 0.9
        
        // Dynamic base temperature based on time, zone, and camera
        const dynamicBase = 70 + (timeMs % 1000000) / 10000 + (zoneIndex * 12) + cameraOffset
        
        // Camera-specific patterns
        const zonePattern = isLeftCamera 
          ? Math.sin(timeMs / (4 * 60 * 60 * 1000) + zoneIndex) * 25 + 
            Math.cos(timeMs / (8 * 60 * 60 * 1000) + zoneIndex * 2) * 20
          : Math.sin(timeMs / (6 * 60 * 60 * 1000) + zoneIndex) * 18 + 
            Math.cos(timeMs / (12 * 60 * 60 * 1000) + zoneIndex * 3) * 12
        
        // Time-based variations
        const dailyPattern = Math.sin(timeMs / (24 * 60 * 60 * 1000)) * (25 * cameraMultiplier)
        const weeklyPattern = Math.sin(timeMs / (7 * 24 * 60 * 60 * 1000)) * (20 * cameraMultiplier)
        const monthlyPattern = Math.sin(timeMs / (30 * 60 * 60 * 24 * 1000)) * (15 * cameraMultiplier)
        const seasonalPattern = Math.sin(timeMs / (90 * 60 * 60 * 24 * 1000)) * (30 * cameraMultiplier)
        
        // Hour and day patterns
        const hourPattern = isLeftCamera
          ? Math.sin((now.getHours() / 24) * 2 * Math.PI) * 22
          : Math.sin((now.getHours() / 24) * 2 * Math.PI + Math.PI) * 16
        const dayPattern = isLeftCamera
          ? Math.sin((now.getDay() / 7) * 2 * Math.PI) * 15
          : Math.sin((now.getDay() / 7) * 2 * Math.PI + Math.PI) * 10
        
        // Oscillation patterns
        const oscillation1 = Math.sin(timeMs / (50 + zoneIndex * 10)) * (isLeftCamera ? 25 : 18)
        const oscillation2 = Math.sin(timeMs / (25 + zoneIndex * 5)) * (isLeftCamera ? 18 : 12)
        const oscillation3 = Math.cos(timeMs / (75 + zoneIndex * 15)) * (isLeftCamera ? 20 : 15)
        
        // Random variations
        const timeSeed = Math.floor(timeMs / (30 * 1000)) + zoneIndex + (isLeftCamera ? 1000 : 2000)
        const random1 = Math.sin(timeSeed) * (20 * cameraMultiplier)
        const random2 = Math.cos(timeSeed * 2) * (15 * cameraMultiplier)
        const random3 = Math.sin(timeSeed * 3) * (10 * cameraMultiplier)
        
        // Calculate final temperature
        const finalTemp = dynamicBase + zonePattern + dailyPattern + weeklyPattern + monthlyPattern + 
                         seasonalPattern + hourPattern + dayPattern + oscillation1 + oscillation2 + 
                         oscillation3 + random1 + random2 + random3
        
        // Ensure temperature is always greater than 100°F
        const clampedTemp = Math.max(101, Math.round(finalTemp))
        readings[z.name] = clampedTemp
      })
      
      // Add new entry to history
      setHistory(prev => {
        const updated = [...prev, { time: now, readings }]
        try {
          localStorage.setItem('thermalHistory', JSON.stringify(updated))
        } catch (error) {
          console.warn('Failed to store thermal history in localStorage:', error.message)
        }
        return updated
      })
      
      // Update chart
      if (chartRef.current) {
        chartRef.current.update('none') // Force update without animation
      }
    }, 10000) // 10 seconds

    return () => clearInterval(interval) // Cleanup on unmount
  }, [allZones, selectedCamera])





  const timeMap = {
    '30m': 30 * 60000,
    '1h': 3600000,
    '3h': 3 * 3600000,
    '6h': 6 * 3600000,
    '12h': 12 * 3600000,
    '24h': 24 * 3600000,
    '48h': 48 * 3600000,
    '2d': 2 * 86400000,
    '4d': 4 * 86400000,
    '7d': 7 * 86400000,
    '2w': 14 * 86400000,
    '1m': 30 * 86400000,
    '1y': 365 * 86400000
  }

  const fToC = f => Math.round(((f - 32) * 5) / 9)

  const handleCameraChange = cam => {
    setSelectedCamera(cam)
    // Removed setAllZonesHidden(false) - button state should persist across camera changes
    
    // Force chart refresh when camera changes
    setTimeout(() => {
      if (chartRef.current) {
        chartRef.current.update('none') // Force complete update
      }
    }, 100)
  }

  const toggleAllZones = () => {
    const allZoneNames = allZones.map(z => z.name) // All zones from both cameras (test data)
    if (allZonesHidden) {
      // Show all zones
      const newVisibility = { ...zonesVisibility }
      allZoneNames.forEach(name => { newVisibility[name] = true })
      setZonesVisibility(newVisibility)
      setVisibleZones(allZoneNames)
      setAllZonesHidden(false)
      localStorage.setItem('zonesVisibility', JSON.stringify(newVisibility))
      localStorage.setItem('visibleZones', JSON.stringify(allZoneNames))
    } else {
      // Hide all zones
      const newVisibility = { ...zonesVisibility }
      allZoneNames.forEach(name => { newVisibility[name] = false })
      setZonesVisibility(newVisibility)
      setVisibleZones([])
      setAllZonesHidden(true)
      localStorage.setItem('zonesVisibility', JSON.stringify(newVisibility))
      localStorage.setItem('visibleZones', JSON.stringify([]))
    }
  }
  const handleSaveGraph = () => {
    const chart = chartRef.current
    if (chart && chart.toBase64Image) {
      const link = document.createElement('a')
      link.download = `thermal-plot-${Date.now()}.png`
      link.href = chart.toBase64Image()
      link.click()
    }
  }

  const handleExportCSV = () => {
    const filename = `thermal-data-${Date.now()}.csv`
    let csv = 'Time,' + filteredNames.join(',') + '\n'
    sorted.forEach(entry => {
      const time = new Date(entry.time).toLocaleString()
      const readings = filteredNames.map(name => entry.readings[name] ?? '').join(',')
      csv += `${time},${readings}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  const handleExportPDF = () => {
    const chart = chartRef.current
    if (!chart) return
    const imageBase64 = chart.toBase64Image()
    const pdfWindow = window.open('', '_blank')
    if (pdfWindow) {
      pdfWindow.document.write(`<html><head><title>Chart PDF</title></head><body>`)
      pdfWindow.document.write(`<img src="${imageBase64}" style="width:100%"/>`)
      pdfWindow.document.write(`</body></html>`)
      pdfWindow.document.close()
      pdfWindow.print()
    }
  }

  const clearLocalStorage = () => {
    try {
      // Clear all thermal history data
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('thermalHistory')) {
          localStorage.removeItem(key)
        }
      })
      console.log('Cleared thermal history data from localStorage')
    } catch (error) {
      console.error('Failed to clear localStorage:', error.message)
    }
  }

  const handleResetZoom = () => {
    const chart = chartRef.current
    if (!chart) return
  
    const xScale = chart.scales.x
    if (!xScale) return
  
    let resetMin, resetMax
  
    if (timeRange === '1h') {
      resetMin = custom1hTicks[0]
      resetMax = custom1hTicks[custom1hTicks.length - 1]
    } else if (timeRange === '3h') {
      resetMin = custom3hTicks[0]
      resetMax = custom3hTicks[custom3hTicks.length - 1]
    } else if (timeRange === '24h' && custom24hTicks.length) {
      resetMin = custom24hTicks[0]
      resetMax = custom24hTicks[custom24hTicks.length - 1]
    } else if (dayRanges[timeRange] && customDayTicks.length) {
      resetMin = customDayTicks[0]
      resetMax = customDayTicks[customDayTicks.length - 1]
    } else {
      resetMin = extendedMin
      resetMax = extendedMax
    }
  
    // Reset zoom plugin state to clear zoom/pan history
    if (chart.resetZoom) {
      chart.resetZoom()
    }
  
    // Reset x axis min/max to default values
    xScale.options.min = resetMin
    xScale.options.max = resetMax
  
    chart.update()
  }
    // Don't show waiting message - let the chart render with whatever data is available
    if (!history.length) {
      return <div style={{ padding: 20 }}>Loading...</div>
    }

  const timeLimit = timeMap[timeRange] || timeMap['7d']
  const currentTime = Date.now()
  const rangeCutoff = currentTime - timeLimit

  // Use test data for all time ranges
  let dataToUse = history
  const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
  const testData = localStorage.getItem(testDataKey)
  if (testData) {
    try {
      dataToUse = JSON.parse(testData, (key, val) => (key === 'time' ? new Date(val) : val))
    } catch (e) {
      console.error(`Error parsing ${timeRange} test data for ${selectedCamera}:`, e)
      dataToUse = history
    }
  } else {
    console.log(`No ${timeRange} test data found for ${selectedCamera} in localStorage`)
  }

  const sorted = dataToUse.sort((a, b) => new Date(a.time) - new Date(b.time)) // Don't filter test data by time

  const zonesForCamera = allZones // Use all zones for all time ranges (test data)
  const filteredNames = zonesForCamera.map(z => z.name)
  


  const datasets = zonesForCamera.map((zone, idx) => {
    const zoneDataPoints = sorted
      .map(entry => {
        const val = entry.readings?.[zone.name]
        if (typeof val === 'number') {
          const yValue =
            tempUnit === 'F'
              ? Math.round(val)
              : Math.round(((val - 32) * 5) / 9)
          return { x: new Date(entry.time), y: yValue }
        }
        return null
      })
      .filter(Boolean)
      


    const isHidden = zonesVisibility[zone.name] === false || !visibleZones.includes(zone.name)
    const smoothed = zoneDataPoints.length > 0
      ? smoothData(zoneDataPoints.slice(0, -1), 5)
      : []
    const combinedData = zoneDataPoints.length > 0
      ? [...smoothed, zoneDataPoints[zoneDataPoints.length - 1]]
      : []
    
    // Add vertical offset to each zone to spread them out
    let verticalOffset = idx * 20 // 20°F offset per zone
    if (timeRange === '12h' || timeRange === '48h') {
      verticalOffset = idx * 40 // 40°F offset per zone for 12h and 48h
    }
    const offsetData = combinedData.map(point => ({
      ...point,
      y: point.y + verticalOffset
    }))
    // Create more distinct colors with better spacing
    const hue = (idx * 60) % 360 // 60° spacing instead of 45° for better separation
    const saturation = 75 + (idx % 3) * 10 // Vary saturation for more distinction
    const lightness = 50 + (idx % 2) * 15 // Vary lightness for better contrast
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`
    
    return {
      label: zone.name,
      data: offsetData,
      borderColor: color,
      backgroundColor: 'transparent',
      borderDash: [], // All lines are solid
      spanGaps: true,
      pointRadius: 0, // No points visible by default
      pointHoverRadius: 0, // Don't show points on hover by default
      pointHitRadius: 6,
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointBorderWidth: 1,
      yAxisID: 'y',
      order: idx, // Use index for ordering
      hidden: isHidden,
      borderWidth: 1, // Even thinner lines
    }
  })

  const data = { datasets }

  // Calculate y-axis min and max based on actual chart data points
  let dataMin, dataMax
  let allChartTemps = []
  
  // Collect all temperature values from the actual chart datasets
  datasets.forEach(dataset => {
    if (!dataset.hidden && dataset.data) {
      dataset.data.forEach(point => {
        if (point && typeof point.y === 'number') {
          allChartTemps.push(point.y)
        }
      })
    }
  })
  
  // Calculate y-axis range with exactly 10°F buffer
  if (allChartTemps.length === 0) {
    dataMin = tempUnit === 'F' ? 0 : Math.round(((0 - 32) * 5) / 9)
    dataMax = tempUnit === 'F' ? 300 : Math.round(((300 - 32) * 5) / 9)
  } else {
    // Use actual min/max with exactly 10°F buffer
    const actualMin = Math.min(...allChartTemps)
    const actualMax = Math.max(...allChartTemps)
    
    // Apply buffer, but for 6h use exactly 5°F above highest point minus 30°F
    if (timeRange === '6h') {
      dataMin = Math.max(0, actualMin - 5)
      dataMax = actualMax + 5 - 30
    } else if (timeRange === '24h') {
      dataMin = Math.max(0, actualMin - 50)
      dataMax = actualMax + 15
    } else {
      dataMin = Math.max(0, actualMin - 25)
      dataMax = actualMax + 15
    }
  }

  const dataMinTime = sorted.length
    ? new Date(sorted[0].time).getTime()
    : currentTime - timeLimit

  const dataMaxTime = sorted.length
    ? new Date(sorted[sorted.length - 1].time).getTime()
    : currentTime

  function roundDownToNearestMinute(timeMs) {
    const d = new Date(timeMs)
    d.setSeconds(0, 0)
    return d.getTime()
  }

  let startTime, extendedMin, extendedMax
  let custom24hTicks = []
  let customDayTicks = []
  let custom30mTicks = []
  let custom1hTicks = []
  let custom3hTicks = []
  let custom6hTicks = []
  let custom12hTicks = []
  let custom48hTicks = []
  const dayRanges = { '2d': 2, '4d': 4, '7d': 7, '2w': 14, '1m': 30, '1y': 365 }

  if (timeRange === '30m') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0)
    const start = new Date(now.getTime() - 30 * 60 * 1000)
    // Generate ticks every 5 minutes for 30m (7 ticks total)
    for (let i = 0; i <= 6; i++) {
      const tick = new Date(start.getTime() + i * 5 * 60 * 1000)
      custom30mTicks.push(tick.getTime())
    }
    // Add current time as the last tick
    custom30mTicks.push(currentTime)
    extendedMin = start.getTime()
    extendedMax = currentTime
    startTime = extendedMin
  } else if (timeRange === '24h') {
    const now = new Date(currentTime)
    const baseMinute = now.getMinutes()
    now.setSeconds(0, 0)
    const base = new Date(now)
    base.setMinutes(baseMinute, 0, 0)
    const start = new Date(base.getTime() - 24 * 60 * 60 * 1000)
    for (let i = 0; i <= 24; i++) {
      const tick = new Date(start.getTime() + i * 60 * 60 * 1000)
      custom24hTicks.push(tick.getTime())
    }
    // Add current time as the last tick and ensure it's visible
    custom24hTicks.push(currentTime)
    console.log('24h ticks:', custom24hTicks.length, 'Current time added:', new Date(currentTime))
    // Force the last tick to be the current time
    custom24hTicks[custom24hTicks.length - 1] = currentTime
    extendedMax = currentTime
    extendedMin = custom24hTicks[0]
    startTime = extendedMin
  } else if (timeRange === '1h') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0)
    const baseMinute = now.getMinutes()
    const start = new Date(now.getTime() - 60 * 60 * 1000)
    for (let i = 0; i <= 12; i++) {
      const tick = new Date(start.getTime() + i * 5 * 60 * 1000)
      custom1hTicks.push(tick.getTime())
    }
    // Add current time as the last tick
    custom1hTicks.push(currentTime)
    console.log('1h ticks:', custom1hTicks.length, 'Current time added:', new Date(currentTime))
    extendedMin = start.getTime()
    extendedMax = currentTime
    startTime = extendedMin
  } else if (timeRange === '3h') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0)
    const baseMinute = now.getMinutes()
    const start = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    for (let i = 0; i <= 18; i++) {
      const tick = new Date(start.getTime() + i * 10 * 60 * 1000)
      custom3hTicks.push(tick.getTime())
    }
    // Add current time as the last tick
    custom3hTicks.push(currentTime)
    extendedMin = start.getTime()
    extendedMax = currentTime
    startTime = extendedMin
  } else if (timeRange === '6h') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0)
    const start = new Date(now.getTime() - 6 * 60 * 60 * 1000)
    for (let i = 0; i <= 36; i++) {
      const tick = new Date(start.getTime() + i * 10 * 60 * 1000)
      custom6hTicks.push(tick.getTime())
    }
    // Add current time as the last tick
    custom6hTicks.push(currentTime)
    console.log('6h ticks:', custom6hTicks.length, 'Current time added:', new Date(currentTime))
    extendedMin = start.getTime()
    extendedMax = currentTime
    startTime = extendedMin
  } else if (timeRange === '12h') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0)
    const start = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    // Generate ticks every 2 hours for 12h (7 ticks total)
    for (let i = 0; i <= 6; i++) {
      const tick = new Date(start.getTime() + i * 2 * 60 * 60 * 1000)
      custom12hTicks.push(tick.getTime())
    }
    // Add current time as the last tick
    custom12hTicks.push(currentTime)
    console.log('12h ticks:', custom12hTicks.length, 'Current time added:', new Date(currentTime))
    extendedMin = start.getTime()
    extendedMax = currentTime
    startTime = extendedMin
  } else if (timeRange === '48h') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0)
    const start = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    // Generate ticks every 6 hours for 48h (8 ticks total)
    for (let i = 0; i <= 8; i++) {
      const tick = new Date(start.getTime() + i * 6 * 60 * 60 * 1000)
      custom48hTicks.push(tick.getTime())
    }
    // Add current time as the last tick
    custom48hTicks.push(currentTime)
    console.log('48h ticks:', custom48hTicks.length, 'Current time added:', new Date(currentTime))
    extendedMin = start.getTime()
    extendedMax = currentTime
    startTime = extendedMin
  } else if (dayRanges[timeRange]) {
    const nDays = dayRanges[timeRange]
    const now = new Date(currentTime)
    now.setHours(0, 0, 0, 0)
    const start = new Date(now)
    start.setDate(now.getDate() - (nDays - 1)) // Start from nDays-1 ago to include today
    for (let i = 0; i < nDays; i++) {
      const tick = new Date(start)
      tick.setDate(start.getDate() + i)
      customDayTicks.push(tick.getTime())
    }
    // Add current time as the last tick for higher time ranges
    customDayTicks.push(currentTime)
    extendedMin = customDayTicks[0]
    extendedMax = customDayTicks[customDayTicks.length - 1]
    startTime = extendedMin
  } else {
    startTime = roundDownToNearestMinute(currentTime - timeLimit)
    extendedMin = Math.max(dataMinTime - 30 * 60 * 1000, startTime)
    extendedMax = Math.min(dataMaxTime + 30 * 60 * 1000, currentTime)
  }

  function clampZoomPan(chart) {
    const xScale = chart.scales.x
    if (!xScale) return
  
    const allPoints = chart.data.datasets.flatMap(ds => ds.data)
    if (allPoints.length === 0) return
  
    const times = allPoints
      .map(p => (p.x instanceof Date ? p.x.getTime() : new Date(p.x).getTime()))
      .sort((a, b) => a - b)
    const minTime = times[0]
    const now = Date.now()
  
    let newMin = xScale.min
    let newMax = xScale.max
    const windowWidth = newMax - newMin
  
    // Clamp max to now
    if (newMax > now) {
      newMax = now
      newMin = newMax - windowWidth
      if (newMin < minTime) newMin = minTime
    }
  
    // Clamp min to earliest data
    if (newMin < minTime) {
      newMin = minTime
      newMax = newMin + windowWidth
      if (newMax > now) newMax = now
    }
  
    // Apply clamped values to x axis
    xScale.options.min = newMin
    xScale.options.max = newMax
  
    // No clamping for y axis, allow free vertical pan
  }
            function onLegendClick(e, legendItem) {
 
    console.log('LEGEND CLICKED!', legendItem.text, 'Event:', e)
    const zoneName = legendItem.text.replace(/\u0336/g, '')
    const currentlyVisible = zonesVisibility[zoneName] !== false
    const updatedVisibility = {
      ...zonesVisibility,
      [zoneName]: !currentlyVisible
    }
    setZonesVisibility(updatedVisibility)
    if (currentlyVisible) {
      // Zone is being hidden
      setVisibleZones(prev => {
        const newVisible = prev.filter(name => name !== zoneName)
        localStorage.setItem('visibleZones', JSON.stringify(newVisible))
        return newVisible
      })
 
    } else {
      // Zone is being shown
      setVisibleZones(prev => {
        const newVisible = [...prev, zoneName]
        localStorage.setItem('visibleZones', JSON.stringify(newVisible))
        return newVisible
      })
 
    }
    
    // Update button state based on visibility
    const allZoneNames = allZones.map(z => z.name)
    
    console.log('Legend click - Zone:', zoneName, 'Currently visible:', currentlyVisible)
    
    // Check if ALL zones are hidden after this click
    const allZonesHidden = allZoneNames.every(name => updatedVisibility[name] === false)
    console.log('All zones hidden after this click:', allZonesHidden)
    
    // If all zones are hidden, force button to show "Show All Zones"
    if (allZonesHidden) {
      setAllZonesHidden(true)
      console.log('All zones hidden - forcing button to "Show All Zones"')
    } else {
      // Otherwise set based on the action taken
      // If zone is being hidden (crossed out), show "Show All Zones"
      // If zone is being shown (uncrossed), show "Hide All Zones"
      setAllZonesHidden(currentlyVisible)
      console.log('Zone is being', currentlyVisible ? 'hidden' : 'shown')
      console.log('Setting button to:', currentlyVisible ? 'Show All Zones' : 'Hide All Zones')
    }
    

  }
  
  const mergedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 60, // More space for legend
        bottom: 20,
        left: 30,
        right: 30,
      },
    },
    animation: { duration: 0 },
    elements: {
      line: {
        tension: 0.3,
        borderWidth: 2.5,
      },
      point: {
        radius: 0,
        hoverRadius: 0,
        hitRadius: 12,
      },
    },
    plugins: {
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'xy',
          threshold: 10,
          onZoom: ({ chart }) => {
            clampZoomPan(chart)
          },
        },
        pan: {
          enabled: true,
          mode: 'xy',
          onPan: ({ chart }) => {
            clampZoomPan(chart)
          },
        },
        limits: {
          x: {
            min:
              timeRange === '24h' || dayRanges[timeRange]
                ? extendedMin
                : timeRange === '1h'
                ? extendedMin
                : timeRange === '3h'
                ? extendedMin
                : extendedMin,
            max:
              timeRange === '24h' || dayRanges[timeRange]
                ? extendedMax
                : timeRange === '1h'
                ? extendedMax
                : timeRange === '3h'
                ? extendedMax
                : extendedMax,
          },
          y: {
            min: dataMin, // Use the calculated min (already includes 5°F buffer)
            max: dataMax, // Use the calculated max (already includes 5°F buffer)
          },
        },
      },
      jitterPlugin: { isChartReady: true },
      title: {
        display: true,
        text: 'Temperature Data',
        position: 'top',
        font: { size: 18, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', weight: 'bold' },
        padding: { top: 4, bottom: 20 },
        color: isDarkMode ? '#ccc' : '#222',
      },
      dividerPlugin: { isDarkMode },
      legend: {
        display: true,
        labels: {
          usePointStyle: false,
          boxWidth: 20,
          boxHeight: 10,
          font: function (context) {
            return {
              size: 15,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              weight: 'bold',
              style: 'normal',
              lineHeight: 1.2,
            }
          },
          color: function (context) {
            return isDarkMode ? '#fff' : '#000'
          },
        },
        onClick: onLegendClick,
      },
      tooltip: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
        backgroundColor: isDarkMode ? '#222' : '#fff',
        titleColor: isDarkMode ? '#fff' : '#000',
        bodyColor: isDarkMode ? '#fff' : '#000',
        borderColor: isDarkMode ? '#444' : '#ddd',
        borderWidth: 1,
        titleFont: { size: 15 },
        bodyFont: { size: 14 },
        callbacks: {
          title: function (tooltipItems) {
            const date = new Date(tooltipItems[0].parsed.x)
            if (['2d', '4d', '7d', '2w', '1m', '1y'].includes(timeRange)) {
              return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            } else if (
              timeRange === '24h' ||
              timeRange === '1h' ||
              timeRange === '3h' ||
              timeRange === '6h'
            ) {
              let hours = date.getHours()
              const minutes = String(date.getMinutes()).padStart(2, '0')
              const ampm = hours >= 12 ? 'PM' : 'AM'
              hours = hours % 12 || 12
              const time = `${hours}:${minutes} ${ampm}`
              const day = date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
              return `${time} ${day}`
            } else {
              let hours = date.getHours()
              const minutes = String(date.getMinutes()).padStart(2, '0')
              const ampm = hours >= 12 ? 'PM' : 'AM'
              hours = hours % 12 || 12
              return `${hours}:${minutes} ${ampm}`
            }
          },
          label: function (context) {
            const zoneName = context.dataset.label || ''
            const rawValue = context.parsed.y
            return `${zoneName}: ${Math.round(rawValue)}°${tempUnit}`
          },
        },
      },
    },
    hover: { mode: 'nearest', intersect: false },
    scales: {
      x: {
        type: 'time',
        bounds: 'ticks',
        reverse: false,
        min:
          timeRange === '30m'
            ? custom30mTicks[0]
            : timeRange === '1h'
            ? custom1hTicks[0]
            : timeRange === '3h'
            ? custom3hTicks[0]
            : timeRange === '6h'
            ? custom6hTicks[0]
            : timeRange === '12h'
            ? custom12hTicks[0]
            : timeRange === '48h'
            ? custom48hTicks[0]
            : timeRange === '24h' && custom24hTicks.length
            ? custom24hTicks[0]
            : dayRanges[timeRange] && customDayTicks.length
            ? customDayTicks[0]
            : extendedMin,
        max:
          timeRange === '30m'
            ? custom30mTicks[custom30mTicks.length - 1]
            : timeRange === '1h'
            ? custom1hTicks[custom1hTicks.length - 1]
            : timeRange === '3h'
            ? custom3hTicks[custom3hTicks.length - 1]
            : timeRange === '6h'
            ? custom6hTicks[custom6hTicks.length - 1]
            : timeRange === '12h'
            ? custom12hTicks[custom12hTicks.length - 1]
            : timeRange === '48h'
            ? custom48hTicks[custom48hTicks.length - 1]
            : timeRange === '24h' && custom24hTicks.length
            ? custom24hTicks[custom24hTicks.length - 1]
            : dayRanges[timeRange] && customDayTicks.length
            ? customDayTicks[customDayTicks.length - 1]
            : extendedMax,
        time:
          dayRanges[timeRange]
            ? {
                unit: 'day',
                stepSize: 1,
                tooltipFormat: 'MMM d, yyyy',
                displayFormats: { day: 'MMM d' },
              }
            : timeRange === '24h' || timeRange === '1h' || timeRange === '3h' || timeRange === '6h' || timeRange === '12h' || timeRange === '48h' || timeRange === '30m'
            ? {
                unit: 'minute',
                stepSize: 5,
                tooltipFormat: 'h:mm a MMM d',
                displayFormats: {
                  minute: 'h:mm a',
                  hour: 'MMM d, h a',
                  day: 'MMM d, yyyy',
                },
              }
            : {
                unit:
                  timeRange === '2d'
                    ? 'hour'
                    : timeRange === '4d'
                    ? 'hour'
                    : 'day',
                stepSize:
                  timeRange === '2d'
                    ? 6
                    : timeRange === '4d'
                    ? 12
                    : 1,
                tooltipFormat: 'MMM d, yyyy',
                displayFormats: {
                  minute: 'h:mm a',
                  hour: 'MMM d, h a',
                  day: 'MMM d, yyyy',
                },
              },
        ticks: dayRanges[timeRange]
          ? {
              source: 'auto',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: customDayTicks,
              callback(value) {
                const date = new Date(value)
                return date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              },
            }
          : timeRange === '30m'
          ? {
              source: 'auto',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom30mTicks,
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                let hours = date.getHours()
                const minutes = String(date.getMinutes()).padStart(2, '0')
                const ampm = hours >= 12 ? 'PM' : 'AM'
                hours = hours % 12 || 12
                const time = `${hours}:${minutes} ${ampm}`
                
                // Add "Now" indicator for current time
                return isCurrentTime ? `Now (${time})` : time
              },
            }
          : timeRange === '24h'
          ? {
              source: 'auto',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom24hTicks,
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const timeDiff = Math.abs(date.getTime() - now.getTime())
                const isCurrentTime = timeDiff < 600000 // Within 10 minutes
                
                // Debug logging
                if (timeDiff < 300000) { // Within 5 minutes
                  console.log('24h callback - date:', date, 'now:', now, 'diff:', timeDiff, 'isCurrent:', isCurrentTime)
                }
                
                let hours = date.getHours()
                const minutes = String(date.getMinutes()).padStart(2, '0')
                const ampm = hours >= 12 ? 'PM' : 'AM'
                hours = hours % 12 || 12
                const time = `${hours}:${minutes} ${ampm}`
                const day = date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
                
                // Add "Now" indicator for current time
                return isCurrentTime ? `Now (${time} ${day})` : `${time} ${day}`
              },
            }
          : timeRange === '1h'
          ? {
              source: 'auto',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom1hTicks,
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                let hours = date.getHours()
                const minutes = String(date.getMinutes()).padStart(2, '0')
                const ampm = hours >= 12 ? 'PM' : 'AM'
                hours = hours % 12 || 12
                const time = `${hours}:${minutes} ${ampm}`
                
                // Add "Now" indicator for current time
                return isCurrentTime ? `Now (${time})` : time
              },
            }
          : timeRange === '3h'
          ? {
              source: 'auto',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom3hTicks,
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                let hours = date.getHours()
                const minutes = String(date.getMinutes()).padStart(2, '0')
                const ampm = hours >= 12 ? 'PM' : 'AM'
                hours = hours % 12 || 12
                const time = `${hours}:${minutes} ${ampm}`
                
                // Add "Now" indicator for current time
                return isCurrentTime ? `Now (${time})` : time
              },
            }
          : timeRange === '6h'
          ? {
              source: 'auto',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom6hTicks,
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                let hours = date.getHours()
                const minutes = String(date.getMinutes()).padStart(2, '0')
                const ampm = hours >= 12 ? 'PM' : 'AM'
                hours = hours % 12 || 12
                const time = `${hours}:${minutes} ${ampm}`
                
                // Add "Now" indicator for current time
                return isCurrentTime ? `Now (${time})` : time
              },
            }
          : timeRange === '12h'
          ? {
              source: 'auto',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom12hTicks,
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                let hours = date.getHours()
                const minutes = String(date.getMinutes()).padStart(2, '0')
                const ampm = hours >= 12 ? 'PM' : 'AM'
                hours = hours % 12 || 12
                const time = `${hours}:${minutes} ${ampm}`
                const day = date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
                
                // Add "Now" indicator for current time
                return isCurrentTime ? `Now (${time} ${day})` : `${time} ${day}`
              },
            }
          : timeRange === '48h'
          ? {
              source: 'auto',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom48hTicks,
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                

                
                let hours = date.getHours()
                const minutes = String(date.getMinutes()).padStart(2, '0')
                const ampm = hours >= 12 ? 'PM' : 'AM'
                hours = hours % 12 || 12
                const time = `${hours}:${minutes} ${ampm}`
                const day = date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
                
                // Add "Now" indicator for current time
                return isCurrentTime ? `Now (${time} ${day})` : `${time} ${day}`
              },
            }
          : {
              source: 'auto',
              autoSkip: true,
              maxTicksLimit: 8,
              autoSkipPadding: 50,
              maxRotation: 15,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                
                // Check if this is the last tick (which should be current time)
                const isLastTick = value === Math.max(...customDayTicks, ...custom30mTicks, ...custom1hTicks, ...custom3hTicks, ...custom6hTicks, ...custom12hTicks, ...custom24hTicks, ...custom48hTicks)
                
                if (timeRange === '7d') {
                  // Show date and time for 7-day range
                  const dateString = date.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })
                  let hours = date.getHours()
                  const minutes = String(date.getMinutes()).padStart(2, '0')
                  const ampm = hours >= 12 ? 'PM' : 'AM'
                  hours = hours % 12 || 12
                  const time = `${hours}:${minutes} ${ampm}`
                  const fullLabel = `${dateString} ${time}`
                  return isLastTick ? `Now (${fullLabel})` : fullLabel
                } else if (['4d', '2w', '1m', '1y'].includes(timeRange)) {
                  const dateString = date.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                  return isLastTick ? `Now (${dateString})` : dateString
                } else {
                  let hours = date.getHours()
                  const minutes = String(date.getMinutes()).padStart(2, '0')
                  const ampm = hours >= 12 ? 'PM' : 'AM'
                  hours = hours % 12 || 12
                  const time = `${hours}:${minutes} ${ampm}`
                  return isLastTick ? `Now (${time})` : time
                }
              },
            },
        grid: {
          display: true,
          color: isDarkMode ? '#2226' : '#ccc7',
          drawTicks: false,
          drawOnChartArea: true,
          drawBorder: false,
          borderColor: isDarkMode ? '#666' : '#999',
        },
        title: {
          display: true,
          text: 'Time',
          font: { size: 15, family: 'Segoe UI', weight: 'bold' },
          color: isDarkMode ? '#ccc' : '#222',
        },
      },
      y: {
        min: dataMin,
        max: dataMax,

        ticks: {
          stepSize: 10, // Increased step size for better spacing
          maxTicksLimit: 8, // Allow more ticks for better range coverage
          color: isDarkMode ? '#ccc' : '#222',
          font: { size: 13, family: 'Segoe UI' },
          callback: function (value) {
            return `${Math.round(value)}°${tempUnit}`
          },
          beginAtZero: false,
        },
        grid: {
          display: true,
          drawTicks: false,
          drawOnChartArea: true,
          drawBorder: false,
          color: isDarkMode ? '#2226' : '#ccc7',
        },
        title: {
          display: true,
          text: 'Temperature',
          color: isDarkMode ? '#ccc' : '#222',
          font: { family: 'Segoe UI', size: 15 },
        },
      },
    },
  }
              return (
    <>
      <div className="camera-switcher-bar">
        <button
          onClick={() => handleCameraChange('planck_1')}
          className={`camera-switcher-btn${selectedCamera === 'planck_1' ? ' selected' : ''}`}
        >
          <span>📷 Left Camera</span>
        </button>
        <button
          onClick={() => handleCameraChange('planck_2')}
          className={`camera-switcher-btn${selectedCamera === 'planck_2' ? ' selected' : ''}`}
        >
          <span>📷 Right Camera</span>
        </button>
      </div>

      <div className={`thermal-container${isDarkMode ? ' dark-mode' : ''}`}>
        <Line ref={chartRef} data={data} options={mergedOptions} />
      </div>

      <div
        className="chart-button-container"
        style={{
          color: isDarkMode ? '#eee' : undefined,
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            className="chart-button"
            onClick={() => setShowExportMenu(prev => !prev)}
            style={{
              borderColor: isDarkMode ? '#fff' : '#000',
              color: isDarkMode ? '#fff' : '#000',
            }}
          >
            <span>Save Graph ▼</span>
          </button>
          {showExportMenu && (
            <div className="pdf-dropdown" 
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                boxShadow: isDarkMode
                  ? '0px 4px 8px rgba(255,255,255,0.15)'
                  : '0px 4px 8px rgba(0,0,0,0.15)',
                zIndex: 10,
                borderRadius: 4,
                minWidth: 160,
                maxHeight: 120,
                overflowY: 'auto',
                color: isDarkMode ? '#eee' : '#222',
              }}
            >
              <div
                onClick={() => {
                  setShowExportMenu(false)
                  handleSaveGraph()
                }}
                style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #666' }}
              >
                Save as PNG
              </div>
              <div
                onClick={() => {
                  setShowExportMenu(false)
                  handleExportCSV()
                }}
                style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #666' }}
              >
                Save as CSV
              </div>
              <div
                onClick={() => {
                  setShowExportMenu(false)
                  handleExportPDF()
                }}
                style={{ padding: 8, cursor: 'pointer' }}
              >
                Save as PDF
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleResetZoom}
          className="chart-button"
          style={{
            borderColor: isDarkMode ? '#fff' : '#000',
            color: isDarkMode ? '#fff' : '#000',
          }}
        >
          <span>Reset Zoom</span>
        </button>

        <button
          onClick={toggleAllZones}
          className="chart-button"
          style={{
            borderColor: '#dc2626',
            color: '#dc2626',
            backgroundColor: allZonesHidden ? '#dc2626' : 'transparent',
            color: allZonesHidden ? '#fff' : '#dc2626',
          }}
        >

          <span>
            {allZonesHidden ? (
              <span style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '2px solid #999',
                backgroundColor: 'transparent',
                borderRadius: '50%',
                position: 'relative',
                marginRight: '4px',
                top: '1px'
              }}>
                <span style={{
                  position: 'absolute',
                  top: '42%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '4px',
                  height: '4px',
                  border: '1px solid #999',
                  backgroundColor: 'transparent',
                  borderRadius: '50%'
                }}></span>
              </span>
            ) : null}
            {allZonesHidden ? 'Show All Zones' : 'Hide All Zones'}
          </span>
        </button>


        




        <select
          className="chart-dropdown"
          value={timeRange}
          onChange={e => setTimeRange(e.target.value)}
          style={{
            borderColor: isDarkMode ? '#fff' : '#000',
            color: isDarkMode ? '#fff' : '#000',
            backgroundColor: 'transparent',
            cursor: 'pointer',
          }}
        >
          <option value="30m">Last 30 Minutes</option>
          <option value="1h">Last Hour</option>
          <option value="3h">Last 3 Hours</option>
          <option value="6h">Last 6 Hours</option>
          <option value="12h">Last 12 Hours</option>
          <option value="24h">Last 24 Hours</option>
          <option value="48h">Last 48 Hours</option>
          <option value="2d">Last 2 Days</option>
          <option value="4d">Last 4 Days</option>
          <option value="7d">Last 7 Days</option>
          <option value="2w">Last 2 Weeks</option>
          <option value="1m">Last Month</option>
          <option value="1y">Last Year</option>
        </select> 
      </div>
    </>
  )
}