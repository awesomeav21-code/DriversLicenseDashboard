import React, { useState, useEffect, useRef, useMemo } from 'react'
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
  const resizeTimeoutRef = useRef(null)

  // Handle window resize with debouncing to prevent layout thrashing
  useEffect(() => {
    const handleResize = () => {
      // Clear existing timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      
      // Debounce resize handling to prevent excessive updates
      resizeTimeoutRef.current = setTimeout(() => {
        if (chartRef.current) {
          // Only trigger a minimal update without recalculating options
          chartRef.current.resize()
        }
      }, 150) // 150ms debounce
    }

    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])

  // Removed isChartReady state - no longer needed for dynamic updates
  const [timeRange, setTimeRange] = useState(() => localStorage.getItem('timeRange') || '1h')
  const [isChangingTimeRange, setIsChangingTimeRange] = useState(false)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [allZonesHidden, setAllZonesHidden] = useState(false) // Always start with zones visible

  const [history, setHistory] = useState(() => {
    // Initialize with test data for the current time range and camera
    const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    const saved = localStorage.getItem(testDataKey)
    if (saved) {
      try {
        return JSON.parse(saved, (key, val) => (key === 'time' ? new Date(val) : val))
      } catch (error) {
        console.warn('Failed to parse saved thermal history:', error.message)
        return []
      }
    }
    return []
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
    // Always start with all zones visible to prevent chart disappearing
    const thermalZoneNames = Array.from({ length: 8 }, (_, i) => `Zone_${i + 1}`)
    const initialVisibility = {}
    thermalZoneNames.forEach(name => { initialVisibility[name] = true })
    
    // Load saved zone visibility from localStorage if available, but ensure at least one zone is visible
    const savedVisibility = localStorage.getItem('zonesVisibility')
    if (savedVisibility) {
      try {
        const parsed = JSON.parse(savedVisibility)
        // Check if all zones would be hidden
        const allHidden = thermalZoneNames.every(name => parsed[name] === false)
        
        if (allHidden) {
          // If all zones would be hidden, show all zones instead
          console.warn('All zones were hidden in saved state, showing all zones to prevent empty chart')
          return initialVisibility
        }
        
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
    
    // eslint-disable-next-line
  }, [selectedCamera])

  // Generate test data when camera or time range changes
  useEffect(() => {
    console.log(`🔄 useEffect triggered - timeRange: ${timeRange}, selectedCamera: ${selectedCamera}`)
    console.log(`🔄 Current dataToUse length: ${dataToUse.length}`)
    
    const generateTestData = () => {
      const now = new Date()
      let interval, entries, chartStartTime
      
      if (timeRange === '48h') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
        interval = (48 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '24h') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        interval = (24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '12h') {
        // For 12 hours: Generate data points every 2 minutes for full coverage
        entries = 12 * 30 // 30 points per hour × 12 hours = 360 total entries
        chartStartTime = new Date(now.getTime() - (12 * 60 * 60 * 1000)) // Exactly 12 hours ago
        interval = (12 * 60 * 60 * 1000) / entries // 12 hours divided by entries = 2 minutes per point
      } else if (timeRange === '6h') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
        interval = (6 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '1h') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (60 * 60 * 1000))
        interval = (60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '7d') {
        // For 7 days: 14 points per 12 hours = 28 points per day × 7 days = 196 total entries
        entries = 7 * 28 // 28 points per day for 7 days
        chartStartTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)) // Exactly 7 days ago
        interval = (12 * 60 * 60 * 1000) / 14 // 12 hours divided by 14 points = ~51.4 minutes per point
      } else if (timeRange === '2d') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000))
        interval = (2 * 24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '4d') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000))
        interval = (4 * 24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '1m') {
        // For 1 month: 1 point per day × 30 days = 30 total entries
        entries = 30 // 1 point per day for 30 days
        chartStartTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)) // Exactly 30 days ago
        interval = (24 * 60 * 60 * 1000) // 24 hours per point (1 day)
      } else {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        interval = (24 * 60 * 60 * 1000) / (entries - 1)
      }
      
      // Generate test data for the current camera
      const newTestData = []
      for (let i = 0; i < entries; i++) {
        const time = new Date(chartStartTime.getTime() + (i * interval))
        const readings = {}
        
        Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
          const isLeftCamera = selectedCamera === 'planck_1'
          const cameraOffset = isLeftCamera ? 2 : 0
          
          const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset
          
          const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
          const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
          const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
          const randomNoise = (Math.random() - 0.5) * 1.4
          const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
          
          const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
          const minTemp = zoneBaseTemp - 2.5
          const maxTemp = zoneBaseTemp + 2.5
          const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
          
          readings[z.name] = clampedTemp
        })
        
        newTestData.push({ time, readings })
      }
      
      // Store and use the generated data
      try {
        const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
        localStorage.setItem(testDataKey, JSON.stringify(newTestData))
        setDataToUse(newTestData)
        console.log(`✅ Generated and stored ${newTestData.length} test data points for ${timeRange} on ${selectedCamera}`)
        console.log(`🔍 Sample data:`, newTestData[0])
        console.log(`🔍 dataToUse state updated, length: ${newTestData.length}`)
        
        // Verify the data spans the full time range
        if (timeRange === '7d') {
          const firstTime = new Date(newTestData[0].time)
          const lastTime = new Date(newTestData[newTestData.length - 1].time)
          const totalSpanMs = lastTime.getTime() - firstTime.getTime()
          const expectedSpanMs = 7 * 24 * 60 * 60 * 1000
          console.log(`🔍 7-day data verification:`)
          console.log(`   First data point: ${firstTime.toLocaleDateString()}`)
          console.log(`   Last data point: ${lastTime.toLocaleDateString()}`)
          console.log(`   Total span: ${totalSpanMs / (24 * 60 * 60 * 1000)} days`)
          console.log(`   Expected span: ${expectedSpanMs / (24 * 60 * 60 * 1000)} days`)
          console.log(`   Data covers full range: ${Math.abs(totalSpanMs - expectedSpanMs) < 60000 ? 'YES' : 'NO'}`)
        }
      } catch (error) {
        console.error(`Failed to store test data:`, error.message)
      }
    }
    
    generateTestData()
  }, [timeRange, selectedCamera])

  // Helper function to generate test data for a specific camera
  const generateTestDataForCamera = (camera, timeRange) => {
    const testData = []
    const now = new Date()
    
    let interval, entries, dataStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000)) // Default to 24 hours ago
    
    if (timeRange === '30m') {
      entries = 5000
      const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000))
      dataStartTime = thirtyMinutesAgo
      interval = (30 * 60 * 1000) / (entries - 1)
    } else if (['1h', '3h', '6h', '12h', '24h', '48h'].includes(timeRange)) {
      entries = 5000
      const hours = timeRange === '1h' ? 1 : timeRange === '3h' ? 3 : timeRange === '6h' ? 6 : timeRange === '12h' ? 12 : timeRange === '24h' ? 24 : 48
      const timeRangeMs = hours * 60 * 60 * 1000
      interval = timeRangeMs / (entries - 1)
      dataStartTime = new Date(now.getTime() - (hours * 60 * 60 * 1000))
    } else if (['2d', '4d', '7d', '2w', '1m', '1y'].includes(timeRange)) {
      entries = 5000
      if (timeRange === '2d') {
        dataStartTime = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '4d') {
        dataStartTime = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '7d') {
        dataStartTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '2w') {
        dataStartTime = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '1m') {
        dataStartTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '1y') {
        dataStartTime = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
      }
      interval = (now.getTime() - dataStartTime.getTime()) / (entries - 1)
    } else {
      const config = testDataConfig[timeRange]
      if (config) {
        interval = config.interval * 1000
        entries = config.entries
        dataStartTime = new Date(now.getTime() - ((entries - 1) * interval))
      }
    }
    
    for (let i = 0; i < entries; i++) {
      const time = new Date(dataStartTime.getTime() + (i * interval))
      const readings = {}
      
      Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
        const isLeftCamera = camera === 'planck_1'
        const cameraOffset = isLeftCamera ? 2 : 0
        
        const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset
        
        const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
        const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
        const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
        const randomNoise = (Math.random() - 0.5) * 1.4
        const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
        
        const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
        
        const minTemp = zoneBaseTemp - 2.5
        const maxTemp = zoneBaseTemp + 2.5
        const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
        
        readings[z.name] = clampedTemp
      })
      
      testData.push({ time, readings })
    }
    
    try {
      const testDataKey = `thermalHistory${timeRange}_${camera}`
      localStorage.setItem(testDataKey, JSON.stringify(testData))
    } catch (error) {
      console.warn(`Failed to store test data for ${camera}:`, error.message)
    }
  }

  // Pre-generate comprehensive test data for both cameras to ensure data always exists
  useEffect(() => {
    const cameras = ['planck_1', 'planck_2']
    const currentTimeRange = timeRange
    
    // Generate comprehensive test data for ALL cameras and time ranges
    cameras.forEach(camera => {
      const testDataKey = `thermalHistory${currentTimeRange}_${camera}`
      const existingData = localStorage.getItem(testDataKey)
      
      if (!existingData) {
        console.log(`🔄 Generating comprehensive data for ${currentTimeRange} on ${camera}...`)
        
        // Generate comprehensive test data that goes all the way through to earliest data
        const testData = []
        const now = new Date()
        
        let interval, entries, startTime
        
        if (currentTimeRange === '30m') {
          entries = 5000
          startTime = new Date(now.getTime() - (30 * 60 * 1000))
          interval = (30 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '1h') {
          entries = 5000
          startTime = new Date(now.getTime() - (60 * 60 * 1000))
          interval = (60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '3h') {
          entries = 5000
          startTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
          interval = (3 * 60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '6h') {
          entries = 5000
          startTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
          interval = (6 * 60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '12h') {
          entries = 5000
          startTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
          interval = (12 * 60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '24h') {
          entries = 5000
          startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
          interval = (24 * 60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '48h') {
          entries = 5000
          startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
          interval = (48 * 60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '2d') {
          entries = 5000
          startTime = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000))
          interval = (2 * 24 * 60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '4d') {
          entries = 5000
          startTime = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000))
          interval = (4 * 24 * 60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '7d') {
          entries = 5000
          startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
          interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '2w') {
          entries = 5000
          startTime = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
          interval = (14 * 24 * 60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '1m') {
          entries = 5000
          startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
          interval = (30 * 24 * 60 * 60 * 1000) / (entries - 1)
        } else if (currentTimeRange === '1y') {
          entries = 5000
          startTime = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
          interval = (365 * 24 * 60 * 60 * 1000) / (entries - 1)
        } else {
          entries = 5000
          startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
          interval = (24 * 60 * 60 * 1000) / (entries - 1)
        }
        
        // Generate comprehensive data that goes all the way through to earliest data
        for (let i = 0; i < entries; i++) {
          const time = new Date(startTime.getTime() + (i * interval))
          const readings = {}
          
          Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
            const isLeftCamera = camera === 'planck_1'
            const cameraOffset = isLeftCamera ? 2 : 0
            
            const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset
            
            // Enhanced wave patterns for more realistic data
            const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
            const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
            const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
            const randomNoise = (Math.random() - 0.5) * 1.4
            const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
            
            // Add weekly and monthly patterns for longer time ranges
            let weeklyPattern = 0
            let monthlyPattern = 0
            
            if (currentTimeRange === '1m' || currentTimeRange === '1y') {
              weeklyPattern = Math.sin((time.getDay() / 7) * Math.PI * 2) * 0.6
              monthlyPattern = Math.sin((time.getDate() / 31) * Math.PI * 2) * 0.4
            }
            
            const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern + weeklyPattern + monthlyPattern
            const minTemp = zoneBaseTemp - 2.5
            const maxTemp = zoneBaseTemp + 2.5
            const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
            
            readings[z.name] = clampedTemp
          })
          
          testData.push({ time, readings })
        }
        
        try {
          localStorage.setItem(testDataKey, JSON.stringify(testData))
          console.log(`✅ Generated comprehensive ${testData.length} data points for ${currentTimeRange} on ${camera}`)
          console.log(`   Data spans from ${startTime.toLocaleDateString()} to ${now.toLocaleDateString()}`)
          console.log(`   Total duration: ${(now.getTime() - startTime.getTime()) / (24 * 60 * 60 * 1000)} days`)
        } catch (error) {
          console.error(`❌ Failed to generate ${currentTimeRange} data for ${camera}:`, error.message)
        }
      }
    })
  }, [timeRange, selectedCamera])

  // Chart will only update when manually triggered (timeRange/camera changes, zone visibility changes)

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

  // Ensure chart data is immediately available when timeRange changes
  useEffect(() => {
      // Force immediate data generation for the new time range
  const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
  const existingData = localStorage.getItem(testDataKey)
  
  if (!existingData || existingData.length !== 5000) {
    // Generate data immediately for this time range
    const testData = []
    const now = new Date()
    
    let interval, entries, startTime
      
      if (timeRange === '30m') {
        entries = 5000
        const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000))
        startTime = thirtyMinutesAgo
        interval = (30 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '1h') {
        entries = 5000
        startTime = new Date(now.getTime() - (60 * 60 * 1000))
        interval = (60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '3h') {
        entries = 5000
        startTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
        interval = (3 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '6h') {
        entries = 5000
        startTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
        interval = (6 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '12h') {
        entries = 5000
        startTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
        interval = (12 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '24h') {
        entries = 5000
        startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        interval = (24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '48h') {
        entries = 5000
        startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
        interval = (48 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '2d') {
        entries = 5000
        startTime = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000))
        interval = (2 * 24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '4d') {
        entries = 5000
        startTime = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000))
        interval = (4 * 24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '7d') {
        // For 7 days: 14 points per 12 hours = 28 points per day × 7 days = 196 total entries
        entries = 7 * 28 // 28 points per day for 7 days
        startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
        interval = (12 * 60 * 60 * 1000) / 14 // 12 hours divided by 14 points = ~51.4 minutes per point
      } else if (timeRange === '2w') {
        entries = 5000
        startTime = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
        interval = (14 * 24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '1m') {
        // For 1 month: 1 point per day × 30 days = 30 total entries
        entries = 30 // 1 point per day for 30 days
        startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
        interval = (24 * 60 * 60 * 1000) // 24 hours per point (1 day)
      } else if (timeRange === '1y') {
        entries = 5000
        startTime = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
        interval = (365 * 24 * 60 * 60 * 1000) / (entries - 1)
      } else {
        entries = 5000
        startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        interval = (24 * 60 * 60 * 1000) / (entries - 1)
      }
      
      for (let i = 0; i < entries; i++) {
        const time = new Date(startTime.getTime() + (i * interval))
        const readings = {}
        
        Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
          const isLeftCamera = selectedCamera === 'planck_1'
          const cameraOffset = isLeftCamera ? 2 : 0
          
          const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset
          
          const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
          const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
          const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
          const randomNoise = (Math.random() - 0.5) * 1.4
          const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
          
          const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
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
        console.error(`Failed to generate ${timeRange} data:`, error.message)
      }
    }
  }, [timeRange, selectedCamera])

  // Force regenerate test data for specific time ranges to ensure full chart coverage
  const regenerateTestData = () => {
    const now = new Date()
    const cameras = ['planck_1', 'planck_2']
    const criticalRanges = ['24h', '48h', '7d', '1m'] // Focus on the ranges you mentioned
    
    console.log('🔄 Starting test data regeneration for critical ranges...')
    
    cameras.forEach(camera => {
      criticalRanges.forEach(range => {
        const testDataKey = `thermalHistory${range}_${camera}`
        console.log(`🔄 Force regenerating ${range} data for ${camera}...`)
        
        const testData = []
        let entries = 5000
        let startTime, interval
        
        if (range === '24h') {
          startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
          interval = (24 * 60 * 60 * 1000) / (entries - 1)
        } else if (range === '48h') {
          startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
          interval = (48 * 60 * 60 * 1000) / (entries - 1)
        } else if (range === '7d') {
          startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
          interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1)
        } else if (range === '1m') {
          startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
          interval = (30 * 24 * 60 * 60 * 1000) / (entries - 1)
        }
        
        console.log(`   ${camera} ${range}: startTime=${startTime.toLocaleDateString()}, endTime=${now.toLocaleDateString()}, interval=${interval}ms`)
        
        // Generate data that spans the full time range
        for (let i = 0; i < entries; i++) {
          const time = new Date(startTime.getTime() + (i * interval))
          const readings = {}
          
          Array.from({ length: 8 }, (_, zoneIndex) => `Zone_${zoneIndex + 1}`).forEach((zoneName, zoneIndex) => {
            const isLeftCamera = camera === 'planck_1'
            
            // Create distinct data patterns for each camera
            let zoneBaseTemp, primaryWave, secondaryWave, tertiaryWave
            
            if (isLeftCamera) {
              // Left camera (planck_1) - Higher base temperatures, different wave patterns
              zoneBaseTemp = 82 + (zoneIndex * 8) // Slightly higher base temps
              primaryWave = Math.sin((i / 30) * Math.PI + zoneIndex) * 2.0 // Different frequency
              secondaryWave = Math.cos((i / 20) * Math.PI + zoneIndex * 1.5) * 1.5 // Different pattern
              tertiaryWave = Math.sin((i / 45) * Math.PI + zoneIndex * 2.5) * 1.2 // Different frequency
            } else {
              // Right camera (planck_2) - Lower base temperatures, different wave patterns
              zoneBaseTemp = 78 + (zoneIndex * 8) // Slightly lower base temps
              primaryWave = Math.sin((i / 40) * Math.PI + zoneIndex * 1.2) * 1.6 // Different frequency
              secondaryWave = Math.cos((i / 30) * Math.PI + zoneIndex * 2.8) * 1.0 // Different pattern
              tertiaryWave = Math.sin((i / 55) * Math.PI + zoneIndex * 1.8) * 0.8 // Different frequency
            }
            
            const randomNoise = (Math.random() - 0.5) * 1.4
            const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
            
            // Add weekly and monthly patterns for longer ranges
            let weeklyPattern = 0
            let monthlyPattern = 0
            
            if (range === '7d' || range === '1m') {
              weeklyPattern = Math.sin((time.getDay() / 7) * Math.PI * 2) * 0.6
              monthlyPattern = Math.sin((time.getDate() / 31) * Math.PI * 2) * 0.4
            }
            
            const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern + weeklyPattern + monthlyPattern
            const minTemp = zoneBaseTemp - 2.5
            const maxTemp = zoneBaseTemp + 2.5
            const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
            
            readings[zoneName] = clampedTemp
          })
          
          testData.push({ time, readings })
        }
        
        try {
          localStorage.setItem(testDataKey, JSON.stringify(testData))
          console.log(`✅ Generated ${testData.length} data points for ${range} on ${camera}`)
          console.log(`   Data spans from ${startTime.toLocaleDateString()} to ${now.toLocaleDateString()}`)
          console.log(`   Total duration: ${(now.getTime() - startTime.getTime()) / (24 * 60 * 60 * 1000)} days`)
          
          // Verify the data was stored correctly
          const storedData = localStorage.getItem(testDataKey)
          if (storedData) {
            const parsedData = JSON.parse(storedData)
            console.log(`   ✅ Verification: ${parsedData.length} points stored for ${camera} ${range}`)
          }
        } catch (error) {
          console.error(`❌ Failed to generate ${range} data for ${camera}:`, error.message)
        }
      })
    })
    
    console.log('🔄 Test data regeneration complete!')
  }

  // Pre-generate comprehensive test data for all time ranges on component mount to prevent any loading states
  useEffect(() => {
    // Force regenerate critical time ranges first
    regenerateTestData()
    
    // Priority ranges that need immediate availability
    const priorityRanges = ['48h', '24h', '6h', '1h']
    const allRanges = ['30m', '1h', '3h', '6h', '12h', '24h', '48h', '2d', '4d', '7d', '2w', '1m', '1y']
    const cameras = ['planck_1', 'planck_2'] // Generate for both cameras
    
    // First, ensure priority ranges are generated immediately
    cameras.forEach(camera => {
      priorityRanges.forEach(range => {
        const testDataKey = `thermalHistory${range}_${camera}`
        const existingData = localStorage.getItem(testDataKey)
        if (!existingData) {
          console.log(`🚨 Priority: Generating ${range} data for ${camera} immediately...`)
          // Generate data synchronously for priority ranges
          generateTestDataForCamera(camera, range)
        }
      })
    })
    
    // Then generate comprehensive data for ALL cameras and ALL time ranges
    cameras.forEach(camera => {
      allRanges.forEach(range => {
        const testDataKey = `thermalHistory${range}_${camera}`
        const existingData = localStorage.getItem(testDataKey)
        if (!existingData) {
          console.log(`🔄 Pre-generating comprehensive data for ${range} on ${camera}...`)
          
          // Generate comprehensive test data that goes all the way through to earliest data
          const testData = []
          const now = new Date()
          
          let interval, entries, startTime
          
          if (range === '30m') {
            entries = 5000
            const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000))
            startTime = thirtyMinutesAgo
            interval = (30 * 60 * 1000) / (entries - 1)
          } else if (range === '1h') {
            entries = 5000
            startTime = new Date(now.getTime() - (60 * 60 * 1000))
            interval = (60 * 60 * 1000) / (entries - 1)
          } else if (range === '3h') {
            entries = 5000
            startTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
            interval = (3 * 60 * 60 * 1000) / (entries - 1)
          } else if (range === '6h') {
            entries = 5000
            startTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
            interval = (6 * 60 * 60 * 1000) / (entries - 1)
          } else if (range === '12h') {
            entries = 5000
            startTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
            interval = (12 * 60 * 60 * 1000) / (entries - 1)
          } else if (range === '24h') {
            entries = 5000
            startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
            interval = (24 * 60 * 60 * 1000) / (entries - 1)
          } else if (range === '48h') {
            entries = 5000
            startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
            interval = (48 * 60 * 60 * 1000) / (entries - 1)
          } else if (range === '2d') {
            entries = 5000
            startTime = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000))
            interval = (2 * 24 * 60 * 60 * 1000) / (entries - 1)
          } else if (range === '4d') {
            entries = 5000
            startTime = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000))
            interval = (4 * 24 * 60 * 60 * 1000) / (entries - 1)
          } else if (range === '7d') {
            entries = 5000
            startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
            interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1)
          } else if (range === '2w') {
            entries = 5000
            startTime = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
            interval = (14 * 24 * 60 * 60 * 1000) / (entries - 1)
          } else if (range === '1m') {
            entries = 5000
            startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
            interval = (30 * 24 * 60 * 60 * 1000) / (entries - 1)
          } else if (range === '1y') {
            entries = 5000
            startTime = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
            interval = (365 * 24 * 60 * 60 * 1000) / (entries - 1)
          }
          
          // Generate comprehensive data that goes all the way through to earliest data
          for (let i = 0; i < entries; i++) {
            const time = new Date(startTime.getTime() + (i * interval))
            const readings = {}
            
            Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
              const isLeftCamera = camera === 'planck_1'
              const cameraOffset = isLeftCamera ? 2 : 0
              
              const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset
              
              // Enhanced wave patterns for more realistic data
              const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
              const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
              const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
              const randomNoise = (Math.random() - 0.5) * 1.4
              const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
              
              // Add weekly and monthly patterns for longer time ranges
              let weeklyPattern = 0
              let monthlyPattern = 0
              
              if (range === '1m' || range === '1y') {
                weeklyPattern = Math.sin((time.getDay() / 7) * Math.PI * 2) * 0.6
                monthlyPattern = Math.sin((time.getDate() / 31) * Math.PI * 2) * 0.4
              }
              
              const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern + weeklyPattern + monthlyPattern
              const minTemp = zoneBaseTemp - 2.5
              const maxTemp = zoneBaseTemp + 2.5
              const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
              
              readings[z.name] = clampedTemp
            })
            
            testData.push({ time, readings })
          }
          
          try {
            localStorage.setItem(testDataKey, JSON.stringify(testData))
            console.log(`✅ Pre-generated comprehensive ${testData.length} data points for ${range} on ${camera}`)
            console.log(`   Data spans from ${startTime.toLocaleDateString()} to ${now.toLocaleDateString()}`)
            console.log(`   Total duration: ${(now.getTime() - startTime.getTime()) / (24 * 60 * 60 * 1000)} days`)
          } catch (error) {
            console.error(`Failed to pre-generate ${range} data for ${camera}:`, error.message)
          }
        }
      })
    })
  }, []) // Empty dependency array - only run once on mount

  // Force all zones to be visible for all time ranges (test data)
  // REMOVED - This was causing zones to reset when switching cameras

  useEffect(() => {
    localStorage.setItem('timeRange', timeRange)
    
    // Update history state when time range changes
    const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    const saved = localStorage.getItem(testDataKey)
    if (saved) {
      try {
        const newHistory = JSON.parse(saved, (key, val) => (key === 'time' ? new Date(val) : val))
        setHistory(newHistory)
      } catch (error) {
        console.warn('Failed to parse thermal history for new time range:', error.message)
        setHistory([])
      }
    } else {
      setHistory([])
    }
  }, [timeRange, selectedCamera])

  useEffect(() => {
    localStorage.setItem('allZonesHidden', JSON.stringify(allZonesHidden))
  }, [allZonesHidden])

  const [allZoneNames, setAllZoneNames] = useState(() => {
    const saved = localStorage.getItem('allZoneNames')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    // For test data, we always have 8 zones
    const thermalZoneNames = Array.from({ length: 8 }, (_, i) => `Zone_${i + 1}`)
    
    if (allZoneNames.length !== thermalZoneNames.length || 
        !thermalZoneNames.every(name => allZoneNames.includes(name))) {
      setAllZoneNames(thermalZoneNames)
      localStorage.setItem('allZoneNames', JSON.stringify(thermalZoneNames))
    }
  }, [selectedCamera, allZoneNames])



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

  // Test data configuration - all ranges use 5000 entries for consistency
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
    '7d': { entries: 7 * 28, interval: (12 * 60 * 60 * 1000) / 14, peakChance: 0.20 }, // 28 points per day × 7 days = 196 total entries
    '2w': { entries: 5000, interval: 241920, peakChance: 0.25 },
    '1m': { entries: 30, interval: (24 * 60 * 60 * 1000), peakChance: 0.30 }, // 1 point per day × 30 days = 30 total entries
    '1y': { entries: 5000, interval: 6307200, peakChance: 0.35 }
  }

  // Generate test data for all time ranges
  useEffect(() => {
    const config = testDataConfig[timeRange]
    if (!config) return

    // Force regenerate data for 30m to get 5000 entries instead of 60
    const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    const existingData = localStorage.getItem(testDataKey)
    
    // For 30m, 12h, always regenerate to ensure we get 5000 entries
    // 1h, 6h, 24h, and 48h preserved to prevent zoom resets and maintain data like page refresh
    if (existingData && !['30m', '12h'].includes(timeRange)) {
      console.log(`📊 Using existing data for ${timeRange}: ${JSON.parse(existingData).length} entries`)
      return
    }
    
    // Force regenerate for problematic ranges to ensure correct data
    // 1h, 6h, 24h, and 48h excluded from force regeneration to maintain zoom state and data consistency
    if (['30m', '12h'].includes(timeRange)) {
      console.log(`🔄 Force regenerating data for ${timeRange} to ensure 5000 points`)
      // Clear any existing data to ensure clean regeneration
      localStorage.removeItem(testDataKey)
    }
    
    const testData = []
    const now = new Date()
    
    // For longer time ranges, use appropriate intervals
    let interval, entries, startTime
    if (timeRange === '30m') {
      // 30 minutes: 5000 data points
      entries = 5000
      // For 30m, ensure we generate exactly 30 minutes of data
      const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000))
      startTime = thirtyMinutesAgo
      // Calculate interval to fit exactly 30 minutes with 5000 points
      interval = (30 * 60 * 1000) / (entries - 1) // This gives us evenly spaced points across exactly 30 minutes
    } else if (['1m', '2w', '1y'].includes(timeRange)) {
      // Use consistent filtering for different time ranges
      if (timeRange === '1m') {
        // For 1 month: 1 point per day × 30 days = 30 total entries
        entries = 30 // 1 point per day for 30 days
        interval = (24 * 60 * 60 * 1000) // 24 hours per point (1 day)
      } else if (timeRange === '2w') {
        entries = 5000
        interval = (14 * 24 * 60 * 60 * 1000) / (entries - 1) // 14 days
      } else if (timeRange === '1y') {
        entries = 5000
        interval = (365 * 24 * 60 * 60 * 1000) / (entries - 1) // 365 days
      }
    } else if (timeRange === '7d') {
      // For 7 days: 14 points per 12 hours = 28 points per day × 7 days = 196 total entries
      entries = 7 * 28 // 28 points per day for 7 days
      interval = (12 * 60 * 60 * 1000) / 14 // 12 hours divided by 14 points = ~51.4 minutes per point
    } else if (timeRange === '4d') {
      // For ALL time ranges, use 5000 entries for consistency
      entries = 5000
      interval = (4 * 24 * 60 * 60 * 1000) / (entries - 1) // 4 days
    } else if (timeRange === '2d') {
      // For ALL time ranges, use 5000 entries for consistency
      entries = 5000
      interval = (2 * 24 * 60 * 60 * 1000) / (entries - 1) // 2 days
    } else if (['1h', '3h', '6h', '12h', '24h', '48h'].includes(timeRange)) {
      // For ALL time ranges, use 5000 entries like 30m for consistency
      entries = 5000
      // Calculate interval to fit exactly the time range with 5000 points
      const hours = timeRange === '1h' ? 1 : timeRange === '3h' ? 3 : timeRange === '6h' ? 6 : timeRange === '12h' ? 12 : timeRange === '24h' ? 24 : 48
      const timeRangeMs = hours * 60 * 60 * 1000
      interval = timeRangeMs / (entries - 1) // This gives us evenly spaced points across the full time range
    } else {
      // Fallback to config values (only for ranges not explicitly handled above)
      if (timeRange !== '30m') { // Skip 30m as it's already handled
        interval = config.interval * 1000 // Convert to milliseconds
        entries = config.entries
      }
    }
    
    console.log(`🔍 Data generation for ${timeRange}: interval=${interval}ms, entries=${entries}`)
    if (timeRange === '30m') {
      console.log(`🔍 30m specific: startTime=${startTime}, endTime=${now}, totalDuration=${now.getTime() - startTime.getTime()}ms`)
    } else if (['1h', '3h', '6h', '12h', '24h', '48h'].includes(timeRange)) {
      const hours = timeRange === '1h' ? 1 : timeRange === '3h' ? 3 : timeRange === '6h' ? 6 : timeRange === '12h' ? 12 : timeRange === '24h' ? 24 : 48
      const expectedDuration = hours * 60 * 60 * 1000
      const actualDuration = (entries - 1) * interval
      console.log(`🔍 ${timeRange} specific: startTime=${startTime}, expectedDuration=${expectedDuration}ms, actualDuration=${actualDuration}ms, interval=${interval}ms`)
      if (startTime) {
        console.log(`🔍 ${timeRange} data will span from ${startTime.toLocaleString()} to ${now.toLocaleString()}`)
      }
    }
    
    // Generate data that goes up to and includes the current time
    // For ALL time ranges, always generate exactly 5000 entries spanning the full time range
    if (timeRange === '30m') {
      // For 30m, use the pre-calculated start time
      startTime = new Date(now.getTime() - (30 * 60 * 1000))
    } else if (['1h', '3h', '6h', '12h', '24h', '48h'].includes(timeRange)) {
      // For these ranges, start from exactly the time range ago
      const hours = timeRange === '1h' ? 1 : timeRange === '3h' ? 3 : timeRange === '6h' ? 6 : timeRange === '12h' ? 12 : timeRange === '24h' ? 24 : 48
      startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000))
    } else {
      // For other ranges (2d, 4d, 7d, etc.), also use the time range approach
      if (timeRange === '2d') {
        startTime = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '4d') {
        startTime = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '7d') {
        startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '2w') {
        startTime = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '1m') {
        startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '1y') {
        startTime = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
      } else {
        // Fallback to original logic
        startTime = new Date(now.getTime() - ((entries - 1) * interval))
      }
    }
    
    console.log(`🔍 Generating ${entries} data points from ${startTime.toLocaleString()} with interval ${interval}ms`)
    
    for (let i = 0; i < entries; i++) {
      let time
      if (i === entries - 1) {
        // Ensure the last data point is exactly at current time for 48h and other ranges
        time = new Date(now.getTime())
      } else {
        time = new Date(startTime.getTime() + (i * interval))
      }
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
      console.log(`✅ Successfully stored ${testData.length} data points for ${timeRange} on ${selectedCamera}`)
      
      // CRITICAL: Update the dataToUse state so the chart can render
      setDataToUse(testData)
      console.log(`✅ Updated dataToUse state with ${testData.length} data points for ${timeRange}`)
      if (testData.length > 0) {
        const firstTime = new Date(testData[0].time)
        const lastTime = new Date(testData[testData.length - 1].time)
        const actualSpan = lastTime.getTime() - firstTime.getTime()
        const expectedSpan = timeRange === '30m' ? 30 * 60 * 1000 : 
                           timeRange === '1h' ? 60 * 60 * 1000 :
                           timeRange === '3h' ? 3 * 60 * 60 * 1000 :
                           timeRange === '6h' ? 6 * 60 * 60 * 1000 :
                           timeRange === '12h' ? 12 * 60 * 60 * 1000 :
                           timeRange === '24h' ? 24 * 60 * 60 * 1000 :
                           timeRange === '48h' ? 48 * 60 * 60 * 1000 : 0
        
        console.log(`✅ Data spans from ${firstTime.toLocaleString()} to ${lastTime.toLocaleString()}`)
        console.log(`✅ Expected span: ${expectedSpan/1000/60} minutes, Actual span: ${actualSpan/1000/60} minutes`)
        console.log(`✅ First data point: ${firstTime.toLocaleString()}, Last data point: ${lastTime.toLocaleString()}`)
        
        if (Math.abs(actualSpan - expectedSpan) > 60000) { // More than 1 minute difference
          console.warn(`⚠️ Time span mismatch for ${timeRange}! Expected: ${expectedSpan/1000/60}min, Got: ${actualSpan/1000/60}min`)
        }
      }
    } catch (error) {
      console.warn(`Failed to store ${timeRange} test data in localStorage:`, error.message)
    }
  }, [timeRange, selectedCamera, allZones])

  useEffect(() => {
    // Use test data for initial range calculation
    const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    const testData = localStorage.getItem(testDataKey)
    
    if (testData && !initialRange) {
      try {
        const parsedData = JSON.parse(testData, (key, val) => (key === 'time' ? new Date(val) : val))
        if (parsedData.length > 0) {
          const sortedAll = parsedData
            .slice()
            .sort((a, b) => new Date(a.time) - new Date(b.time))
          const first = new Date(sortedAll[0].time).getTime()
          const last = new Date(sortedAll[sortedAll.length - 1].time).getTime()
          setInitialRange({ min: first, max: last })
        }
      } catch (error) {
        console.warn('Failed to parse test data for initial range:', error.message)
      }
    }
  }, [timeRange, selectedCamera, initialRange])

  // Chart update disabled to prevent zoom interference
  // useEffect(() => {
  //   if (chartRef.current) {
  //     // Only update if chart exists and preserve zoom state
  //     const currentZoom = chartRef.current.getZoomLevel ? chartRef.current.getZoomLevel() : null
  //     const currentPan = chartRef.current.getPan ? chartRef.current.getPan() : null
  //     
  //     // Use 'none' mode to prevent animations that could interfere with zoom
  //     chartRef.current.update('none')
  //     
  //     // Restore zoom state after update
  //     if (currentZoom && chartRef.current.zoom) {
  //       chartRef.current.zoom(currentZoom)
  //     }
  //     if (currentPan && chartRef.current.pan) {
  //       chartRef.current.pan(currentPan)
  //     }
  //   }
  // }, [tempUnit, isDarkMode])

  // Removed history-based chart update - no more dynamic updates

  // Chart update disabled to prevent zoom interference
  // useEffect(() => {
  //   if (chartRef.current) {
  //     // Preserve zoom state before update
  //     const currentZoom = chartRef.current.getZoomLevel ? chartRef.current.getZoomLevel() : null
  //     const currentPan = chartRef.current.getPan ? chartRef.current.getPan() : null
  //     
  //     // Use 'none' mode to prevent animations that could interfere with zoom
  //     chartRef.current.update('none')
  //     
  //     // Restore zoom state after update
  //     if (currentZoom && chartRef.current.zoom) {
  //       chartRef.current.zoom(currentZoom)
  //     }
  //     if (currentPan && chartRef.current.pan) {
  //       chartRef.current.pan(currentPan)
  //     }
  //   }
  // }, [timeRange, selectedCamera])

  // Chart update disabled to prevent zoom interference
  // useEffect(() => {
  //   if (chartRef.current) {
  //     // Preserve zoom state before update
  //     // const currentZoom = chartRef.current.getZoomLevel ? chartRef.current.getZoomLevel() : null
  //     // const currentPan = chartRef.current.getPan ? chartRef.current.getPan() : null
  //     
  //     // Use 'none' mode to prevent animations that could interfere with zoom
  //     // chartRef.current.update('none')
  //     
  //     // Restore zoom state after update
  //     // if (currentZoom && chartRef.current.zoom) {
  //     //   chartRef.current.zoom(currentZoom)
  //     // }
  //     // if (currentPan && chartRef.current.pan) {
  //     //   chartRef.current.pan(currentPan)
  //     // }
  //   }
  // }, [zonesVisibility, visibleZones])

  // Dynamic data update every 10 seconds - DISABLED to prevent chart changes during zoom
  // This was causing the chart to update every 10 seconds, which would reset the user's zoom level
  // and make it impossible to examine data in detail. The chart should remain stable when zoomed.
  // useEffect(() => {
  //   if (!['3h', '6h', '12h', '24h', '48h'].includes(timeRange)) return
  //   
  //   const updateInterval = setInterval(() => {
  //     const currentTime = Date.now()
  //     const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
  //     const existingData = localStorage.getItem(testDataKey)
  //     
  //     if (existingData) {
  //       try {
  //         const data = JSON.parse(existingData, (key, val) => (key === 'time' ? new Date(val) : val))
  //         
  //         // Add new data point at current time
  //         const newReadings = {}
  //         Array.from({ length: 8 }, (_, zoneIndex) => `Zone_${zoneIndex + 1}`).forEach((zoneName, zoneIndex) => {
  //           const isLeftCamera = selectedCamera === 'planck_1'
  //           const cameraOffset = isLeftCamera ? 2 : 0
  //           
  //           const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset
  //           const timeFactor = currentTime / 10000 // Use current time for variation
  //           const primaryWave = Math.sin((timeFactor / 35) * Math.PI + zoneIndex) * 1.8
  //           const secondaryWave = Math.cos((timeFactor / 25) * Math.PI + zoneIndex * 2) * 1.2
  //           const tertiaryWave = Math.sin((timeFactor / 50) * Math.PI + zoneIndex * 3) * 1.0
  //           const randomNoise = (Math.random() - 0.5) * 1.4
  //           const dailyPattern = Math.sin((new Date(currentTime).getHours() / 24) * Math.PI * 2) * 0.8
  //           
  //           const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
  //           const minTemp = zoneBaseTemp - 2.5
  //           const maxTemp = zoneBaseTemp + 2.5
  //           const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
  //           
  //           newReadings[zoneName] = clampedTemp
  //         })
  //         
  //         const newDataPoint = { time: new Date(currentTime), readings: newReadings }
  //         data.push(newDataPoint)
  //         
  //         // Keep exactly 5000 data points by removing oldest ones if we exceed the limit
  //         if (data.length > 5000) {
  //             data.splice(0, data.length - 5000) // Remove oldest entries to keep exactly 5000
  //         }
  //         
  //         // Store updated data with exactly 5000 points
  //         localStorage.setItem(testDataKey, JSON.stringify(data))
  //         
  //         // Force chart update with new data
  //         if (chartRef.current) {
  //           // Update the chart's data directly
  //           const updatedDatasets = chartRef.current.data.datasets.map((dataset, idx) => {
  //             const zoneName = dataset.label
  //             const zoneDataPoints = data
  //               .map(entry => {
  //                 const val = entry.readings?.[zoneName]
  //                 if (typeof val === 'number') {
  //                   const yValue = tempUnit === 'F' ? Math.round(val) : Math.round(((val - 32) * 5) / 9)
  //                   return { x: new Date(entry.time), y: yValue + (idx * 20) } // Add offset
  //                 }
  //                 return null
  //               })
  //               .filter(Boolean)
  //             
  //             return {
  //               ...dataset,
  //               data: zoneDataPoints
  //             }
  //           })
  //           
  //           chartRef.current.data.datasets = updatedDatasets
  //           chartRef.current.update('none')
  //         }
  //         
  //         console.log(`🔄 Added new data point at ${new Date(currentTime).toLocaleTimeString()}, total points: ${data.length}`)
  //       } catch (error) {
  //         console.warn('Failed to update dynamic data:', error.message)
  //       }
  //     }
  //   }, 10000) // Update every 10 seconds
  //   
  //   return () => clearInterval(updateInterval)
  // }, [timeRange, selectedCamera, tempUnit])

  // Update chart time range every 10 seconds to show current time - DISABLED to prevent chart changes during zoom
  // This was causing the chart's time scale to shift every 10 seconds, which would move the user's
  // zoomed view and make it impossible to examine data in detail. The chart should remain stable when zoomed.
  // useEffect(() => {
  //   if (!['3h', '6h', '12h', '24h', '48h'].includes(timeRange)) return
  //   
  //   const timeUpdateInterval = setInterval(() => {
  //     if (chartRef.current) {
  //       const currentTime = Date.now()
  //       const timeLimit = timeMap[timeRange]
  //       const newMin = currentTime - timeLimit
  //       const newMax = currentTime
  //       
  //       // Update chart time scale
  //       const xScale = chartRef.current.scales.x
  //       if (xScale) {
  //           xScale.options.min = newMin
  //           xScale.options.max = newMax
  //           
  //           // Also update the extendedMin and extendedMax variables for consistency
  //           extendedMin = newMin
  //           extendedMax = newMax
  //           
  //           chartRef.current.update('none')
  //       }
  //       
  //       console.log(`🕒 Updated chart time range: ${new Date(newMin).toLocaleTimeString()} to ${new Date(newMax).toLocaleTimeString()}`)
  //     }
  //   }, 10000) // Update every 10 seconds
  //   
  //   return () => clearInterval(timeUpdateInterval)
  // }, [timeRange])





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
      // For 24h and 48h, treat camera switch like page refresh - preserve layout and reset zoom
      if (timeRange === '24h' || timeRange === '48h') {
        // Reset zoom first to ensure clean layout
        if (chartRef.current && chartRef.current.resetZoom) {
          chartRef.current.resetZoom()
        }
        
        // Reset initial range to force recalculation for new camera
        setInitialRange(null)
        
        // Simulate a small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 300))
        
        setSelectedCamera(cam)
        
        // Force refresh counter to ensure complete chart re-mount for proper layout
        setRefreshCounter(prev => prev + 1)
        
        // Small delay to ensure camera change is processed and chart remounts properly
        await new Promise(resolve => setTimeout(resolve, 300))
        
        console.log(`✅ Camera switched to ${cam} for ${timeRange} with page refresh behavior`)
      } else {
        // For other time ranges, use existing behavior
        // Simulate a small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 500))
        
        setSelectedCamera(cam)
        
        // Ensure test data exists for the new camera
        const testDataKey = `thermalHistory${timeRange}_${cam}`
        const existingData = localStorage.getItem(testDataKey)
        if (!existingData) {
          console.log(`🔄 No test data found for ${cam} ${timeRange}, generating now...`)
          // Force regenerate test data for this camera and time range
          regenerateTestData()
        }
        
        // Force immediate chart refresh when camera changes
        if (chartRef.current) {
          chartRef.current.update('none') // Force complete update
        }
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
    
    // Chart update disabled to prevent zoom interference
    // if (chartRef.current) {
    //   console.log('Forcing chart update after toggleAllZones')
    //   chartRef.current.update('none')
    // }
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



  const handleResetZoom = () => {
    const chart = chartRef.current
    if (!chart) return
  
    const xScale = chart.scales.x
    if (!xScale) return
  
    let resetMin, resetMax
  
    if (timeRange === '30m' && custom30mTicks.length) {
      resetMin = custom30mTicks[0]
      resetMax = custom30mTicks[custom30mTicks.length - 1]
    } else if (timeRange === '1h') {
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
  const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
  
  // Initialize dataToUse with existing data or generate immediately
  const [dataToUse, setDataToUse] = useState(() => {
    const existingData = localStorage.getItem(testDataKey)
    if (existingData) {
      try {
        const parsed = JSON.parse(existingData, (key, val) => (key === 'time' ? new Date(val) : val))
        console.log(`🔍 Initial load: Found ${parsed.length} existing data points for ${timeRange} on ${selectedCamera}`)
        return parsed
      } catch (error) {
        console.warn('Failed to parse existing test data:', error.message)
      }
    }
    
    // Generate data immediately if none exists
    console.log(`🔍 Initial load: No existing data, generating for ${timeRange} on ${selectedCamera}`)
    const now = new Date()
    let interval, entries, chartStartTime
    
    if (timeRange === '48h') {
      entries = 5000
      chartStartTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
      interval = (48 * 60 * 60 * 1000) / (entries - 1)
    } else if (timeRange === '24h') {
      entries = 5000
      chartStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      interval = (24 * 60 * 60 * 1000) / (entries - 1)
    } else if (timeRange === '12h') {
      // For 12 hours: Generate data points every 2 minutes for full coverage
      entries = 12 * 30 // 30 points per hour × 12 hours = 360 total entries
      chartStartTime = new Date(now.getTime() - (12 * 60 * 60 * 1000)) // Exactly 12 hours ago
      interval = (12 * 60 * 60 * 1000) / entries // 12 hours divided by entries = 2 minutes per point
    } else if (timeRange === '6h') {
      entries = 5000
      chartStartTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
      interval = (6 * 60 * 60 * 1000) / (entries - 1)
    } else if (timeRange === '1h') {
      entries = 5000
      chartStartTime = new Date(now.getTime() - (60 * 60 * 1000))
      interval = (60 * 60 * 1000) / (entries - 1)
    } else if (timeRange === '30m') {
      entries = 5000
      chartStartTime = new Date(now.getTime() - (30 * 60 * 1000))
      interval = (30 * 60 * 1000) / (entries - 1)
    } else if (timeRange === '7d') {
      // For 7 days: 14 points per 12 hours = 28 points per day × 7 days = 196 total entries
      entries = 7 * 28 // 28 points per day for 7 days
      chartStartTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)) // Exactly 7 days ago
      interval = (12 * 60 * 60 * 1000) / 14 // 12 hours divided by 14 points = ~51.4 minutes per point
    } else if (timeRange === '1m') {
      // For 1 month: 1 point per day × 30 days = 30 total entries
      entries = 30 // 1 point per day for 30 days
      chartStartTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)) // Exactly 30 days ago
      interval = (24 * 60 * 60 * 1000) // 24 hours per point (1 day)
    } else {
      entries = 5000
      chartStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      interval = (24 * 60 * 60 * 1000) / (entries - 1)
    }
    
    // Generate test data immediately
    const newTestData = []
    for (let i = 0; i < entries; i++) {
      let time
      if (i === entries - 1) {
        // Ensure the last data point is exactly at current time for 24h and 48h
        time = new Date(now.getTime())
      } else {
        time = new Date(chartStartTime.getTime() + (i * interval))
      }
      const readings = {}
      
      Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
        const isLeftCamera = selectedCamera === 'planck_1'
        const cameraOffset = isLeftCamera ? 2 : 0
        
        const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset
        
        const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
        const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
        const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
        const randomNoise = (Math.random() - 0.5) * 1.4
        const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
        
        const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
        const minTemp = zoneBaseTemp - 2.5
        const maxTemp = zoneBaseTemp + 2.5
        const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
        
        readings[z.name] = clampedTemp
      })
      
      newTestData.push({ time, readings })
    }
    
    // Store the generated data
    try {
      localStorage.setItem(testDataKey, JSON.stringify(newTestData))
      console.log(`✅ Initial generation: Created ${newTestData.length} test data points for ${timeRange} on ${selectedCamera}`)
      
      // Verify the data spans the full time range for 24h and 48h
      if (['24h', '48h'].includes(timeRange) && newTestData.length > 0) {
        const firstTime = new Date(newTestData[0].time)
        const lastTime = new Date(newTestData[newTestData.length - 1].time)
        const actualSpan = lastTime.getTime() - firstTime.getTime()
        const expectedSpan = timeRange === '24h' ? 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000
        
        console.log(`🔍 ${timeRange} Initial data verification:`)
        console.log(`   First point: ${firstTime.toLocaleString()}`)
        console.log(`   Last point: ${lastTime.toLocaleString()}`)
        console.log(`   Expected span: ${expectedSpan/1000/60/60} hours`)
        console.log(`   Actual span: ${actualSpan/1000/60/60} hours`)
        console.log(`   Spans full range: ${Math.abs(actualSpan - expectedSpan) < 60000 ? 'YES' : 'NO'}`)
      }
    } catch (error) {
      console.warn(`Failed to store initial test data:`, error.message)
    }
    
    return newTestData
  })
  
  // Update data when camera or time range changes
  useEffect(() => {
    const newTestDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    const existingData = localStorage.getItem(newTestDataKey)
    
    if (existingData) {
      try {
        const parsed = JSON.parse(existingData, (key, val) => (key === 'time' ? new Date(val) : val))
        console.log(`🔍 useEffect: Found ${parsed.length} existing data points for ${timeRange} on ${selectedCamera}`)
        setDataToUse(parsed)
        return
      } catch (error) {
        console.warn('Failed to parse existing test data in useEffect:', error.message)
      }
    }
    
    // For critical ranges like 48h, ensure data is immediately available
    if (['48h', '24h', '1h'].includes(timeRange)) {
      console.log(`🔄 Critical range ${timeRange} missing data, generating immediately...`)
    }
    
    // Generate new data if none exists
    console.log(`🔍 useEffect: Generating new data for ${timeRange} on ${selectedCamera}`)
    const generateTestData = () => {
      const now = new Date()
      let interval, entries, chartStartTime
      
      if (timeRange === '48h') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
        interval = (48 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '24h') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        interval = (24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '12h') {
        // For 12 hours: Generate data points every 2 minutes for full coverage
        entries = 12 * 30 // 30 points per hour × 12 hours = 360 total entries
        chartStartTime = new Date(now.getTime() - (12 * 60 * 60 * 1000)) // Exactly 12 hours ago
        interval = (12 * 60 * 60 * 1000) / entries // 12 hours divided by entries = 2 minutes per point
      } else if (timeRange === '6h') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
        interval = (6 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '1h') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (60 * 60 * 1000))
        interval = (60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '30m') {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (30 * 60 * 1000))
        interval = (30 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '7d') {
        // For 7 days: 14 points per 12 hours = 28 points per day × 7 days = 196 total entries
        entries = 7 * 28 // 28 points per day for 7 days
        chartStartTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)) // Exactly 7 days ago
        interval = (12 * 60 * 60 * 1000) / 14 // 12 hours divided by 14 points = ~51.4 minutes per point
      } else if (timeRange === '1m') {
        // For 1 month: 1 point per day × 30 days = 30 total entries
        entries = 30 // 1 point per day for 30 days
        chartStartTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)) // Exactly 30 days ago
        interval = (24 * 60 * 60 * 1000) // 24 hours per point (1 day)
      } else {
        entries = 5000
        chartStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        interval = (24 * 60 * 60 * 1000) / (entries - 1)
      }
      
      // Generate test data for the current camera
      const newTestData = []
      for (let i = 0; i < entries; i++) {
        const time = new Date(chartStartTime.getTime() + (i * interval))
        const readings = {}
        
        Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
          const isLeftCamera = selectedCamera === 'planck_1'
          const cameraOffset = isLeftCamera ? 2 : 0
          
          const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset
          
          const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
          const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
          const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
          const randomNoise = (Math.random() - 0.5) * 1.4
          const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
          
          const finalTemp = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
          const minTemp = zoneBaseTemp - 2.5
          const maxTemp = zoneBaseTemp + 2.5
          const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
          
          readings[z.name] = clampedTemp
        })
        
        newTestData.push({ time, readings })
      }
      
      // Store and use the generated data
      try {
        localStorage.setItem(newTestDataKey, JSON.stringify(newTestData))
        setDataToUse(newTestData)
        console.log(`✅ useEffect: Generated and stored ${newTestData.length} test data points for ${timeRange} on ${selectedCamera}`)
      } catch (error) {
        console.error(`Failed to store test data:`, error.message)
      }
    }
    
    generateTestData()
  }, [timeRange, selectedCamera])
  


  // Use test data if available, otherwise use empty array to prevent glitching
  const dataSource = dataToUse.length > 0 ? dataToUse : []
  console.log(`🔍 Chart data source: dataToUse length: ${dataToUse.length}, history length: ${history.length}`)
  console.log(`🔍 Using dataSource with length: ${dataSource.length}`)
  
  // Add stability check for dramatic data changes
  if (dataSource.length > 0) {
    console.log(`🔍 Data range: ${timeRange}, points: ${dataSource.length}, camera: ${selectedCamera}`)
  }
  

  
  const sorted = dataSource.sort((a, b) => new Date(a.time) - new Date(b.time))

  // Create a fixed set of zones for thermal chart display (independent of actual data)
  const thermalZones = Array.from({ length: 8 }, (_, i) => ({
    name: `Zone_${i + 1}`,
    camera: selectedCamera,
    index: i
  }))
  
  const zonesForCamera = thermalZones // Use fixed thermal zones for consistent display
  const filteredNames = zonesForCamera.map(z => z.name)
  


  console.log(`🔍 Creating datasets with sorted data length: ${sorted.length}`)
  console.log(`🔍 First sorted entry:`, sorted[0])
  console.log(`🔍 Sample readings:`, sorted[0]?.readings)
  
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
    
    // Add vertical offset to spread out the zone lines
    const offsetData = zoneDataPoints.map(point => ({
      x: point.x,
      y: point.y + (idx * 3) // Add 3° spacing between each zone line (significantly reduced)
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
  
  // For 24h and 48h time ranges, use consistent Y-axis scaling regardless of camera
  // This prevents layout breaking when switching between cameras
  if ((timeRange === '24h' || timeRange === '48h') && allChartTemps.length > 0) {
    // Use fixed, consistent scaling for 24h/48h to ensure layout stability
    const actualMin = Math.min(...allChartTemps)
    const actualMax = Math.max(...allChartTemps)
    
    // Use consistent buffer regardless of camera to maintain layout
    dataMin = Math.floor(actualMin / 10) * 10 - 10 // Round down to nearest 10, then subtract 10
    dataMax = Math.ceil(actualMax / 10) * 10 + 20   // Round up to nearest 10, then add 20
    
    console.log(`🔧 Fixed Y-axis scaling for ${timeRange} on ${selectedCamera}: ${dataMin}°F to ${dataMax}°F`)
  } else {
    // Calculate y-axis range to ensure min is below lowest data point and max is above highest
    if (allChartTemps.length === 0) {
      dataMin = tempUnit === 'F' ? 75 : Math.round(((75 - 32) * 5) / 9)
      dataMax = tempUnit === 'F' ? 120 : Math.round(((120 - 32) * 5) / 9)
    } else {
      // Use actual min/max with dynamic buffers
      const actualMin = Math.min(...allChartTemps)
      const actualMax = Math.max(...allChartTemps)
      
      // Dynamic buffer: 10° below lowest data point, 15° above highest data point
      dataMin = actualMin - 10 // Always 10° below the lowest data point
      dataMax = actualMax + 15 // Always 15° above the highest data point
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
  let custom30mTicks = []
  let custom24hTicks = []
  let customDayTicks = []
  let custom1hTicks = []
  let custom3hTicks = []
  let custom6hTicks = []
  let custom12hTicks = []
  let custom48hTicks = []
  const dayRanges = { '2d': 2, '4d': 4, '7d': 7, '2w': 14, '1m': 30, '1y': 365 }

 if (timeRange === '30m') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0) // Round down to nearest minute
    const start = new Date(now.getTime() - 30 * 60 * 1000)
    
    // Generate ticks every 5 minutes for 30-minute range (7 ticks total)
    for (let i = 0; i <= 6; i++) {
      const tick = new Date(start.getTime() + i * 5 * 60 * 1000) // Every 5 minutes
      custom30mTicks.push(tick.getTime())
    }
    
    // Ensure we have exactly 7 ticks spanning the full 30 minutes
    console.log('30m ticks generated:', custom30mTicks.length)
    custom30mTicks.forEach((tick, index) => {
      const tickDate = new Date(tick)
      console.log(`Tick ${index}: ${tickDate.toLocaleTimeString()}`)
    })
    
    extendedMin = custom30mTicks[0] // Use first tick (exactly 30 minutes ago)
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
    now.setSeconds(0, 0) // Round down to nearest minute
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
    // Generate ticks every 6 hours for 48h (9 ticks total: 0, 6, 12, 18, 24, 30, 36, 42, 48 hours)
    for (let i = 0; i <= 8; i++) {
      const tick = new Date(start.getTime() + i * 6 * 60 * 60 * 1000)
      custom48hTicks.push(tick.getTime())
    }
    // Ensure the last tick is exactly current time (48 hours from start)
    custom48hTicks[custom48hTicks.length - 1] = currentTime
    console.log('48h ticks:', custom48hTicks.length, 'Spans exactly 48 hours from', new Date(custom48hTicks[0]), 'to', new Date(currentTime))
    extendedMin = custom48hTicks[0] // Use first tick (exactly 48 hours ago)
    extendedMax = currentTime
    startTime = extendedMin
  } else if (dayRanges[timeRange]) {
    const nDays = dayRanges[timeRange]
    const now = new Date(currentTime)
    
    // For 7d and 1m, start from the exact time nDays ago to eliminate white space
    const start = new Date(now.getTime() - nDays * 24 * 60 * 60 * 1000)
    
    // Generate ticks but ensure first tick is at the very start of the time range
    customDayTicks.push(start.getTime()) // First tick at exact start time
    
    // Add intermediate ticks at daily intervals
    for (let i = 1; i <= nDays; i++) {
      const tick = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
      customDayTicks.push(tick.getTime())
    }
    
    // Force the last tick to be current time
    customDayTicks[customDayTicks.length - 1] = currentTime
    
    extendedMin = start.getTime() // Use exact start time (no white space)
    extendedMax = currentTime
    startTime = extendedMin
    
    console.log(`🔧 Fixed ${timeRange} axis: start=${new Date(extendedMin).toLocaleString()}, end=${new Date(extendedMax).toLocaleString()}`)
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
  
    // Apply clamped values to x axis without triggering chart update
    xScale.options.min = newMin
    xScale.options.max = newMax
  
    // No clamping for y axis, allow free vertical pan
    // Don't call chart.update() here to prevent interference with user zoom
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
    
    // Chart update disabled to prevent zoom interference
    // if (chartRef.current) {
    //   chartRef.current.update('none')
    // }
  }
  
  const mergedOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false, // Allow chart to fit container height
    layout: {
      padding: {
        top: 20, // Fixed padding to prevent shifting
        bottom: 30, // Fixed padding for time label
        left: 0, // No left padding inside chart
        right: 20, // Fixed padding
      },
    },
    animation: { duration: 0 },
    transitions: {
      active: {
        animation: { duration: 0 }
      },
      resize: {
        animation: { duration: 0 }
      },
      show: {
        animations: {
          x: { duration: 0 },
          y: { duration: 0 }
        }
      },
      zoom: {
        animation: { duration: 0 }
      },
      pan: {
        animation: { duration: 0 }
      }
    },
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
            // Disable automatic chart updates during zoom to prevent interference
            chart.updateMode = 'none'
            clampZoomPan(chart)
          },
        },
        pan: {
          enabled: true,
          mode: 'xy',
          onPan: ({ chart }) => {
            // Disable automatic chart updates during pan to prevent interference
            chart.updateMode = 'none'
            clampZoomPan(chart)
          },
        },
        limits: {
          x: {
            min:
              timeRange === '30m' || timeRange === '1h' || timeRange === '3h' || timeRange === '6h' || timeRange === '12h' || timeRange === '24h' || timeRange === '48h' || dayRanges[timeRange]
                ? extendedMin
                : extendedMin,
            max:
              timeRange === '30m' || timeRange === '1h' || timeRange === '3h' || timeRange === '6h' || timeRange === '12h' || timeRange === '24h' || timeRange === '48h' || dayRanges[timeRange]
                ? extendedMax
                : extendedMax,
          },
          y: {
            min: dataMin, // Use the calculated min (already includes 5°F buffer)
            max: dataMax, // Use the calculated max (already includes 5°F buffer)
          },
        },
      },
      hoverDotsPlugin: { isChartReady: true }, // Enable hover dots plugin
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
        offset: false,
        reverse: false,
        min: extendedMin,
        max: extendedMax,
        beginAtZero: false,
        time:
          timeRange === '30m'
            ? {
                unit: 'minute',
                stepSize: 5,
                tooltipFormat: 'h:mm a',
                displayFormats: {
                  minute: 'h:mm a',
                },
              }
            : dayRanges[timeRange]
            ? {
                unit: 'day',
                stepSize: 1,
                tooltipFormat: 'MMM d, yyyy',
                displayFormats: { day: 'MMM d' },
              }
            : timeRange === '24h' || timeRange === '1h' || timeRange === '3h' || timeRange === '6h' || timeRange === '12h' || timeRange === '48h'
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
        ticks: timeRange === '30m'
          ? {
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 8,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom30mTicks,
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Don't hide any labels for 30m - show all ticks
                let hours = date.getHours()
                const minutes = String(date.getMinutes()).padStart(2, '0')
                const ampm = hours >= 12 ? 'PM' : 'AM'
                hours = hours % 12 || 12
                const time = `${hours}:${minutes} ${ampm}`
                
                // Add "Now" indicator for current time
                return isCurrentTime ? `Now (${time})` : time
              },
            }
          : dayRanges[timeRange]
          ? {
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: customDayTicks,
              callback(value) {
                const date = new Date(value)
                
                // Hide the second tick label to shift all ticks left
                if (value === customDayTicks[1]) {
                  return '' // Return empty string to hide second label
                }
                
                return date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              },
            }
          : timeRange === '24h'
          ? {
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 12,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom24hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const timeDiff = Math.abs(date.getTime() - now.getTime())
                const isCurrentTime = timeDiff < 600000 // Within 10 minutes
                
                // Hide the second tick label to shift all ticks left
                if (value === custom24hTicks[1]) {
                  return '' // Return empty string to hide second label
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
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 8,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom1hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the second tick label to shift all ticks left
                if (value === custom1hTicks[1]) {
                  return '' // Return empty string to hide second label
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
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom3hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the second tick label to shift all ticks left
                if (value === custom3hTicks[1]) {
                  return '' // Return empty string to hide second label
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
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 12,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom6hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the second tick label to shift all ticks left
                if (value === custom6hTicks[1]) {
                  return '' // Return empty string to hide second label
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
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 8,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom12hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the second tick label to shift all ticks left
                if (value === custom12hTicks[1]) {
                  return '' // Return empty string to hide second label
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
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: custom48hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // Hide the second tick label to shift all ticks left
                if (value === custom48hTicks[1]) {
                  return '' // Return empty string to hide second label
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
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                
                // Check if this is the last tick (which should be current time)
                const isLastTick = value === Math.max(...customDayTicks, ...custom1hTicks, ...custom3hTicks, ...custom6hTicks, ...custom12hTicks, ...custom24hTicks, ...custom48hTicks)
                
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
          offset: false, // Remove grid offset to align data with Y-axis
        },
        title: {
          display: true,
          text: 'Time',
          font: { size: 14, family: 'Segoe UI', weight: 'bold' },
          color: isDarkMode ? '#ccc' : '#222',
          padding: { top: 10, bottom: 5 },
        },
      },
      y: {
        min: dataMin,
        max: dataMax,
        position: 'left',
        offset: false,
        beginAtZero: false,
        ticks: {
          stepSize: 5, // Smaller step size for more granular spacing
          maxTicksLimit: 12, // Allow more ticks for better spacing
          color: isDarkMode ? '#ccc' : '#222',
          font: { size: 13, family: 'Segoe UI' },
          callback: function (value) {
            return `${Math.round(value)}°${tempUnit}`
          },
          padding: 0, // No padding for Y-axis labels
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
          font: { family: 'Segoe UI', size: 14 },
          padding: { top: 0, bottom: 0, left: 5, right: 5 },
        },
      },
    },
  }), [timeRange, isDarkMode, tempUnit, dataMin, dataMax, extendedMin, extendedMax, custom30mTicks, custom24hTicks, customDayTicks, custom1hTicks, custom3hTicks, custom6hTicks, custom12hTicks, custom48hTicks, zonesVisibility])

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
            width: '102%',
            marginLeft: '-1%'
          }}
        />
        <div className="chart-container">
          {!isChangingTimeRange && dataSource.length > 0 && (
            <Line 
              key={`chart-${timeRange}-${selectedCamera}-${refreshCounter}`}
              ref={chartRef} 
              data={data} 
              options={mergedOptions}
            />
          )}
          {(isCameraSwitching || isChangingTimeRange) && (
            <div className="camera-switching-overlay">
              <div className="loading-spinner-large"></div>
              <h2>{isCameraSwitching ? 'Switching Cameras...' : 'Changing Time Range...'}</h2>
              <p style={{ 
                marginTop: '10px', 
                fontSize: '14px', 
                opacity: '0.8',
                color: 'inherit'
              }}>
                {isCameraSwitching ? 'Please wait while camera data loads...' : 'Please wait, there may be a slight delay while the chart updates to the new time interval...'}
              </p>
            </div>
          )}
          
          {/* Test box for 48h debugging */}
          {timeRange === '48h' && (
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '10px',
              borderRadius: '5px',
              fontSize: '12px',
              zIndex: 1000
            }}>
              <div>48h Test Data:</div>
              <div>Data points: {dataToUse.length}</div>
              <div>Datasets: {data.datasets.length}</div>
              <div>First dataset points: {data.datasets[0]?.data?.length || 0}</div>
              <div>Zones visible: {Object.values(zonesVisibility).filter(v => v !== false).length}</div>
              <div>Time range: {timeRange}</div>
              <div>Camera: {selectedCamera}</div>
              <div>Test data key: {testDataKey}</div>
              <div>LocalStorage has data: {dataToUse.length > 0 ? 'Yes' : 'No'}</div>
            </div>
          )}
        </div>
      </div>

      <div
        className="chart-button-container"
        style={{
          color: isDarkMode ? '#eee' : undefined
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
          className="chart-button zone-toggle"
          style={{
            borderColor: '#dc2626',
            backgroundColor: allZonesHidden ? '#dc2626' : 'transparent',
            color: allZonesHidden ? '#ffffff' : '#dc2626', // White text when showing "Show All Zones"
          }}
        >

          <span>
            {allZonesHidden ? (
              <span style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '2px solid #ffffff', // White border for the icon
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
                  border: '1px solid #ffffff', // White border for the inner icon
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
            onChange={e => {
              const newTimeRange = e.target.value
              setIsChangingTimeRange(true)
              
              // Simple approach for most intervals, special handling only for 48h
              setTimeout(() => {
                // Special handling for 24h and 48h to fix their horizontal layout issues
                if (newTimeRange === '24h' || newTimeRange === '48h') {
                  // Reset zoom to clean state
                  if (chartRef.current && chartRef.current.resetZoom) {
                    chartRef.current.resetZoom()
                  }
                  
                  // Reset initial range to force time axis recalculation
                  setInitialRange(null)
                  
                  // Set new time range
                  setTimeRange(newTimeRange)
                  localStorage.setItem('timeRange', newTimeRange)
                  
                  // Force chart re-mount with higher increment to ensure complete reset
                  setRefreshCounter(prev => prev + 3)
                  
                  // Slightly longer delay to ensure time axis recalculates properly
                  setTimeout(() => setIsChangingTimeRange(false), 200)
                } else {
                  // Simple approach for all other intervals
                  if (chartRef.current && chartRef.current.resetZoom) {
                    chartRef.current.resetZoom()
                  }
                  
                  setInitialRange(null)
                  setTimeRange(newTimeRange)
                  localStorage.setItem('timeRange', newTimeRange)
                  setRefreshCounter(prev => prev + 1)
                  
                  // Simple delay for other ranges
                  setTimeout(() => setIsChangingTimeRange(false), 150)
                }
              }, 50)
            }}
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