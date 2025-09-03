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

const hoverDotsPlugin = {
  id: 'hoverDotsPlugin',
  beforeDatasetsDraw(chart) {
    if (!chart.options.plugins.hoverDotsPlugin?.isChartReady) return
    
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
    
    // Show dots on all lines at the same x-position when hovering
    if (tooltip.opacity === 1 && tooltip.dataPoints && tooltip.dataPoints.length > 0) {
      const hoveredPoint = tooltip.dataPoints[0]
      const hoveredDataIndex = hoveredPoint.dataIndex
      const hoveredTime = hoveredPoint.parsed.x
      
      // Show dots on all visible datasets at the same time position
      chart.data.datasets.forEach((dataset, dsIndex) => {
        // Reset all point radii to 0 first
        if (dataset.data && Array.isArray(dataset.data)) {
          dataset.data.forEach((point, pointIndex) => {
            if (typeof point === 'object' && point !== null) {
              point.pointRadius = 0
            }
          })
        }
        
        // Find the data point at the same time position and show it
        if (dataset.data && dataset.data[hoveredDataIndex]) {
          const dataPoint = dataset.data[hoveredDataIndex]
          if (dataPoint && typeof dataPoint === 'object') {
            // Show dot only if the dataset is not hidden
            if (!dataset.hidden) {
              dataPoint.pointRadius = 5
              dataPoint.pointHoverRadius = 6
            }
          }
        }
      })
    } else {
      // Hide all points when not hovering
      chart.data.datasets.forEach(dataset => {
        if (dataset.data && Array.isArray(dataset.data)) {
          dataset.data.forEach((point, pointIndex) => {
            if (typeof point === 'object' && point !== null) {
              point.pointRadius = 0
              point.pointHoverRadius = 0
            }
          })
        }
      })
    }
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
  hoverDotsPlugin,
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
  const [allZonesHidden, setAllZonesHidden] = useState(false) // Always start with zones visible

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('thermalHistory')
    return saved
      ? JSON.parse(saved, (key, val) => (key === 'time' ? new Date(val) : val))
      : []
  })
  const [initialRange, setInitialRange] = useState(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isCameraSwitching, setIsCameraSwitching] = useState(false)
  
  // Monitor dropdown open state
  useEffect(() => {
    const handleDropdownState = () => {
      const activeElement = document.activeElement
      const isOpen = activeElement === document.querySelector('.chart-dropdown')
      setIsDropdownOpen(isOpen)
    }
    
    document.addEventListener('click', handleDropdownState)
    document.addEventListener('focusin', handleDropdownState)
    
    return () => {
      document.removeEventListener('click', handleDropdownState)
      document.removeEventListener('focusin', handleDropdownState)
    }
  }, [])
  
  const [zonesVisibility, setZonesVisibility] = useState(() => {
    // Load saved zone visibility from localStorage or use default
    const thermalZoneNames = Array.from({ length: 8 }, (_, i) => `Zone_${i + 1}`)
    const savedVisibility = localStorage.getItem('zonesVisibility')
    
    if (savedVisibility) {
      try {
        const parsed = JSON.parse(savedVisibility)
        // Ensure all zones exist in the saved data
        thermalZoneNames.forEach(name => {
          if (!(name in parsed)) {
            parsed[name] = true // Default to visible if zone not in saved data
          }
        })
        return parsed
      } catch (e) {
        console.warn('Failed to parse saved zone visibility:', e)
      }
    }
    
    // Default: all zones visible
    const initialVisibility = {}
    thermalZoneNames.forEach(name => { initialVisibility[name] = true })
    return initialVisibility
  })

  // Single useEffect to handle all initialization - prevents flickering
  useEffect(() => {
    const thermalZoneNames = Array.from({ length: 8 }, (_, i) => `Zone_${i + 1}`)
    
    // Load saved zone visibility from localStorage when camera changes
    const savedVisibility = localStorage.getItem('zonesVisibility')
    let zonesToShow = thermalZoneNames
    
    if (savedVisibility) {
      try {
        const parsed = JSON.parse(savedVisibility)
        // Use saved visibility, but ensure all zones exist
        thermalZoneNames.forEach(name => {
          if (!(name in parsed)) {
            parsed[name] = true // Default to visible if zone not in saved data
          }
        })
        
        // Set the zonesVisibility to the saved state
        setZonesVisibility(parsed)
        
        // Determine which zones should be visible based on saved state
        zonesToShow = thermalZoneNames.filter(name => parsed[name] !== false)
        
        // Update allZonesHidden based on saved state
        const allHidden = thermalZoneNames.every(name => parsed[name] === false)
        setAllZonesHidden(allHidden)
        
        console.log('Loaded saved zone visibility:', parsed)
      } catch (e) {
        console.warn('Failed to parse saved zone visibility:', e)
        // Fallback to all zones visible
        setZonesVisibility({})
        thermalZoneNames.forEach(name => { setZonesVisibility(prev => ({ ...prev, [name]: true })) })
      }
    } else {
      // No saved state, default to all visible
      const newVisibility = {}
      thermalZoneNames.forEach(name => { newVisibility[name] = true })
      setZonesVisibility(newVisibility)
      setAllZonesHidden(false)
    }
    
    // Set visible zones based on loaded state
    setVisibleZones(zonesToShow)
    
    console.log('Camera change: Zones visibility loaded from localStorage')
    
    // eslint-disable-next-line
  }, [selectedCamera])

  // Immediately update chart with latest data when component mounts
  useEffect(() => {
    // Wait for chart to be ready and then update with latest data
    const timer = setTimeout(() => {
      if (chartRef.current && isChartReady) {
        const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
        const testData = localStorage.getItem(testDataKey)
        if (testData) {
          try {
            const parsedData = JSON.parse(testData, (key, val) => (key === 'time' ? new Date(val) : val))
            console.log(`📊 Initial load: Found ${parsedData.length} data points for ${timeRange}`)
            // Force chart to update with latest data
            chartRef.current.update('none')
          } catch (error) {
            console.warn('Failed to load initial test data:', error.message)
          }
        } else {
          console.log(`⚠️ No initial data found for ${timeRange}`)
        }
      }
    }, 100) // Small delay to ensure chart is fully rendered

    return () => clearTimeout(timer)
  }, [isChartReady, timeRange, selectedCamera]) // Depend on chart readiness and current settings

  // Keep states in sync during user interactions (not initial mount)
  useEffect(() => {
    const thermalZoneNames = Array.from({ length: 8 }, (_, i) => `Zone_${i + 1}`)
    const nextVisible = thermalZoneNames.filter(name => zonesVisibility[name] !== false)
    const allVisible = thermalZoneNames.every(name => zonesVisibility[name] !== false)
    
    // Only update if actually different to avoid loops
    if (JSON.stringify(visibleZones) !== JSON.stringify(nextVisible)) {
      setVisibleZones(nextVisible)
    }
    
    if (allZonesHidden === allVisible) { // If button state doesn't match visibility
      setAllZonesHidden(!allVisible)
    }
    
    // eslint-disable-next-line
  }, [zonesVisibility])

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
        console.log(`🔄 Generating initial data for ${timeRange} on ${selectedCamera}`)
        const testData = []
        const now = new Date()
        const startTime = new Date(now.getTime() - (config.entries * config.interval))
        
        for (let i = 0; i < config.entries; i++) {
          const time = new Date(startTime.getTime() + (i * config.interval))
          const readings = {}
          
          // Generate horizontal zones with spread-out zig-zag variations like reference image
          // Use fixed thermal zones for consistent display
          Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
            // Each zone gets its own distinct temperature level, separated by 8°F for better spacing
            const zoneBaseTemp = 80 + (zoneIndex * 8) // Zone 0: ~80°F, Zone 1: ~88°F, Zone 2: ~96°F, etc.
            
            // Create spread-out zig-zag patterns within each zone's band
            const primaryWave = Math.sin((i / 30) * Math.PI + zoneIndex) * 1.5 // Main wave pattern
            const secondaryWave = Math.cos((i / 20) * Math.PI + zoneIndex * 2) * 1.0 // Secondary variation
            const tertiaryWave = Math.sin((i / 45) * Math.PI + zoneIndex * 3) * 0.8 // Tertiary variation
            const randomNoise = (Math.random() - 0.5) * 1.2 // Random fluctuation
            
            // Combine all variations for realistic spread-out zig-zag pattern
            const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise
            
            // Keep within zone's range (±2.5°F from base)
            const minTemp = zoneBaseTemp - 2.5
            const maxTemp = zoneBaseTemp + 2.5
            const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
            
            readings[z.name] = clampedTemp
          })
          
          testData.push({ time, readings })
        }
        
        try {
          localStorage.setItem(testDataKey, JSON.stringify(testData))
          console.log(`✅ Generated ${testData.length} initial data points for ${timeRange}`)
        } catch (error) {
          console.warn(`Failed to store initial test data:`, error.message)
        }
      } else {
        console.log(`📊 Found existing data for ${timeRange}: ${JSON.parse(localStorage.getItem(testDataKey)).length} entries`)
      }
    }
  }, [timeRange, selectedCamera])

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



  // DISABLED: Don't use actual zone data for thermal chart - only use test data
  // useEffect(() => {
  //   const now = new Date()
  //   const readings = {}
  //   zones
  //     .filter(z => z.camera === selectedCamera)
  //     .forEach(z => {
  //       readings[z.name] = z.temperature
  //     })
  //   if (Object.keys(readings).length > 0) {
  //     setHistory(prev => {
  //       const lastEntry = prev[prev.length - 1]
  //       if (lastEntry && now.getTime() === new Date(lastEntry.time).getTime()) {
  //         return prev
  //       }
  //       const updated = [...prev, { time: now, readings }]
  //       try {
  //         localStorage.setItem('thermalHistory', JSON.stringify(updated))
  //       } catch (error) {
  //         console.warn('Failed to store thermal history in localStorage:', error.message)
  //       }
  //       return updated
  //     })
  //   }
  //   }, [zones, selectedCamera])

  // Test data configuration - all ranges use 5000 entries
  const testDataConfig = {
    '30m': { entries: 5000, interval: 360, peakChance: 0.05 },
    '1h': { entries: 5000, interval: 720, peakChance: 0.06 },
    '3h': { entries: 5000, interval: 3240, peakChance: 0.07 },
    '6h': { entries: 5000, interval: 4320, peakChance: 0.08 },
    '12h': { entries: 5000, interval: 8640, peakChance: 0.09 },
    '24h': { entries: 5000, interval: 17280, peakChance: 0.10 },
    '48h': { entries: 5000, interval: 34560, peakChance: 0.12 },
    '2d': { entries: 5000, interval: 34560, peakChance: 0.15 },
    '4d': { entries: 5000, interval: 69120, peakChance: 0.18 },
    '7d': { entries: 5000, interval: 120960, peakChance: 0.20 },
    '2w': { entries: 5000, interval: 241920, peakChance: 0.25 },
    '1m': { entries: 5000, interval: 518400, peakChance: 0.30 },
    '1y': { entries: 5000, interval: 6307200, peakChance: 0.35 }
  }

  // Generate test data for all time ranges
  useEffect(() => {
    const config = testDataConfig[timeRange]
    if (!config) return

    // Only generate data if it doesn't exist - don't clear existing data
    const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    const existingData = localStorage.getItem(testDataKey)
    
    // If data already exists, don't regenerate it
    if (existingData) {
      console.log(`📊 Using existing data for ${timeRange}: ${JSON.parse(existingData).length} entries`)
      return
    }
    
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
      
      // Generate horizontal zones with spread-out zig-zag variations like reference image
      // Use fixed thermal zones for consistent display
      Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
        // Camera-specific offset (small difference between cameras)
        const isLeftCamera = selectedCamera === 'planck_1'
        const cameraOffset = isLeftCamera ? 2 : 0 // 2°F difference between cameras
        
        // Each zone gets its own distinct temperature level, separated by 8°F for better spacing
        const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset // Zone 0: ~80°F, Zone 1: ~88°F, etc.
        
        // Create spread-out zig-zag patterns within each zone's band
        const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8 // Main wave pattern
        const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2 // Secondary variation
        const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0 // Tertiary variation
        const randomNoise = (Math.random() - 0.5) * 1.4 // Random fluctuation
        const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8 // Daily variation
        
        // Combine all variations for realistic spread-out zig-zag pattern
        const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
        
        // Keep within zone's range (±2.5°F from base)
        const minTemp = zoneBaseTemp - 2.5
        const maxTemp = zoneBaseTemp + 2.5
        const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
        
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

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update()
    }
  }, [zonesVisibility, visibleZones])

  // Force chart to re-read test data every 10 seconds and immediately on load
  useEffect(() => {
    // Immediately update chart with latest data when component mounts or timeRange/camera changes
    const updateChartWithLatestData = () => {
      const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
      const testData = localStorage.getItem(testDataKey)
      if (testData) {
        try {
          const parsedData = JSON.parse(testData, (key, val) => (key === 'time' ? new Date(val) : val))
          // Force chart to update with new data
          if (chartRef.current) {
            chartRef.current.update('none')
          }
        } catch (error) {
          console.warn('Failed to re-read test data:', error.message)
        }
      }
    }

    // Update immediately on mount/change
    updateChartWithLatestData()
    
    // Then set up interval for continuous updates
    const interval = setInterval(updateChartWithLatestData, 10000) // Every 10 seconds

    return () => clearInterval(interval)
  }, [timeRange, selectedCamera])





  // Update chart and advance data every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Generate new data entry
      const now = new Date()
      const readings = {}
      
      // Generate horizontal zones with spread-out zig-zag variations like reference image
      // Use fixed thermal zones for consistent display
      Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
        // Camera-specific offset (small difference between cameras)
        const isLeftCamera = selectedCamera === 'planck_1'
        const cameraOffset = isLeftCamera ? 2 : 0 // 2°F difference between cameras
        
        // Each zone gets its own distinct temperature level, separated by 8°F for better spacing
        const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset // Zone 0: ~80°F, Zone 1: ~88°F, etc.
        
        // Create spread-out zig-zag patterns within each zone's band
        const timeBasedIndex = Math.floor(now.getTime() / 10000) // Use time-based index for consistent patterns
        const primaryWave = Math.sin((timeBasedIndex / 35) * Math.PI + zoneIndex) * 1.8 // Main wave pattern
        const secondaryWave = Math.cos((timeBasedIndex / 25) * Math.PI + zoneIndex * 2) * 1.2 // Secondary variation
        const tertiaryWave = Math.sin((timeBasedIndex / 50) * Math.PI + zoneIndex * 3) * 1.0 // Tertiary variation
        const randomNoise = (Math.random() - 0.5) * 1.4 // Random fluctuation
        const dailyPattern = Math.sin((now.getHours() / 24) * Math.PI * 2) * 0.8 // Daily variation
        
        // Combine all variations for realistic spread-out zig-zag pattern
        const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
        
        // Keep within zone's range (±2.5°F from base)
        const minTemp = zoneBaseTemp - 2.5
        const maxTemp = zoneBaseTemp + 2.5
        const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
        
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
      
      // Update ALL time range test data for the current camera every 10 seconds
      Object.keys(testDataConfig).forEach(range => {
        const testDataKey = `thermalHistory${range}_${selectedCamera}`
        const existingTestData = localStorage.getItem(testDataKey)
        if (existingTestData) {
          try {
            const parsedData = JSON.parse(existingTestData, (key, val) => (key === 'time' ? new Date(val) : val))
            
            // Always add new data every 10 seconds for ALL time ranges
            const updatedTestData = [...parsedData, { time: now, readings }]
            localStorage.setItem(testDataKey, JSON.stringify(updatedTestData))
          } catch (error) {
            console.warn(`Failed to update ${range} test data:`, error.message)
          }
        }
      })
      
      // Force chart to re-read data from localStorage and update
      if (chartRef.current) {
        // Trigger a re-render by updating the component state
        setHistory(prev => [...prev]) // Force re-render
        chartRef.current.update('none') // Force update without animation
      }
    }, 10000) // 10 seconds

    return () => clearInterval(interval) // Cleanup on unmount
  }, [allZones, selectedCamera, timeRange])





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

  const handleCameraChange = async (cam) => {
    if (cam === selectedCamera) return // Don't switch if same camera
    
    setIsCameraSwitching(true)
    
    try {
      // Simulate a small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setSelectedCamera(cam)
      
      // Force immediate chart refresh when camera changes
      if (chartRef.current) {
        chartRef.current.update('none') // Force complete update
      }
    } finally {
      setIsCameraSwitching(false)
    }
  }

  const toggleAllZones = () => {
    // Use thermalZones instead of allZones since that's what's actually displayed in the chart
    const thermalZoneNames = Array.from({ length: 8 }, (_, i) => `Zone_${i + 1}`)
    console.log('toggleAllZones called, allZonesHidden:', allZonesHidden)
    console.log('toggleAllZones called, thermalZoneNames:', thermalZoneNames)
    console.log('toggleAllZones called, allZones names:', allZones.map(z => z.name))
    
    if (allZonesHidden) {
      // Show all zones
      const newVisibility = { ...zonesVisibility }
      thermalZoneNames.forEach(name => { newVisibility[name] = true })
      console.log('Showing all zones, newVisibility:', newVisibility)
      setZonesVisibility(newVisibility)
      setVisibleZones(thermalZoneNames)
      setAllZonesHidden(false)
      localStorage.setItem('zonesVisibility', JSON.stringify(newVisibility))
      localStorage.setItem('visibleZones', JSON.stringify(thermalZoneNames))
    } else {
      // Hide all zones
      const newVisibility = { ...zonesVisibility }
      thermalZoneNames.forEach(name => { newVisibility[name] = false })
      console.log('Hiding all zones, newVisibility:', newVisibility)
      setZonesVisibility(newVisibility)
      setVisibleZones([])
      setAllZonesHidden(true)
      localStorage.setItem('zonesVisibility', JSON.stringify(newVisibility))
      localStorage.setItem('visibleZones', JSON.stringify([]))
    }
    
    // Force immediate chart update to refresh legend
    if (chartRef.current) {
      console.log('Forcing chart update after toggleAllZones')
      chartRef.current.update('none')
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
    // No loading state needed - test data is generated immediately

  const timeLimit = timeMap[timeRange] || timeMap['7d']
  const currentTime = Date.now()
  const rangeCutoff = currentTime - timeLimit

  // ALWAYS use test data - ignore actual history data
  let dataToUse = []
  const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
  const testData = localStorage.getItem(testDataKey)
  if (testData) {
    try {
      dataToUse = JSON.parse(testData, (key, val) => (key === 'time' ? new Date(val) : val))
      console.log(`📊 Using test data for ${timeRange} on ${selectedCamera}: ${dataToUse.length} entries`)
    } catch (e) {
      console.error(`❌ Error parsing ${timeRange} test data for ${selectedCamera}:`, e)
      dataToUse = [] // Use empty array instead of actual history
    }
  } else {
    console.log(`⚠️ No ${timeRange} test data found for ${selectedCamera} in localStorage`)
    dataToUse = [] // Use empty array instead of actual history
  }

  const sorted = dataToUse.sort((a, b) => new Date(a.time) - new Date(b.time)) // Don't filter test data by time

  // Create a fixed set of zones for thermal chart display (independent of actual data)
  const thermalZones = Array.from({ length: 8 }, (_, i) => ({
    name: `Zone_${i + 1}`,
    camera: selectedCamera,
    index: i
  }))
  
  const zonesForCamera = thermalZones // Use fixed thermal zones for consistent display
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
      


    const isHidden = zonesVisibility[zone.name] === false
    const smoothed = zoneDataPoints.length > 0
      ? smoothData(zoneDataPoints.slice(0, -1), 5)
      : []
    const combinedData = zoneDataPoints.length > 0
      ? [...smoothed, zoneDataPoints[zoneDataPoints.length - 1]]
      : []
    
    // Add vertical offset to spread out the zone lines
    const offsetData = combinedData.map(point => ({
      x: point.x,
      y: point.y + (idx * 20) // Add 20° spacing between each zone line
    }))
    // Professional color palette - business-appropriate colors
    const professionalColors = [
      '#1f77b4', // Professional blue
      '#ff7f0e', // Professional orange
      '#2ca02c', // Professional green
      '#d62728', // Professional red
      '#9467bd', // Professional purple
      '#8c564b', // Professional brown
      '#e377c2', // Professional pink
      '#17becf'  // Professional teal
    ]
    const color = professionalColors[idx % professionalColors.length]
    
    return {
      label: zone.name,
      data: offsetData,
      borderColor: color,
      backgroundColor: 'transparent',
      borderDash: [], // All lines are solid
      spanGaps: true,
      pointRadius: 0, // No points visible by default
      pointHoverRadius: 5, // Show points on hover
      pointHitRadius: 12, // Larger hit area for easier hovering
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointBorderWidth: 1,
      yAxisID: 'y',
      order: idx, // Use index for ordering
      hidden: isHidden,
      borderWidth: 2, // Thicker lines to match reference image
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
  
  // Calculate y-axis range to ensure max is always higher than highest data point
  if (allChartTemps.length === 0) {
    dataMin = tempUnit === 'F' ? 75 : Math.round(((75 - 32) * 5) / 9)
    dataMax = tempUnit === 'F' ? 120 : Math.round(((120 - 32) * 5) / 9)
  } else {
    // Use actual min/max with buffer to ensure max is always higher than data
    const actualMin = Math.min(...allChartTemps)
    const actualMax = Math.max(...allChartTemps)
    
    // Buffer to show all zones clearly and ensure max is above highest data point
    dataMin = Math.max(75, actualMin - 3)
    dataMax = actualMax + 15 // Always add 15° buffer above highest data point for better spacing
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
    // Generate ticks every 5 minutes for 30m (6 ticks total, including first)
    for (let i = 0; i <= 6; i++) {
      const tick = new Date(start.getTime() + i * 5 * 60 * 1000)
      custom30mTicks.push(tick.getTime())
    }
    // Add current time as the last tick
    custom30mTicks.push(currentTime)
    extendedMin = start.getTime() // Start from exactly 30 minutes ago
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
    extendedMin = custom24hTicks[0] // Use first tick (exactly 24 hours ago)
    startTime = extendedMin
  } else if (timeRange === '1h') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0) // Round down to nearest minute like other ranges
    const start = new Date(now.getTime() - 60 * 60 * 1000)
    for (let i = 0; i <= 12; i++) {
      const tick = new Date(start.getTime() + i * 5 * 60 * 1000)
      custom1hTicks.push(tick.getTime())
    }
    // Add current time as the last tick
    custom1hTicks.push(currentTime)
    console.log('1h ticks:', custom1hTicks.length, 'Current time added:', new Date(currentTime))
    extendedMin = custom1hTicks[0] // Use first tick (exactly 1 hour ago)
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
    extendedMin = custom3hTicks[0] // Use first tick (exactly 3 hours ago)
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
    extendedMin = custom6hTicks[0] // Use first tick (exactly 6 hours ago)
    extendedMax = currentTime
    startTime = extendedMin
  } else if (timeRange === '12h') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0)
    const start = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    // Generate ticks every 2 hours for 12h (6 ticks total, including first)
    for (let i = 0; i <= 6; i++) {
      const tick = new Date(start.getTime() + i * 2 * 60 * 60 * 1000)
      custom12hTicks.push(tick.getTime())
    }
    // Add current time as the last tick
    custom12hTicks.push(currentTime)
    console.log('12h ticks:', custom12hTicks.length, 'Current time added:', new Date(currentTime))
    extendedMin = custom12hTicks[0] // Use first tick (exactly 12 hours ago)
    extendedMax = currentTime
    startTime = extendedMin
  } else if (timeRange === '48h') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0)
    const start = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    // Generate ticks every 6 hours for 48h (8 ticks total, including first)
    for (let i = 0; i <= 8; i++) {
      const tick = new Date(start.getTime() + i * 6 * 60 * 60 * 1000)
      custom48hTicks.push(tick.getTime())
    }
    // Add current time as the last tick
    custom48hTicks.push(currentTime)
    console.log('48h ticks:', custom48hTicks.length, 'Current time added:', new Date(currentTime))
    extendedMin = custom48hTicks[0] // Use first tick (exactly 48 hours ago)
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
    extendedMin = customDayTicks[1] // Skip first tick, use second tick
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
    // Save zonesVisibility to localStorage for persistence across camera switches
    localStorage.setItem('zonesVisibility', JSON.stringify(updatedVisibility))
    
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
    const thermalZoneNames = Array.from({ length: 8 }, (_, i) => `Zone_${i + 1}`)
    
    console.log('Legend click - Zone:', zoneName, 'Currently visible:', currentlyVisible)
    
    // Check if ALL zones are hidden after this click
    const allZonesHidden = thermalZoneNames.every(name => updatedVisibility[name] === false)
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
    
    // Force immediate chart update to refresh legend
    if (chartRef.current) {
      chartRef.current.update('none')
    }
  }
  
  const mergedOptions = {
    responsive: true,
    maintainAspectRatio: true,
    layout: {
      padding: {
        top: 20, // Fixed padding to prevent shifting
        bottom: 30, // Fixed padding for time label
        left: 40, // Fixed padding for temperature label
        right: 20, // Fixed padding
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
        hoverRadius: 5,
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
      hoverDotsPlugin: { isChartReady: false }, // Disable to remove extra horizontal lines
      title: {
        display: false, // Title is now displayed above the container
      },

      legend: {
        display: true,
        labels: {
          usePointStyle: false,
          boxWidth: 20,
          boxHeight: 10,
          generateLabels: function(chart) {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels
            const labels = original.call(this, chart)
            
            return labels.map(label => {
              const zoneName = label.text.replace(/\u0336/g, '') // Clean the name first
              
              // Only cross out if explicitly set to false - ignore everything else
              const isHidden = zonesVisibility[zoneName] === false
              
              if (isHidden) {
                label.text = zoneName.split('').join('\u0336') + '\u0336'
              } else {
                label.text = zoneName
              }
              
              // Make sure the legend box is filled with the dataset color
              if (label.datasetIndex !== undefined && chart.data.datasets[label.datasetIndex]) {
                const dataset = chart.data.datasets[label.datasetIndex]
                label.fillStyle = dataset.borderColor || dataset.backgroundColor
                label.strokeStyle = dataset.borderColor || dataset.backgroundColor
              }
              
              return label
            })
          },
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
            // Return the actual dataset color for filled legend squares
            if (context.datasetIndex !== undefined && context.chart.data.datasets[context.datasetIndex]) {
              return context.chart.data.datasets[context.datasetIndex].borderColor || (isDarkMode ? '#fff' : '#000')
            }
            return isDarkMode ? '#fff' : '#000'
          },

        },
        onClick: onLegendClick,
      },
      tooltip: {
        mode: 'index',
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
    hover: { mode: 'index', intersect: false },
    scales: {
      x: {
        type: 'time',
        bounds: 'ticks',
        reverse: false,
        min: extendedMin,
        max: extendedMax,
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
                
                // Hide the leftmost tick label (first tick)
                if (value === customDayTicks[0]) {
                  return '' // Return empty string to hide first label
                }
                
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
              values: custom30mTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the leftmost tick label (first tick)
                if (value === custom30mTicks[0]) {
                  return '' // Return empty string to hide first label
                }
                
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
              values: custom24hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const timeDiff = Math.abs(date.getTime() - now.getTime())
                const isCurrentTime = timeDiff < 600000 // Within 10 minutes
                
                // Hide the leftmost tick label (first tick)
                if (value === custom24hTicks[0]) {
                  return '' // Return empty string to hide first label
                }
                
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
              values: custom1hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the leftmost tick label (first tick)
                if (value === custom1hTicks[0]) {
                  return '' // Return empty string to hide first label
                }
                
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
              values: custom3hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the leftmost tick label (first tick)
                if (value === custom3hTicks[0]) {
                  return '' // Return empty string to hide first label
                }
                
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
              values: custom6hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the leftmost tick label (first tick)
                if (value === custom6hTicks[0]) {
                  return '' // Return empty string to hide first label
                }
                
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
              values: custom12hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the leftmost tick label (first tick)
                if (value === custom12hTicks[0]) {
                  return '' // Return empty string to hide first label
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
          : timeRange === '48h'
          ? {
              source: 'auto',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom48hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the leftmost tick label (first tick)
                if (value === custom48hTicks[0]) {
                  return '' // Return empty string to hide first label
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
          display: false, // Disable vertical grid lines
          color: isDarkMode ? '#2226' : '#ccc7',
          drawTicks: false,
          drawOnChartArea: false,
          drawBorder: false,
          borderColor: 'transparent', // Remove any border that might create extra lines
        },
        title: {
          display: true,
          text: 'Time',
          font: { size: 15, family: 'Segoe UI', weight: 'bold' },
          color: isDarkMode ? '#ccc' : '#222',
          padding: { top: 10, bottom: 5 },
        },
      },
      y: {
        min: dataMin,
        max: dataMax,
        ticks: {
          stepSize: 5, // Smaller step size for more granular spacing
          maxTicksLimit: 12, // Allow more ticks for better spacing
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
          borderDash: [], // Solid lines
          lineWidth: 0.5, // Very thin lines to reduce interactivity
        },
        title: {
          display: true,
          text: 'Temperature',
          color: isDarkMode ? '#ccc' : '#222',
          font: { family: 'Segoe UI', size: 15 },
          padding: { top: 0, bottom: 0, left: 5, right: 5 },
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
          disabled={isCameraSwitching}
        >
          <span>📷 Left Camera</span>
        </button>
        <button
          onClick={() => handleCameraChange('planck_2')}
          className={`camera-switcher-btn${selectedCamera === 'planck_2' ? ' selected' : ''}`}
          disabled={isCameraSwitching}
        >
          <span>📷 Right Camera</span>
        </button>
      </div>

      <div className={`thermal-container${isDarkMode ? ' dark-mode' : ''}`}>
        <h2 
          style={{
            textAlign: 'center',
            margin: '0 0 20px 0',
            fontSize: '24px',
            fontWeight: 'bold',
            color: isDarkMode ? '#ccc' : '#222',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          }}
        >
          Temperature Data
        </h2>
        <hr 
          style={{
            border: 'none',
            height: '1px',
            backgroundColor: isDarkMode ? '#444' : '#ddd',
            margin: '0 0 20px 0',
            width: '100%'
          }}
        />
        <div className="chart-container">
          <Line 
            ref={chartRef} 
            data={data} 
            options={mergedOptions}
          />
          {isCameraSwitching && (
            <div className="camera-switching-overlay">
              <div className="loading-spinner-large"></div>
              <h2>Switching Cameras...</h2>
            </div>
          )}
        </div>
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


        




        <div style={{ position: 'relative', display: 'inline-block' }}>
          <select
            className="chart-dropdown"
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
            style={{
              borderColor: isDarkMode ? '#fff' : '#000',
              color: isDarkMode ? '#fff' : '#000',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              paddingRight: '30px', // Make room for the arrow
              appearance: 'none', // Remove default arrow
              WebkitAppearance: 'none', // For Safari
              MozAppearance: 'none', // For Firefox
            }}
          >
            <option value="30m" style={{ backgroundColor: '#22c55e', color: '#fff', padding: '8px 12px' }}>Last 30 Minutes</option>
            <option value="1h" style={{ backgroundColor: '#22c55e', color: '#fff', padding: '8px 12px' }}>Last Hour</option>
            <option value="6h" style={{ backgroundColor: '#22c55e', color: '#fff', padding: '8px 12px' }}>Last 6 Hours</option>
            <option value="12h" style={{ backgroundColor: '#22c55e', color: '#fff', padding: '8px 12px' }}>Last 12 Hours</option>
            <option value="24h" style={{ backgroundColor: '#22c55e', color: '#fff', padding: '8px 12px' }}>Last 24 Hours</option>
            <option value="48h" style={{ backgroundColor: '#22c55e', color: '#fff', padding: '8px 12px' }}>Last 48 Hours</option>
            <option value="7d" style={{ backgroundColor: '#22c55e', color: '#fff', padding: '8px 12px' }}>Last 7 Days</option>
            <option value="1m" style={{ backgroundColor: '#22c55e', color: '#fff', padding: '8px 12px' }}>Last Month</option>
          </select>
          <span style={{ 
            position: 'absolute', 
            right: '10px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            fontSize: '12px',
            color: isDarkMode ? '#fff' : '#000',
            pointerEvents: 'none', // Prevent interference with select
            userSelect: 'none'
          }}>
            ▼
          </span>
        </div> 
      </div>
    </>
  )
}