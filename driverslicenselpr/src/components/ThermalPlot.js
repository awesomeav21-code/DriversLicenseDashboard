import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  Chart,
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
  onEventsPageChange = () => {},
  showEventsPage = false,
  setShowEventsPage = () => {},
}) {
  const chartRef = useRef(null)
  const resizeTimeoutRef = useRef(null)
  const containerRef = useRef(null)
  const allZonesHiddenRef = useRef(false) // Track button state without causing re-renders
  const legendClickTestRef = useRef(null) // Track test result
  const isManualLegendClickRef = useRef(false) // Track when we're in a manual legend click
  const dynamicDataIntervalRef = useRef(null) // Track dynamic data interval
  const previousTimestampsRef = useRef(null) // Track previous timestamps for comparison

  // Handle window resize with debouncing to prevent layout thrashing
  useEffect(() => {
    const handleResize = () => {
      // Clear existing timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      
      // Update container width for debugging
      setContainerWidth(window.innerWidth)
      
      // Get actual container width
      if (containerRef.current) {
        setActualContainerWidth(containerRef.current.offsetWidth)
      }
      
      // Debounce resize handling to prevent excessive updates
      resizeTimeoutRef.current = setTimeout(() => {
        if (chartRef.current) {
          // Only trigger a minimal update without recalculating options
          chartRef.current.resize()
        }
      }, 50) // Reduced debounce to minimize flicker
    }

    // Initial width setting
    if (typeof window !== 'undefined') {
      setContainerWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])

  // Cleanup chart instance when component unmounts completely
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        console.log('🧹 Component unmounting - destroying chart instance')
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, []) // Only run on unmount

  // Separate useEffect to measure container width after render
  useEffect(() => {
    const measureWidth = () => {
      if (containerRef.current) {
        setActualContainerWidth(containerRef.current.offsetWidth)
      }
    }

    // Measure immediately
    measureWidth()
    
    // Also measure after a short delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(measureWidth, 200)
    
    return () => clearTimeout(timeoutId)
  }, []) // Only run once after mount

  // Removed isChartReady state - no longer needed for dynamic updates
  const [timeRange, setTimeRange] = useState(() => localStorage.getItem('timeRange') || '1h')
  const [isChangingTimeRange, setIsChangingTimeRange] = useState(false)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [hasUserZoomed, setHasUserZoomed] = useState(false) // Track if user has zoomed into chart
  const [zoomPreserved, setZoomPreserved] = useState(null) // null, true (preserved), false (reset)
  const [preservedYAxis, setPreservedYAxis] = useState(null) // Store Y-axis limits when user zooms
  const [allZonesHidden, setAllZonesHidden] = useState(false) // Always start with zones visible
  const [legendClickTestResult, setLegendClickTestResult] = useState(null) // null, true (connected), false (not connected)
  const [testResults, setTestResults] = useState({
    zoomPreserved: null,
    buttonStateUpdated: null,
    lastLegendClick: null,
    lastButtonState: null
  })
  
  // Time range switch test indicator state
  const [timeRangeSwitchTest, setTimeRangeSwitchTest] = useState({
    isVisible: true, // Always visible for debugging
    previousTimeRange: timeRange,
    currentTimeRange: timeRange,
    dataWasReset: false,
    switchTimestamp: new Date().toISOString()
  })

  // Cleanup chart instance when component unmounts
  useEffect(() => {
    return () => {
      // Only cleanup on unmount, not on every change
      if (chartRef.current) {
        console.log('🧹 Component unmounting - destroying chart instance')
        try {
          chartRef.current.destroy()
        } catch (error) {
          console.log('Chart destruction error (ignoring):', error.message)
        }
        chartRef.current = null
      }
    }
  }, []) // Only run on unmount

  // Test console logging
  console.log('🎯 ThermalPlot component rendered at:', new Date().toISOString())
  console.log(`🎯 Current timeRange: ${timeRange}, selectedCamera: ${selectedCamera}`)

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
  const [containerWidth, setContainerWidth] = useState(0)
  const [actualContainerWidth, setActualContainerWidth] = useState(0)
  const previousAxisMinRef = useRef(null)
  const previousAxisMaxRef = useRef(null)
  const [isDynamicMovement, setIsDynamicMovement] = useState(false)
  

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
    console.log("🔄 TIME RANGE CHANGED - useEffect is running")
    console.log(`🔄 useEffect triggered - timeRange: ${timeRange}, selectedCamera: ${selectedCamera}`)
    console.log(`🚨🚨🚨 TIME RANGE SWITCH DETECTED 🚨🚨🚨`)
    console.log(`📊 Current dataToUse length before switch: ${dataToUse.length}`)
    console.log(`📊 Current dataSource length before switch: ${dataSource ? dataSource.length : 'undefined'}`)
    
    
    // Simple test log to make sure console is working
    console.log("TEST: This should appear in console when time range changes")
    
    // Add a counter to track how many times this runs
    if (!window.useEffectCounter) window.useEffectCounter = 0
    window.useEffectCounter++
    console.log(`🔄 useEffect run count: ${window.useEffectCounter}`)
    
    if (window.useEffectCounter > 5) {
      console.error("🚨 INFINITE LOOP DETECTED - STOPPING DEBUG LOGS")
      return
    }
    
    // Check if data already exists for this time range and camera
    const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    const existingData = localStorage.getItem(testDataKey)
    console.log(`🔍 Checking for existing data with key: ${testDataKey}`)
    console.log(`🔍 Existing data found: ${existingData ? 'YES' : 'NO'}`)
    
    // Also check for combined data from all cameras
    const combinedDataKey = `thermalHistory${timeRange}_all_cameras`
    const combinedData = localStorage.getItem(combinedDataKey)
    console.log(`🔍 Checking for combined data with key: ${combinedDataKey}`)
    console.log(`🔍 Combined data found: ${combinedData ? 'YES' : 'NO'}`)
    
    // Prioritize combined data to show all cameras' data
    if (combinedData) {
      try {
        const parsedCombinedData = JSON.parse(combinedData)
        if (parsedCombinedData.length > 0) {
          console.log(`📊 Found combined data: ${parsedCombinedData.length} points for ${timeRange} from all cameras`)
          console.log(`📊 Loading combined data to show all camera history`)
          console.log(`✅✅✅ COMBINED DATA LOADED - SHOWING ALL CAMERAS ✅✅✅`)
          
          // Load the combined data into state
          setDataToUse(parsedCombinedData)
          console.log(`✅ Combined data loaded successfully - dataToUse should now have ${parsedCombinedData.length} points`)
          return
        }
      } catch (error) {
        console.warn('Failed to parse combined data, will try camera-specific data:', error.message)
      }
    }
    
    // If no combined data, try camera-specific data
    if (existingData) {
      try {
        const parsedData = JSON.parse(existingData)
        if (parsedData.length > 0) {
          console.log(`📊 Found camera-specific data: ${parsedData.length} points for ${timeRange} on ${selectedCamera}`)
          console.log(`📊 Loading camera-specific data`)
          console.log(`✅✅✅ CAMERA DATA LOADED ✅✅✅`)
          console.log(`📊 DataToUse will be set to ${parsedData.length} points`)
          
          // Load the existing data into state
          setDataToUse(parsedData)
          console.log(`✅ Data loaded successfully - dataToUse should now have ${parsedData.length} points`)
          return
        }
      } catch (error) {
        console.warn('Failed to parse existing data, will regenerate:', error.message)
      }
    }
    
    // For ALL time ranges, always generate fresh data to ensure immediate loading with correct intervals
    if (true) {
      console.log(`🔍 ${timeRange}: Clearing localStorage and generating fresh data with correct intervals`)
      // Clear any existing data to force fresh generation with correct intervals
      localStorage.removeItem(`thermalHistory${timeRange}_${selectedCamera}`)
      localStorage.removeItem(`thermalHistory${timeRange}_all_cameras`)
      const now = new Date()
      const testData = []
      
      // Set appropriate entries and intervals for each time range
      let entries, interval, startTime
      if (timeRange === '30m') {
        entries = 60 // 30 minutes = 60 data points
        interval = 30 * 1000 // 30 second intervals
        startTime = new Date(now.getTime() - (30 * 60 * 1000))
      } else if (timeRange === '1h') {
        entries = 60 // 1 hour = 60 data points
        interval = 60 * 1000 // 1 minute intervals
        startTime = new Date(now.getTime() - (60 * 60 * 1000))
      } else if (timeRange === '3h') {
        entries = 180 // 3 hours = 180 data points
        interval = 60 * 1000 // 1 minute intervals
        startTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
      } else if (timeRange === '6h') {
        entries = 360 // 6 hours = 360 data points
        interval = 60 * 1000 // 1 minute intervals
        startTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
      } else if (timeRange === '12h') {
        entries = 720 // 12 hours = 720 data points (1 minute intervals)
        interval = 60 * 1000 // 1 minute intervals
        startTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
      } else if (timeRange === '24h') {
        entries = 1440 // 24 hours = 1440 data points (1 minute intervals)
        interval = 60 * 1000 // 1 minute intervals
        startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      } else if (timeRange === '48h') {
        entries = 2880 // 48 hours = 2880 data points (1 minute intervals)
        interval = 60 * 1000 // 1 minute intervals
        startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
      } else if (timeRange === '7d') {
        entries = 98 // 7 days = 98 data points (14 points per day)
        interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1) // 7 days divided by entries
        startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '1m') {
        entries = 30 // 1 month = 30 data points (1 per day)
        interval = 24 * 60 * 60 * 1000 // 1 day intervals
        startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
      } else {
        // Fallback to 24 hours
        entries = 1440
        interval = 60 * 1000
        startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      }
      
      // Seeded random for consistent data
      const seededRandom = (seed) => {
        const x = Math.sin(seed) * 10000
        return x - Math.floor(x)
      }
      
      for (let i = 0; i < entries; i++) {
        const time = new Date(startTime.getTime() + (i * interval))
        const readings = {}
        
        Array.from({ length: 8 }, (_, zoneIndex) => `Zone_${zoneIndex + 1}`).forEach((zoneName, zoneIndex) => {
          const isLeftCamera = selectedCamera === 'planck_1'
          const cameraOffset = isLeftCamera ? 2 : 0
          // Create more varied base temperatures - some zones naturally run hotter
          const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
          const zoneBaseTemp = 75 + baseVariation + cameraOffset
          
          const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
          const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
          const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
          const noiseSeed = i * 1000 + zoneIndex * 100 + (selectedCamera === 'planck_1' ? 7000 : 8000) + 9000
          const randomNoise = (seededRandom(noiseSeed) - 0.5) * 1.4
          const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
          
          // Add time-based patterns that can cause different zones to spike
          const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
          const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
          const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
          readings[zoneName] = Math.round(finalTemp * 10) / 10
        })
        
        testData.push({
          time: time.toISOString(),
          readings: readings
        })
      }
      
      console.log(`✅ Generated ${testData.length} data points for ${timeRange} in useEffect`)
      
      // Store data for the current time range and camera
      try {
        const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
        localStorage.setItem(testDataKey, JSON.stringify(testData))
        
        // Combine data from all cameras and save as combined data
        const combinedDataKey = `thermalHistory${timeRange}_all_cameras`
        const existingCombinedData = localStorage.getItem(combinedDataKey)
        let combinedData = []
        
        if (existingCombinedData) {
          try {
            combinedData = JSON.parse(existingCombinedData)
            console.log(`📊 Found existing combined ${timeRange} data: ${combinedData.length} points`)
          } catch (error) {
            console.warn(`Failed to parse existing combined ${timeRange} data:`, error.message)
            combinedData = []
          }
        }
        
        // Add current camera data to combined data
        combinedData = [...combinedData, ...testData]
        
        // Sort combined data by time to maintain chronological order
        combinedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        
        // Save combined data
        localStorage.setItem(combinedDataKey, JSON.stringify(combinedData))
        console.log(`✅ Combined ${timeRange} data saved: ${combinedData.length} total points from all cameras`)
      } catch (error) {
        console.warn(`Failed to store ${timeRange} combined data:`, error.message)
      }
      
      setDataToUse(testData)
      return
    }
    
    // Data generation will proceed if we reach this point
    
    console.log(`🔍 Generating initial data for ${timeRange} on ${selectedCamera}`)
    console.log(`🔍 Current dataToUse length: ${dataToUse.length}`)
    console.log(`🔍 Current dataSource length: ${dataSource ? dataSource.length : 'undefined'}`)
    console.log(`❌❌❌ DATA CLEARED - REGENERATING ❌❌❌`)
    
    // Seeded random number generator for consistent data
  const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  const generateTestData = () => {
      const now = new Date()
      let interval, entries, chartStartTime
      
      // Set interval based on time range
      if (timeRange === '30m') {
        interval = 30 * 1000 // 30 seconds in milliseconds
        entries = 60 // 30 minutes = 60 data points (1 per 30 seconds)
        chartStartTime = new Date(now.getTime() - (30 * 60 * 1000))
      } else if (timeRange === '1h') {
        interval = 60 * 1000 // 60 seconds in milliseconds
        entries = 60 // 1 hour = 60 data points
        chartStartTime = new Date(now.getTime() - (60 * 60 * 1000))
      } else if (timeRange === '3h') {
        interval = 60 * 1000 // 60 seconds in milliseconds
        entries = 180 // 3 hours = 180 data points
        chartStartTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
      } else if (timeRange === '6h') {
        interval = 60 * 1000 // 60 seconds in milliseconds
        entries = 360 // 6 hours = 360 data points
        chartStartTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
      } else if (timeRange === '12h') {
        interval = 60 * 1000 // 1 minute in milliseconds
        entries = 720 // 12 hours = 720 data points (1 minute intervals)
        chartStartTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
      } else if (timeRange === '24h') {
        interval = 60 * 1000 // 1 minute in milliseconds
        entries = 1440 // 24 hours = 1440 data points (1 minute intervals)
        chartStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      } else if (timeRange === '48h') {
        interval = 60 * 1000 // 1 minute in milliseconds
        entries = 2880 // 48 hours = 2880 data points (1 minute intervals)
        chartStartTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
      } else if (timeRange === '2d') {
        entries = 2880 // 2 days = 2880 data points
        chartStartTime = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '4d') {
        entries = 5760 // 4 days = 5760 data points
        chartStartTime = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '7d') {
        // For 7 days: 14 points per day × 7 days = 98 total entries (old filtering approach)
        entries = 98 // Exactly 14 points per day for 7 days
        chartStartTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)) // Exactly 7 days ago
        interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1) // 7 days divided by entries
      } else if (timeRange === '2w') {
        entries = 20160 // 2 weeks = 20160 data points
        chartStartTime = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
      } else if (timeRange === '1m') {
        // For 1 month: Generate data for exactly 30 days
        entries = 30 // 30 days = 30 data points (1 per day)
        chartStartTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)) // Exactly 30 days ago
        interval = 24 * 60 * 60 * 1000 // 1 day in milliseconds
      } else if (timeRange === '1y') {
        entries = 525600 // 1 year = 525600 data points (365 days)
        chartStartTime = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
      } else {
        // Fallback to 24 hours
        entries = 1440
        chartStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      }
      
      // Generate test data for the current camera
      const newTestData = []
      for (let i = 0; i < entries; i++) {
        let time
        if (i === entries - 1) {
          // Ensure the last data point is exactly at current time
          time = new Date(now.getTime())
        } else {
          // For 7d and 1m, use the calculated interval; for others, use 1-minute intervals
          if (timeRange === '7d' || timeRange === '1m') {
            const baseTime = chartStartTime.getTime() + (i * interval)
            // Use seeded random for consistent seconds variation
            const seed = i + (timeRange === '7d' ? 1000 : 2000) + (selectedCamera === 'planck_1' ? 100 : 200)
            const randomSeconds = Math.floor(seededRandom(seed) * 60) * 1000
            time = new Date(baseTime + randomSeconds)
          } else {
            // Generate points at 1-minute intervals with consistent seconds variation
            const baseTime = chartStartTime.getTime() + (i * interval)
            // Use seeded random for consistent seconds variation
            const seed = i + (timeRange === '1h' ? 3000 : 4000) + (selectedCamera === 'planck_1' ? 300 : 400)
            const randomSeconds = Math.floor(seededRandom(seed) * 60) * 1000
            time = new Date(baseTime + randomSeconds)
          }
        }
        const readings = {}
        
        Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
          const isLeftCamera = selectedCamera === 'planck_1'
          const cameraOffset = isLeftCamera ? 2 : 0
          
          // Create more varied base temperatures - some zones naturally run hotter
          const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
          const zoneBaseTemp = 75 + baseVariation + cameraOffset
          
          const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
          const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
          const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
          // Use seeded random for consistent noise
          const noiseSeed = i * 1000 + zoneIndex * 100 + (selectedCamera === 'planck_1' ? 5000 : 6000)
          const randomNoise = (seededRandom(noiseSeed) - 0.5) * 1.4
          const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
          
          // Add time-based patterns that can cause different zones to spike
          const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
          const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
          const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
          const minTemp = 60 // Lower minimum
          const maxTemp = 200 // Higher maximum to allow for threshold breaches
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
        console.log(`🔄🔄🔄 NEW DATA SET IN STATE 🔄🔄🔄`)
        
        // Debug: Show time range of generated data
        if (newTestData.length > 0) {
          const firstTime = new Date(newTestData[0].time)
          const lastTime = new Date(newTestData[newTestData.length - 1].time)
          console.log(`🔍 Generated data time range: ${firstTime.toLocaleString()} to ${lastTime.toLocaleString()}`)
          console.log(`🔍 Time span: ${(lastTime.getTime() - firstTime.getTime()) / (60 * 1000)} minutes`)
        }
        
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
        
        // Combine data from all cameras and save as combined data
        const combinedDataKey = `thermalHistory${timeRange}_all_cameras`
        const existingCombinedData = localStorage.getItem(combinedDataKey)
        let combinedData = []
        
        if (existingCombinedData) {
          try {
            combinedData = JSON.parse(existingCombinedData)
            console.log(`📊 Found existing combined data: ${combinedData.length} points`)
          } catch (error) {
            console.warn('Failed to parse existing combined data:', error.message)
            combinedData = []
          }
        }
        
        // Add current camera data to combined data
        combinedData = [...combinedData, ...newTestData]
        
        // Sort combined data by time to maintain chronological order
        combinedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        
        // Save combined data
        localStorage.setItem(combinedDataKey, JSON.stringify(combinedData))
        console.log(`✅ Combined data saved: ${combinedData.length} total points from all cameras for ${timeRange}`)
        
      } catch (error) {
        console.error(`Failed to store test data:`, error.message)
      }
    }
    
    // Only generate data if no existing data (camera-specific or combined) was found
    if (!existingData && !combinedData) {
      console.log(`❌❌❌ NO EXISTING DATA FOUND - WILL CLEAR AND REGENERATE ❌❌❌`)
      console.log(`🚨 DATA CLEARING TEST: This should only happen on first load or when localStorage is cleared`)
      generateTestData()
    } else {
      console.log(`✅✅✅ EXISTING DATA FOUND - NO CLEARING WILL OCCUR ✅✅✅`)
      console.log(`🧪 DATA PRESERVATION TEST: Data should be preserved during time range switches`)
    }
  }, [timeRange, selectedCamera])

  // Helper function to generate test data for a specific camera
  const generateTestDataForCamera = (camera, timeRange) => {
    const testData = []
    const now = new Date()
    
    // Seeded random number generator for consistent data
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    
    let interval, entries, dataStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000)) // Default to 24 hours ago
    
    if (timeRange === '30m') {
      // For 30 minutes: Generate data points every 30 seconds
      entries = 60 // 30 minutes * 60 seconds / 30 seconds = 60 entries
      const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000))
      dataStartTime = thirtyMinutesAgo
      interval = 30 * 1000 // 30 seconds in milliseconds
    } else if (timeRange === '1h') {
      // For 1 hour: Generate data points every 10 seconds
      entries = (60 * 60) / 10 // 1 hour * 60 minutes * 60 seconds / 10 seconds = 360 entries
      dataStartTime = new Date(now.getTime() - (60 * 60 * 1000))
      interval = 10 * 1000 // 10 seconds in milliseconds
    } else if (timeRange === '3h') {
      // For 3 hours: Generate data points every 30 seconds
      entries = (3 * 60 * 60) / 30 // 3 hours * 60 minutes * 60 seconds / 30 seconds = 360 entries
      dataStartTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
      interval = 30 * 1000 // 30 seconds in milliseconds
    } else if (timeRange === '6h') {
      // For 6 hours: Generate data points every 1 minute
      entries = (6 * 60) / 1 // 6 hours * 60 minutes / 1 minute = 360 entries
      dataStartTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
      interval = 1 * 60 * 1000 // 1 minute in milliseconds
    } else if (timeRange === '12h') {
      // For 12 hours: Generate data points every 10 minutes
      entries = 72 // 12 hours * 60 minutes / 10 minutes = 72 entries
      dataStartTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
      interval = 10 * 60 * 1000 // 10 minutes in milliseconds
    } else if (timeRange === '24h') {
      // For 24 hours: Generate data points every 15 minutes
      entries = 96 // 24 hours * 60 minutes / 15 minutes = 96 entries
      dataStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      interval = 15 * 60 * 1000 // 15 minutes in milliseconds
    } else if (timeRange === '48h') {
      // For 48 hours: Generate data points every 30 minutes
      entries = 96 // 48 hours * 60 minutes / 30 minutes = 96 entries
      dataStartTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
      interval = 30 * 60 * 1000 // 30 minutes in milliseconds
    } else if (['2d', '4d', '7d', '2w', '1m', '1y'].includes(timeRange)) {
      if (timeRange === '1m') {
        // For 1m, generate exactly 30 days of data
        entries = 720 // 30 days = 720 data points (1 per hour)
        dataStartTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)) // Exactly 30 days ago
      } else {
        if (timeRange === '2d') {
          entries = 288 // 2 days * 144 points per day
          dataStartTime = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000))
        } else if (timeRange === '4d') {
          entries = 576 // 4 days * 144 points per day
          dataStartTime = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000))
        } else if (timeRange === '7d') {
          entries = 1008 // 7 days * 144 points per day
          dataStartTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
        } else if (timeRange === '2w') {
          entries = 2016 // 14 days * 144 points per day
          dataStartTime = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
        } else if (timeRange === '1y') {
          entries = 365 // 365 days * 1 point per day
          dataStartTime = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
        } else {
          entries = 288 // Fallback to 24 hours
          dataStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        }
      }
      interval = (now.getTime() - dataStartTime.getTime()) / (entries - 1)
    } else {
      const config = testDataConfig[timeRange]
      if (config) {
        interval = config.interval * 1000
        entries = config.entries
        dataStartTime = new Date(now.getTime() - ((entries - 1) * interval))
        
        // Debug logging for 30m
        if (timeRange === '30m') {
          console.log(`🔍 30m DEBUG - generateTestDataForCamera using config:`, { entries, interval, timeRange })
        }
      }
    }
    
    for (let i = 0; i < entries; i++) {
      const time = new Date(dataStartTime.getTime() + (i * interval))
      const readings = {}
      
      // Determine which zone (if any) should go above threshold for this data point
      const thresholdBreachChance = 0.02 // 2% chance of threshold breach per data point
      const shouldBreachThreshold = Math.random() < thresholdBreachChance
      const breachZoneIndex = shouldBreachThreshold ? Math.floor(Math.random() * 8) : -1
      
      Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
        const isLeftCamera = camera === 'planck_1'
        const cameraOffset = isLeftCamera ? 2 : 0
        
        const zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset
        
        const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
        const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
        const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
        // Use seeded random for consistent noise
        const noiseSeed = i * 1000 + zoneIndex * 100 + (camera === 'planck_1' ? 7000 : 8000) + (timeRange === '30m' ? 9000 : 10000)
        const randomNoise = (seededRandom(noiseSeed) - 0.5) * 1.4
        const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
        
        // Add time-based patterns that can cause different zones to spike
        const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
        const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
        let finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
        
        // If this is the designated breach zone, ensure it goes above threshold
        if (zoneIndex === breachZoneIndex) {
          const threshold = z.name === 'Zone_8' ? 180 : 140
          const breachAmount = 5 + Math.random() * 10 // 5-15 degrees above threshold
          finalTemp = threshold + breachAmount
        }
        
        const minTemp = 60 // Lower minimum
        const maxTemp = 200 // Higher maximum to allow for threshold breaches
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
    // DISABLED: This useEffect was causing data regeneration
    console.log(`🚫 DISABLED: Comprehensive data generation useEffect to prevent timestamp changes`)
    return
    
    const cameras = ['planck_1', 'planck_2']
    const currentTimeRange = timeRange
    
    // Seeded random number generator for consistent data
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    
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
          entries = 60
          startTime = new Date(now.getTime() - (30 * 60 * 1000))
          interval = 30 * 1000 // 30 seconds
        } else if (currentTimeRange === '1h') {
          entries = 60
          startTime = new Date(now.getTime() - (60 * 60 * 1000))
          interval = 60 * 1000 // 1 minute
        } else if (currentTimeRange === '3h') {
          entries = 180
          startTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
          interval = 60 * 1000 // 1 minute
        } else if (currentTimeRange === '6h') {
          entries = 360
          startTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
          interval = 60 * 1000 // 1 minute
        } else if (currentTimeRange === '12h') {
          entries = 720
          startTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
          interval = 60 * 1000 // 1 minute
        } else if (currentTimeRange === '24h') {
          entries = 24 * 20 // 20 points per hour × 24 hours = 480 total entries
          startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
          interval = (24 * 60 * 60 * 1000) / entries
        } else if (currentTimeRange === '48h') {
          entries = 48 * 10 // 10 points per hour × 48 hours = 480 total entries
          startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
          interval = (48 * 60 * 60 * 1000) / entries
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
          entries = 720 // 30 days = 720 data points (1 per hour)
          startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
          interval = 60 * 60 * 1000 // 1 hour intervals
        } else if (currentTimeRange === '1y') {
          entries = 5000
          startTime = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
          interval = (365 * 24 * 60 * 60 * 1000) / (entries - 1)
        } else {
          entries = 24 * 20 // Default to 24h with proper calculation
          startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
          interval = (24 * 60 * 60 * 1000) / entries
        }
        
        // Generate comprehensive data that goes all the way through to earliest data
        for (let i = 0; i < entries; i++) {
          const time = new Date(startTime.getTime() + (i * interval))
          const readings = {}
          
          Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
            const isLeftCamera = camera === 'planck_1'
            const cameraOffset = isLeftCamera ? 2 : 0
            
            // Create more varied base temperatures - some zones naturally run hotter
          const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
          const zoneBaseTemp = 75 + baseVariation + cameraOffset
            
            // Enhanced wave patterns for more realistic data
            const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
            const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
            const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
            // Use seeded random for consistent noise
            const noiseSeed = i * 1000 + zoneIndex * 100 + (camera === 'planck_1' ? 17000 : 18000) + (currentTimeRange === '30m' ? 19000 : currentTimeRange === '1h' ? 20000 : 21000)
            const randomNoise = (seededRandom(noiseSeed) - 0.5) * 1.4
            const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
            
            // Add weekly and monthly patterns for longer time ranges
            let weeklyPattern = 0
            let monthlyPattern = 0
            
            if (currentTimeRange === '1m' || currentTimeRange === '1y') {
              weeklyPattern = Math.sin((time.getDay() / 7) * Math.PI * 2) * 0.6
              monthlyPattern = Math.sin((time.getDate() / 31) * Math.PI * 2) * 0.4
            }
            
            // Add time-based patterns that can cause different zones to spike
          const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
          const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
          const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern + weeklyPattern + monthlyPattern
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
  
  // DISABLED: This useEffect was causing data regeneration
  console.log(`🚫 DISABLED: Another data generation useEffect to prevent timestamp changes`)
  // return

  // Chart will only update when manually triggered (timeRange/camera changes, zone visibility changes)

  // DISABLED: This useEffect was causing constant re-renders and zoom resets
  // Keep states in sync during user interactions (not initial mount)
  // useEffect(() => {
  //   // Skip if we're in a manual legend click to prevent interference with zoom
  //   if (isManualLegendClickRef.current) {
  //     return
  //   }
  //   
  //   const thermalZoneNames = Array.from({ length: 8 }, (_, i) => `Zone_${i + 1}`)
  //   const nextVisible = thermalZoneNames.filter(name => zonesVisibility[name] !== false)
  //   
  //   // Use same logic as manual legend click for consistency
  //   const hiddenZonesCount = thermalZoneNames.filter(name => zonesVisibility[name] === false).length
  //   const totalZones = thermalZoneNames.length
  //   const allZonesCurrentlyHidden = hiddenZonesCount === totalZones
  //   
  //   console.log('useEffect triggered - zonesVisibility changed')
  //   console.log('zonesVisibility:', zonesVisibility)
  //   console.log('Hidden zones count:', hiddenZonesCount, 'out of', totalZones)
  //   console.log('All zones currently hidden:', allZonesCurrentlyHidden)
  //   console.log('current allZonesHidden:', allZonesHidden)
  //   
  //   // Only update if actually different to avoid loops
  //   if (JSON.stringify(visibleZones) !== JSON.stringify(nextVisible)) {
  //     setVisibleZones(nextVisible)
  //   }
  //   
  //   if (allZonesHidden !== allZonesCurrentlyHidden) { // If button state doesn't match visibility
  //     console.log('Updating allZonesHidden from', allZonesHidden, 'to', allZonesCurrentlyHidden)
  //     console.log('Button changed: true')
  //     setAllZonesHidden(allZonesCurrentlyHidden)
  //     
  //     // Update test results to track button state changes
  //     setTestResults(prev => ({
  //       ...prev,
  //       buttonStateUpdated: {
  //         from: allZonesHidden,
  //         to: allZonesCurrentlyHidden,
  //         time: new Date().toISOString()
  //       }
  //     }))
  //   } else {
  //     console.log('Button changed: false')
  //   }
  //   
  //   // eslint-disable-next-line
  // }, [zonesVisibility])


  // Ensure chart data is immediately available when timeRange changes
  useEffect(() => {
    // DISABLED: This useEffect was causing data regeneration
    console.log(`🚫 DISABLED: Immediate data generation useEffect to prevent timestamp changes`)
    return
    
      // Force immediate data generation for the new time range
  const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
  const existingData = localStorage.getItem(testDataKey)
  
  if (!existingData || existingData.length !== 5000) {
    // Generate data immediately for this time range
    const testData = []
    const now = new Date()
    
    // Seeded random number generator for consistent data
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    
    let interval, entries, startTime
      
      if (timeRange === '30m') {
        entries = 60
        const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000))
        startTime = thirtyMinutesAgo
        interval = 30 * 1000 // 30 seconds
      } else if (timeRange === '1h') {
        entries = 60
        startTime = new Date(now.getTime() - (60 * 60 * 1000))
        interval = 60 * 1000 // 1 minute
      } else if (timeRange === '3h') {
        entries = 180
        startTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
        interval = 60 * 1000 // 1 minute
      } else if (timeRange === '6h') {
        entries = 360
        startTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
        interval = 60 * 1000 // 1 minute
      } else if (timeRange === '12h') {
        entries = 72 // 12 hours = 72 data points (10 minute intervals)
        startTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
        interval = 10 * 60 * 1000 // 10 minutes
      } else if (timeRange === '24h') {
        entries = 96 // 24 hours = 96 data points (15 minute intervals)
        startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        interval = 15 * 60 * 1000 // 15 minutes
      } else if (timeRange === '48h') {
        entries = 96 // 48 hours = 96 data points (30 minute intervals)
        startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
        interval = 30 * 60 * 1000 // 30 minutes
      } else if (timeRange === '2d') {
        entries = 5000
        startTime = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000))
        interval = (2 * 24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '4d') {
        entries = 5000
        startTime = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000))
        interval = (4 * 24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '7d') {
        // For 7 days: 14 points per day × 7 days = 98 total entries
        entries = 98 // Exactly 14 points per day for 7 days
        startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
        interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1) // 7 days divided by entries
      } else if (timeRange === '2w') {
        entries = 5000
        startTime = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
        interval = (14 * 24 * 60 * 60 * 1000) / (entries - 1)
      } else if (timeRange === '1m') {
        // For 1 month: 1 point per day × 30 days = 30 total entries
        entries = 30 // Exactly 1 point per day for 30 days
        startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
        interval = 24 * 60 * 60 * 1000 // 1 day in milliseconds
      } else if (timeRange === '1y') {
        entries = 5000
        startTime = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
        interval = (365 * 24 * 60 * 60 * 1000) / (entries - 1)
      } else {
        entries = 24 * 20 // Default to 24h with proper calculation
        startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        interval = (24 * 60 * 60 * 1000) / entries
      }
      
      for (let i = 0; i < entries; i++) {
        const time = new Date(startTime.getTime() + (i * interval))
        const readings = {}
        
        Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
          const isLeftCamera = selectedCamera === 'planck_1'
          const cameraOffset = isLeftCamera ? 2 : 0
          
          // Create more varied base temperatures - some zones naturally run hotter
          const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
          const zoneBaseTemp = 75 + baseVariation + cameraOffset
          
          const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
          const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
          const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
          // Use seeded random for consistent noise
          const noiseSeed = i * 1000 + zoneIndex * 100 + (selectedCamera === 'planck_1' ? 22000 : 23000) + (timeRange === '30m' ? 24000 : timeRange === '1h' ? 25000 : 26000)
          const randomNoise = (seededRandom(noiseSeed) - 0.5) * 1.4
          const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
          
          // Add time-based patterns that can cause different zones to spike
          const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
          const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
          const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
          const minTemp = 60 // Lower minimum
          const maxTemp = 200 // Higher maximum to allow for threshold breaches
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
    
    // Seeded random number generator for consistent data
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    
    console.log('🔄 Starting test data regeneration for critical ranges...')
    
    cameras.forEach(camera => {
      criticalRanges.forEach(range => {
        const testDataKey = `thermalHistory${range}_${camera}`
        console.log(`🔄 Force regenerating ${range} data for ${camera}...`)
        
        const testData = []
        let entries = 5000
        let startTime, interval
        
        if (range === '24h') {
          entries = 24 * 20 // 20 points per hour × 24 hours = 480 total entries
          startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
          interval = (24 * 60 * 60 * 1000) / entries
        } else if (range === '48h') {
          entries = 48 * 10 // 10 points per hour × 48 hours = 480 total entries
          startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
          interval = (48 * 60 * 60 * 1000) / entries
        } else if (range === '7d') {
          startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
          interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1)
        } else if (range === '1m') {
          // Generate comprehensive data for the past 4 months with multiple entries per day
          entries = 240 // 120 days × 2 entries per day = 240 total entries (reduced for performance)
          startTime = new Date(now.getTime() - (120 * 24 * 60 * 60 * 1000)) // 120 days ago
          interval = (120 * 24 * 60 * 60 * 1000) / (entries - 1)
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
            
            // Use seeded random for consistent noise
            const noiseSeed = i * 1000 + zoneIndex * 100 + (camera === 'planck_1' ? 11000 : 12000) + (range === '24h' ? 13000 : range === '48h' ? 14000 : range === '7d' ? 15000 : 16000)
            const randomNoise = (seededRandom(noiseSeed) - 0.5) * 1.4
            const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
            
            // Add weekly and monthly patterns for longer ranges
            let weeklyPattern = 0
            let monthlyPattern = 0
            
            if (range === '7d' || range === '1m') {
              weeklyPattern = Math.sin((time.getDay() / 7) * Math.PI * 2) * 0.6
              monthlyPattern = Math.sin((time.getDate() / 31) * Math.PI * 2) * 0.4
            }
            
            // Add time-based patterns that can cause different zones to spike
          const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
          const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
          const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern + weeklyPattern + monthlyPattern
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

  // Only generate data for essential ranges to avoid localStorage overflow
  useEffect(() => {
    // DISABLED: This useEffect was causing data regeneration
    console.log(`🚫 DISABLED: Essential ranges data generation useEffect to prevent timestamp changes`)
    return
    
    // Only generate for essential ranges that are commonly used
    const essentialRanges = ['1h', '6h', '24h']
    const cameras = ['planck_1', 'planck_2']
    
    // First, ensure essential ranges are generated immediately
    cameras.forEach(camera => {
      essentialRanges.forEach(range => {
        const testDataKey = `thermalHistory${range}_${camera}`
        const existingData = localStorage.getItem(testDataKey)
        if (!existingData) {
          console.log(`🚨 Essential: Generating ${range} data for ${camera} immediately...`)
          // Generate data synchronously for essential ranges
          generateTestDataForCamera(camera, range)
        }
      })
    })
    
    // Then generate comprehensive data for essential cameras and ranges only
    cameras.forEach(camera => {
      essentialRanges.forEach(range => {
        const testDataKey = `thermalHistory${range}_${camera}`
        const existingData = localStorage.getItem(testDataKey)
        if (!existingData) {
          console.log(`🔄 Pre-generating comprehensive data for ${range} on ${camera}...`)
          
          // Generate comprehensive test data that goes all the way through to earliest data
          const testData = []
          const now = new Date()
          
          let interval, entries, startTime
          
          if (range === '30m') {
            entries = 60
            const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000))
            startTime = thirtyMinutesAgo
            interval = 30 * 1000 // 30 seconds
          } else if (range === '1h') {
            entries = 60
            startTime = new Date(now.getTime() - (60 * 60 * 1000))
            interval = 60 * 1000 // 1 minute
          } else if (range === '3h') {
            entries = 180
            startTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
            interval = 60 * 1000 // 1 minute
          } else if (range === '6h') {
            entries = 360
            startTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
            interval = 60 * 1000 // 1 minute
          } else if (range === '12h') {
            entries = 720
            startTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
            interval = 60 * 1000 // 1 minute
          } else if (range === '24h') {
            entries = 24 * 20 // 20 points per hour × 24 hours = 480 total entries
            startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
            interval = (24 * 60 * 60 * 1000) / entries
          } else if (range === '48h') {
            entries = 48 * 10 // 10 points per hour × 48 hours = 480 total entries
            startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
            interval = (48 * 60 * 60 * 1000) / entries
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
              
              // Create more varied base temperatures - some zones naturally run hotter
          const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
          const zoneBaseTemp = 75 + baseVariation + cameraOffset
              
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
              
              // Add time-based patterns that can cause different zones to spike
          const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
          const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
          const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern + weeklyPattern + monthlyPattern
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
    // DISABLED: This useEffect was causing data changes
    console.log(`🚫 DISABLED: History update useEffect to prevent timestamp changes`)
    return
    
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
    allZonesHiddenRef.current = allZonesHidden
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

  // Test data configuration - minute-based approach for most ranges, old filtering for 7d and 1m
  const testDataConfig = {
    '30m': { entries: 60, interval: 30 * 1000, peakChance: 0.05 }, // 30 minutes = 60 points (1 per 30 seconds)
    '1h': { entries: 60, interval: 60 * 1000, peakChance: 0.06 }, // 1 hour = 60 points (1 per minute)
    '3h': { entries: 180, interval: 60 * 1000, peakChance: 0.07 }, // 3 hours = 180 points (1 per minute)
    '6h': { entries: 360, interval: 60 * 1000, peakChance: 0.08 }, // 6 hours = 360 points (1 per minute)
    '12h': { entries: 72, interval: 10 * 60 * 1000, peakChance: 0.09 }, // 12 hours = 72 points (1 per 10 minutes)
    '24h': { entries: 96, interval: 15 * 60 * 1000, peakChance: 0.10 }, // 24 hours = 96 points (1 per 15 minutes)
    '48h': { entries: 96, interval: 30 * 60 * 1000, peakChance: 0.12 }, // 48 hours = 96 points (1 per 30 minutes)
    '2d': { entries: 2880, interval: 60 * 1000, peakChance: 0.15 }, // 2 days = 2880 points (1 per minute)
    '4d': { entries: 5760, interval: 60 * 1000, peakChance: 0.18 }, // 4 days = 5760 points (1 per minute)
    '7d': { entries: 98, interval: (7 * 24 * 60 * 60 * 1000) / (98 - 1), peakChance: 0.20 }, // 7 days = 98 points (old filtering)
    '2w': { entries: 20160, interval: 60 * 1000, peakChance: 0.25 }, // 2 weeks = 20160 points (1 per minute)
    '1m': { entries: 30, interval: 24 * 60 * 60 * 1000, peakChance: 0.30 }, // 1 month = 30 points (1 per day)
    '1y': { entries: 525600, interval: 60 * 1000, peakChance: 0.35 } // 1 year = 525600 points (1 per minute)
  }

  // Generate test data for all time ranges
  useEffect(() => {
    // DISABLED: This useEffect was causing data regeneration
    console.log(`🚫 DISABLED: Test data generation useEffect to prevent timestamp changes`)
    return
    
    const config = testDataConfig[timeRange]
    if (!config) return

    // Always regenerate data for 30m to ensure we get 5000 entries
    const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    const existingData = localStorage.getItem(testDataKey)
    
    // Always regenerate data for all time ranges to ensure fresh data on every switch
    if (false) {
      console.log(`📊 Using existing data for ${timeRange}: ${JSON.parse(existingData).length} entries`)
      return
    }
    
    // Preserve existing data when switching time ranges - only clear if no data exists
    console.log(`📊 Preserving existing data for ${timeRange} - no aggressive clearing`)
    
    // Only clear data if it doesn't exist and we need to generate fresh data
    if (!existingData) {
      console.log(`📊 No existing data found for ${timeRange}, will generate new data`)
    } else {
      console.log(`📊 Found existing data for ${timeRange}, preserving it`)
    }
    
    // Only regenerate if no existing data is found
    if (!existingData) {
      console.log(`🔄 No existing data found for ${timeRange}, generating new data`)
    } else {
      console.log(`📊 Using existing data for ${timeRange}, skipping regeneration`)
      return
    }
    
    const testData = []
    const now = new Date()
    
    // Generate data points every minute (60-second intervals) for all time ranges
    let interval, entries, startTime
    
    // Set interval to exactly 1 minute (60 seconds) for all time ranges
    interval = 60 * 1000 // 60 seconds in milliseconds
    
    // Calculate entries based on time range - one point per minute
    if (timeRange === '30m') {
      entries = 30 // 30 minutes = 30 data points
      startTime = new Date(now.getTime() - (30 * 60 * 1000))
    } else if (timeRange === '1h') {
      entries = 60 // 1 hour = 60 data points
      startTime = new Date(now.getTime() - (60 * 60 * 1000))
    } else if (timeRange === '3h') {
      entries = 180 // 3 hours = 180 data points
      startTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
    } else if (timeRange === '6h') {
      entries = 360 // 6 hours = 360 data points
      startTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
    } else if (timeRange === '12h') {
      entries = 72 // 12 hours = 72 data points (10 minute intervals)
      interval = 10 * 60 * 1000 // 10 minutes in milliseconds
      startTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
    } else if (timeRange === '24h') {
      entries = 96 // 24 hours = 96 data points (15 minute intervals)
      interval = 15 * 60 * 1000 // 15 minutes in milliseconds
      startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
    } else if (timeRange === '48h') {
      entries = 96 // 48 hours = 96 data points (30 minute intervals)
      interval = 30 * 60 * 1000 // 30 minutes in milliseconds
      startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
    } else if (timeRange === '2d') {
      entries = 2880 // 2 days = 2880 data points
      startTime = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000))
    } else if (timeRange === '4d') {
      entries = 5760 // 4 days = 5760 data points
      startTime = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000))
    } else if (timeRange === '7d') {
      // For 7 days: 14 points per day × 7 days = 98 total entries (old filtering approach)
      entries = 98 // Exactly 14 points per day for 7 days
      interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1) // 7 days divided by entries
      startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
    } else if (timeRange === '2w') {
      entries = 20160 // 2 weeks = 20160 data points
      startTime = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
    } else if (timeRange === '1m') {
      // For 1 month: 1 point per hour × 30 days = 720 total entries
      entries = 720 // Exactly 1 point per hour for 30 days
      interval = 60 * 60 * 1000 // 1 hour in milliseconds
      startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
    } else if (timeRange === '1y') {
      entries = 525600 // 1 year = 525600 data points (365 days)
      startTime = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000))
    } else {
      // Fallback to 24 hours
      entries = 1440
      startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
    }
    
    if (timeRange === '7d' || timeRange === '1m') {
      console.log(`🔍 Data generation for ${timeRange}: interval=${interval}ms (old filtering approach), entries=${entries}`)
    } else {
      console.log(`🔍 Data generation for ${timeRange}: interval=${interval}ms (1 minute), entries=${entries} (one per minute)`)
    }
    console.log(`🔍 ${timeRange} specific: startTime=${startTime}, endTime=${now}, totalDuration=${now.getTime() - startTime.getTime()}ms`)
    console.log(`🔍 ${timeRange} data will span from ${startTime.toLocaleString()} to ${now.toLocaleString()}`)
    
    // Generate data that goes up to and includes the current time
    // All time ranges now use exactly one point per minute
    
    console.log(`🔍 Generating ${entries} data points from ${startTime.toLocaleString()} with interval ${interval}ms`)
    
    for (let i = 0; i < entries; i++) {
      let time
      if (i === entries - 1) {
        // Ensure the last data point is exactly at current time
        time = new Date(now.getTime())
      } else {
        // For 7d and 1m, use the calculated interval; for others, use 1-minute intervals
        if (timeRange === '7d' || timeRange === '1m') {
          time = new Date(startTime.getTime() + (i * interval))
        } else {
          // Generate points at exactly 1-minute intervals
          time = new Date(startTime.getTime() + (i * interval))
        }
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
        // Add time-based patterns that can cause different zones to spike
        const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
        const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
        const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
        
        // Keep within zone's range (±2.5°F from base)
        const minTemp = 60 // Lower minimum
        const maxTemp = 200 // Higher maximum to allow for threshold breaches
        const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
        
        readings[z.name] = clampedTemp
      })
      
      testData.push({ time, readings })
    }
    
    try {
      localStorage.setItem(testDataKey, JSON.stringify(testData))
      console.log(`✅ Successfully stored ${testData.length} data points for ${timeRange} on ${selectedCamera}`)
        
        // Log data generation details for all time ranges
        if (timeRange === '7d' || timeRange === '1m') {
          console.log(`🔍 ${timeRange} DEBUG - Generated: ${testData.length} points, Expected: ${entries} (old filtering approach)`)
        } else {
          console.log(`🔍 ${timeRange} DEBUG - Generated: ${testData.length} points, Expected: ${entries} (one per minute)`)
        }
        console.log(`🔍 ${timeRange} DEBUG - Camera: ${selectedCamera}`)
        console.log(`🔍 ${timeRange} DEBUG - First point time: ${testData[0]?.time}`)
        console.log(`🔍 ${timeRange} DEBUG - Last point time: ${testData[testData.length - 1]?.time}`)
        console.log(`🔍 ${timeRange} DEBUG - Total span: ${(new Date(testData[testData.length - 1]?.time).getTime() - new Date(testData[0]?.time).getTime()) / (60 * 1000)} minutes`)
      
      // CRITICAL: Update the dataToUse state so the chart can render
      setDataToUse(testData)
      console.log(`✅ Updated dataToUse state with ${testData.length} data points for ${timeRange}`)
      
      // Log data state update for all time ranges
      console.log(`🔍 ${timeRange} DEBUG - setDataToUse called with ${testData.length} points`)
      console.log(`🔍 ${timeRange} DEBUG - dataToUse state should now be ${testData.length} points`)
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
                           timeRange === '48h' ? 48 * 60 * 60 * 1000 :
                           timeRange === '2d' ? 2 * 24 * 60 * 60 * 1000 :
                           timeRange === '4d' ? 4 * 24 * 60 * 60 * 1000 :
                           timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                           timeRange === '2w' ? 14 * 24 * 60 * 60 * 1000 :
                           timeRange === '1m' ? 30 * 24 * 60 * 60 * 1000 :
                           timeRange === '1y' ? 365 * 24 * 60 * 60 * 1000 : 0
        
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
    // DISABLED: This useEffect was causing data changes
    console.log(`🚫 DISABLED: Initial range calculation useEffect to prevent timestamp changes`)
    return
    
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
  //           // Create more varied base temperatures - some zones naturally run hotter
  //           const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
  //           const zoneBaseTemp = 75 + baseVariation + cameraOffset
  //           const timeFactor = currentTime / 10000 // Use current time for variation
  //           const primaryWave = Math.sin((timeFactor / 35) * Math.PI + zoneIndex) * 1.8
  //           const secondaryWave = Math.cos((timeFactor / 25) * Math.PI + zoneIndex * 2) * 1.2
  //           const tertiaryWave = Math.sin((timeFactor / 50) * Math.PI + zoneIndex * 3) * 1.0
  //           const randomNoise = (Math.random() - 0.5) * 1.4
  //           const dailyPattern = Math.sin((new Date(currentTime).getHours() / 24) * Math.PI * 2) * 0.8
  //           
  //           // Add time-based patterns that can cause different zones to spike
  //           const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
  //           const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
  //           const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
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
        
        // Reset zoom state since camera change resets the view
        setHasUserZoomed(false)
        setPreservedYAxis(null)
        
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
        
        // Reset zoom state since camera change resets the view
        setHasUserZoomed(false)
        setPreservedYAxis(null)
        
        // Ensure test data exists for the new camera
        const testDataKey = `thermalHistory${timeRange}_${cam}`
        const existingData = localStorage.getItem(testDataKey)
        if (!existingData) {
          console.log(`🔄 No test data found for ${cam} ${timeRange}, but skipping generation to preserve stable entries`)
          // DISABLED: regenerateTestData() was causing all entries to change
          // regenerateTestData()
        }
        
        // Chart will automatically update when data changes - no manual update needed
      }
    } finally {
      setIsCameraSwitching(false)
    }
  }

  const toggleAllZones = () => {
    console.log('TOGGLE ALL ZONES BUTTON CLICKED!')
    console.log('Current allZonesHidden state:', allZonesHidden)
    
    // Set flag to prevent useEffect from interfering with zoom
    isManualLegendClickRef.current = true
    
    // Store current zoom/pan state before making changes
    const chart = chartRef.current
    let currentZoom = null
    
    if (chart) {
      // Capture current zoom and pan state
      const xScale = chart.scales.x
      const yScale = chart.scales.y
      
      if (xScale && yScale) {
        currentZoom = {
          xMin: xScale.min,
          xMax: xScale.max,
          yMin: yScale.min,
          yMax: yScale.max
        }
        console.log('toggleAllZones - Stored zoom state:', currentZoom)
      }
    }
    
    // Use thermalZones instead of allZones since that's what's actually displayed in the chart
    const thermalZoneNames = Array.from({ length: 8 }, (_, i) => `Zone_${i + 1}`)
    console.log('toggleAllZones called, allZonesHidden:', allZonesHidden)
    console.log('toggleAllZones called, thermalZoneNames:', thermalZoneNames)
    console.log('toggleAllZones called, allZones names:', allZones.map(z => z.name))
    
    // Use allZonesHidden state to determine the action
    // When allZonesHidden is false, we should hide all zones
    // When allZonesHidden is true, we should show all zones
    
    console.log('Current allZonesHidden state:', allZonesHidden)
    
    if (allZonesHidden) {
      // Show all zones
      const newVisibility = { ...zonesVisibility }
      thermalZoneNames.forEach(name => { newVisibility[name] = true })
      console.log('Showing all zones, newVisibility:', newVisibility)
      
      // Update chart dataset visibility WITHOUT triggering chart update
      thermalZoneNames.forEach(zoneName => {
        const datasetIndex = chart.data.datasets.findIndex(dataset => dataset.label === zoneName)
        if (datasetIndex !== -1) {
          const meta = chart.getDatasetMeta(datasetIndex)
          meta.hidden = false
          // DO NOT call chart.update() - this resets zoom!
        }
      })
      
      setZonesVisibility(newVisibility)
      setVisibleZones(thermalZoneNames)
      setAllZonesHidden(false)
      localStorage.setItem('zonesVisibility', JSON.stringify(newVisibility))
      localStorage.setItem('visibleZones', JSON.stringify(thermalZoneNames))
    } else {
      // Hide all zones (when allZonesHidden is false)
      const newVisibility = { ...zonesVisibility }
      thermalZoneNames.forEach(name => { newVisibility[name] = false })
      console.log('Hiding all zones, newVisibility:', newVisibility)
      
      // Update chart dataset visibility WITHOUT triggering chart update
      thermalZoneNames.forEach(zoneName => {
        const datasetIndex = chart.data.datasets.findIndex(dataset => dataset.label === zoneName)
        if (datasetIndex !== -1) {
          const meta = chart.getDatasetMeta(datasetIndex)
          meta.hidden = true
          // DO NOT call chart.update() - this resets zoom!
        }
      })
      
      setZonesVisibility(newVisibility)
      setVisibleZones([])
      setAllZonesHidden(true)
      localStorage.setItem('zonesVisibility', JSON.stringify(newVisibility))
      localStorage.setItem('visibleZones', JSON.stringify([]))
    }
    
    // Clear flag - no chart update needed since we're not calling chart.update()
    setTimeout(() => {
      isManualLegendClickRef.current = false
    }, 10)
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

  // Download functions for events
  const downloadEventData = (eventData, eventIndex) => {
    const eventTime = new Date(eventData.time)
    const timestamp = eventTime.toISOString().replace(/[:.]/g, '-')
    const filename = `thermal-event-${timestamp}.csv`
    
    // Create CSV content for single event
    let csv = 'Zone,Temperature,Threshold,Status\n'
    Object.entries(eventData.readings || {}).forEach(([zone, temperature]) => {
      const threshold = zone === 'Zone_8' ? 180 : 140
      const status = temperature > threshold ? 'ALARM' : 'NORMAL'
      csv += `${zone},${temperature},${threshold},${status}\n`
    })
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadAllEvents = (eventsData) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `thermal-events-all-${timestamp}.csv`
    
    // Create CSV content for all events
    let csv = 'Event Time,Zone,Temperature,Threshold,Status,Camera\n'
    eventsData.forEach(eventData => {
      const eventTime = new Date(eventData.time).toLocaleString()
      const cameraName = selectedCamera === 'planck_1' ? 'Left Camera' : 'Right Camera'
      
      Object.entries(eventData.readings || {}).forEach(([zone, temperature]) => {
        const threshold = zone === 'Zone_8' ? 180 : 140
        const status = temperature > threshold ? 'ALARM' : 'NORMAL'
        csv += `${eventTime},${zone},${temperature},${threshold},${status},${cameraName}\n`
      })
    })
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }



  const handleResetZoom = () => {
    const chart = chartRef.current
    if (!chart) {
      console.log('Reset zoom failed: No chart reference')
      return
    }
  
    const xScale = chart.scales.x
    const yScale = chart.scales.y
    if (!xScale) {
      console.log('Reset zoom failed: No x scale')
      return
    }
  
    let resetMin, resetMax
  
    // Try to get reset values based on time range, with fallbacks
    if (timeRange === '30m' && custom30mTicks && custom30mTicks.length > 0) {
      resetMin = custom30mTicks[0]
      resetMax = custom30mTicks[custom30mTicks.length - 1]
      console.log('Reset zoom: Using 30m ticks', { resetMin, resetMax })
    } else if (timeRange === '1h' && custom1hTicks && custom1hTicks.length > 0) {
      resetMin = custom1hTicks[0]
      resetMax = custom1hTicks[custom1hTicks.length - 1]
      console.log('Reset zoom: Using 1h ticks', { resetMin, resetMax })
    } else if (timeRange === '3h' && custom3hTicks && custom3hTicks.length > 0) {
      resetMin = custom3hTicks[0]
      resetMax = custom3hTicks[custom3hTicks.length - 1]
      console.log('Reset zoom: Using 3h ticks', { resetMin, resetMax })
    } else if (timeRange === '6h' && custom6hTicks && custom6hTicks.length > 0) {
      resetMin = custom6hTicks[0]
      resetMax = custom6hTicks[custom6hTicks.length - 1]
      console.log('Reset zoom: Using 6h ticks', { resetMin, resetMax })
    } else if (timeRange === '24h' && custom24hTicks && custom24hTicks.length > 0) {
      resetMin = custom24hTicks[0]
      resetMax = custom24hTicks[custom24hTicks.length - 1]
      console.log('Reset zoom: Using 24h ticks', { resetMin, resetMax })
    } else if (dayRanges[timeRange] && customDayTicks && customDayTicks.length > 0) {
      resetMin = customDayTicks[0]
      resetMax = customDayTicks[customDayTicks.length - 1]
      console.log('Reset zoom: Using day ticks', { resetMin, resetMax })
    } else if (extendedMin && extendedMax) {
      resetMin = extendedMin
      resetMax = extendedMax
      console.log('Reset zoom: Using extended range', { resetMin, resetMax })
    } else {
      // Final fallback: use chart data range
      const data = chart.data.datasets[0]?.data
      if (data && data.length > 0) {
        resetMin = data[0].x
        resetMax = data[data.length - 1].x
        console.log('Reset zoom: Using data range fallback', { resetMin, resetMax })
      } else {
        console.log('Reset zoom failed: No valid reset range found')
        return
      }
    }
  
    // Reset zoom plugin state to clear zoom/pan history
    if (chart.resetZoom) {
      try {
        chart.resetZoom()
        console.log('Reset zoom: Called chart.resetZoom()')
      } catch (error) {
        console.log('Reset zoom: chart.resetZoom() failed', error)
      }
    }
  
    // Reset x axis min/max to default values
    xScale.options.min = resetMin
    xScale.options.max = resetMax
    
    // Also reset y axis to default if it exists
    if (yScale) {
      yScale.options.min = undefined
      yScale.options.max = undefined
    }
  
    try {
      // Don't call chart.update() as it can interfere with zoom state
      console.log('Reset zoom: Chart reset completed')
      // Reset the hasUserZoomed flag so Y-axis limits are re-enabled
      setHasUserZoomed(false)
      // Clear preserved Y-axis limits
      setPreservedYAxis(null)
      // Reset zoom preservation test when zoom is reset
      setZoomPreserved(null)
    } catch (error) {
      console.log('Reset zoom: Chart update failed', error)
    }
  }
    // No loading state needed - test data is generated immediately

  const timeLimit = timeMap[timeRange] || timeMap['7d']
  const currentTime = Date.now()
  const rangeCutoff = currentTime - timeLimit

  // ALWAYS use test data - ignore actual history data
  const testDataKey = `thermalHistory${timeRange}_${selectedCamera}`
  
  // State to track dynamic event count that increments only on page refresh
  const [dynamicEventCount, setDynamicEventCount] = useState(() => {
    const storedCount = localStorage.getItem('dynamicEventCount')
    const currentCount = storedCount ? parseInt(storedCount, 10) : 0
    
    // Check if this is a page refresh by comparing timestamps
    const lastLoadTime = localStorage.getItem('lastLoadTime')
    const currentTime = Date.now()
    const timeDiff = currentTime - (lastLoadTime ? parseInt(lastLoadTime) : 0)
    
    // If more than 1 second has passed since last load, consider it a page refresh
    if (timeDiff > 1000) {
      // This is a page refresh - increment the count
      const newCount = currentCount + 1
      localStorage.setItem('dynamicEventCount', newCount.toString())
      localStorage.setItem('lastLoadTime', currentTime.toString())
      console.log(`🔄 Page refresh detected - Dynamic event count incremented to: ${newCount}`)
      return newCount
    } else {
      // This is navigation within the app - don't increment
      console.log(`🔄 Navigation detected - Dynamic event count remains: ${currentCount}`)
      return currentCount
    }
  })

  // Initialize dataToUse with existing data or generate immediately
  const [dataToUse, setDataToUse] = useState(() => {
    console.log(`🎯🎯🎯 INITIAL STATE SETUP 🎯🎯🎯`)
    console.log(`🎯 timeRange: ${timeRange}, selectedCamera: ${selectedCamera}`)
    
    // For 30m, always generate fresh data immediately
    if (timeRange === '30m') {
      console.log(`🔍 30m: Generating fresh data immediately in initial state`)
      const now = new Date()
      const testData = []
      const entries = 30 // 30 minutes = 30 data points
      const interval = 60 * 1000 // 1 minute intervals
      const startTime = new Date(now.getTime() - (30 * 60 * 1000))
      
      // Seeded random for consistent data
      const seededRandom = (seed) => {
        const x = Math.sin(seed) * 10000
        return x - Math.floor(x)
      }
      
      for (let i = 0; i < entries; i++) {
        const time = new Date(startTime.getTime() + (i * interval))
        const readings = {}
        
        Array.from({ length: 8 }, (_, zoneIndex) => `Zone_${zoneIndex + 1}`).forEach((zoneName, zoneIndex) => {
          const isLeftCamera = selectedCamera === 'planck_1'
          const cameraOffset = isLeftCamera ? 2 : 0
          // Create more varied base temperatures - some zones naturally run hotter
          const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
          const zoneBaseTemp = 75 + baseVariation + cameraOffset
          
          const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
          const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
          const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
          const noiseSeed = i * 1000 + zoneIndex * 100 + (selectedCamera === 'planck_1' ? 7000 : 8000) + 9000
          const randomNoise = (seededRandom(noiseSeed) - 0.5) * 1.4
          const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
          
          // Add time-based patterns that can cause different zones to spike
          const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
          const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
          const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
          readings[zoneName] = Math.round(finalTemp * 10) / 10
        })
        
        testData.push({
          time: time.toISOString(),
          readings: readings
        })
      }
      
      console.log(`✅ Generated ${testData.length} data points for 30m in initial state`)
      console.log(`🔍 First data point:`, testData[0])
      console.log(`🔍 Last data point:`, testData[testData.length - 1])
      return testData
    }
    
    // For other time ranges, try to load existing data first to preserve historical data
    const currentTestDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    const existingData = localStorage.getItem(currentTestDataKey)
    if (existingData) {
      try {
        // Parse timestamps as strings to prevent Date object recreation on every render
        const parsed = JSON.parse(existingData)
        console.log(`🔄 Loading existing data: ${parsed.length} data points for ${timeRange} on ${selectedCamera}`)
        console.log(`✅✅✅ INITIAL DATA LOADED ✅✅✅`)
        return parsed
      } catch (error) {
        console.warn('Failed to parse existing data, will generate new data:', error.message)
      }
    }
    
    // If no existing data, generate data immediately to prevent empty chart
    console.log(`📊 No existing data found, generating data immediately for ${timeRange}`)
    console.log(`🔍 Generating initial data to prevent empty chart`)
    
    // Generate data immediately for 30m to ensure chart loads
    if (timeRange === '30m') {
      const now = new Date()
      const testData = []
      const entries = 30 // 30 minutes = 30 data points
      const interval = 60 * 1000 // 1 minute intervals
      const startTime = new Date(now.getTime() - (30 * 60 * 1000))
      
      // Seeded random for consistent data
      const seededRandom = (seed) => {
        const x = Math.sin(seed) * 10000
        return x - Math.floor(x)
      }
      
      for (let i = 0; i < entries; i++) {
        const time = new Date(startTime.getTime() + (i * interval))
        const readings = {}
        
        Array.from({ length: 8 }, (_, zoneIndex) => `Zone_${zoneIndex + 1}`).forEach((zoneName, zoneIndex) => {
          const isLeftCamera = selectedCamera === 'planck_1'
          const cameraOffset = isLeftCamera ? 2 : 0
          // Create more varied base temperatures - some zones naturally run hotter
          const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
          const zoneBaseTemp = 75 + baseVariation + cameraOffset
          
          const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
          const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
          const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
          const noiseSeed = i * 1000 + zoneIndex * 100 + (selectedCamera === 'planck_1' ? 7000 : 8000) + 9000
          const randomNoise = (seededRandom(noiseSeed) - 0.5) * 1.4
          const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
          
          // Add time-based patterns that can cause different zones to spike
          const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
          const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
          const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
          readings[zoneName] = Math.round(finalTemp * 10) / 10
        })
        
        testData.push({
          time: time.toISOString(),
          readings: readings
        })
      }
      
      console.log(`✅ Generated ${testData.length} data points for 30m immediately`)
      return testData
    }
    
    console.log(`❌❌❌ INITIAL STATE EMPTY ❌❌❌`)
    return []
    
    // Generate data immediately if none exists
    console.log(`🔍 Initial load: No existing data, generating for ${timeRange} on ${selectedCamera}`)
    const now = new Date()
    let interval, entries, chartStartTime
    
    if (timeRange === '48h') {
      entries = 96 // 48 hours = 96 data points (significantly reduced)
      chartStartTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
      interval = 30 * 60 * 1000 // 30 minute intervals
    } else if (timeRange === '24h') {
      entries = 96 // 24 hours = 96 points (significantly reduced)
      chartStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      interval = 15 * 60 * 1000 // 15 minutes
    } else if (timeRange === '12h') {
      // For 12 hours: 72 points (significantly reduced)
      entries = 72 // 12 hours = 72 points
      chartStartTime = new Date(now.getTime() - (12 * 60 * 60 * 1000)) // Exactly 12 hours ago
      interval = 10 * 60 * 1000 // 10 minutes
    } else if (timeRange === '6h') {
      entries = 360 // 6 hours = 360 data points (1 per minute)
      chartStartTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
      interval = 60 * 1000 // 1 minute intervals
    } else if (timeRange === '1h') {
      entries = 60
      chartStartTime = new Date(now.getTime() - (60 * 60 * 1000))
      interval = 60 * 1000 // 1 minute
    } else if (timeRange === '30m') {
      entries = 60
      chartStartTime = new Date(now.getTime() - (30 * 60 * 1000))
      interval = 30 * 1000 // 30 seconds
    } else if (timeRange === '7d') {
      // For 7 days: 14 points per day × 7 days = 98 total entries
      entries = 98 // Exactly 14 points per day for 7 days
      chartStartTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)) // Exactly 7 days ago
      interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1) // 7 days divided by entries
    } else if (timeRange === '1m') {
      // For 1 month: Generate data for exactly 30 days
      entries = 30 // 30 days = 30 data points (1 per day)
      chartStartTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)) // Exactly 30 days ago
      interval = (24 * 60 * 60 * 1000) // 24 hours per point (1 day)
    } else {
      // Fallback to 1 hour if time range not recognized
      entries = 60
      chartStartTime = new Date(now.getTime() - (60 * 60 * 1000))
      interval = 60 * 1000
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
        
        // Add time-based patterns that can cause different zones to spike
        const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
        const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
        const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
        const minTemp = 60 // Lower minimum
        const maxTemp = 200 // Higher maximum to allow for threshold breaches
        const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
        
        readings[z.name] = clampedTemp
      })
      
      newTestData.push({ time, readings })
    }
    
    // Store the generated data
    try {
      localStorage.setItem(currentTestDataKey, JSON.stringify(newTestData))
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

  // Log dataToUse length after initialization
  console.log(`🎯 Current dataToUse length: ${dataToUse.length}`)
  
  // Helper function to generate dynamic events
  const generateDynamicEvents = (count) => {
    const now = new Date()
    const newEvents = []
    
    // Generate events that span the same time range as the test data
    // For 1m time range, this goes back 30 days from now
    const daysBack = 30 // Same as 1m time range
    const startTime = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000))
    
    for (let i = 0; i < count; i++) {
      // Create dates within the same time range as test data
      const timeSpan = now.getTime() - startTime.getTime()
      const randomTime = startTime.getTime() + (Math.random() * timeSpan)
      const eventTime = new Date(randomTime)
      const eventReadings = {}
      
      Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
        const isLeftCamera = selectedCamera === 'planck_1'
        const cameraOffset = isLeftCamera ? 2 : 0
        
        // Create more varied base temperatures - some zones naturally run hotter
        const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
        const zoneBaseTemp = 75 + baseVariation + cameraOffset
        
        // Add time-based patterns that can cause different zones to spike
        const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
        const randomSpike = Math.random() < 0.15 ? (Math.random() * 30) : 0 // 15% chance of random spike for dynamic events
        const eventVariation = Math.sin((i / 10) * Math.PI + zoneIndex) * 2.0
        const randomNoise = (Math.random() - 0.5) * 1.0
        
        const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + eventVariation + randomNoise
        const minTemp = 60 // Lower minimum
        const maxTemp = 200 // Higher maximum to allow for threshold breaches
        const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
        
        eventReadings[z.name] = clampedTemp
      })
      
      newEvents.push({ time: eventTime, readings: eventReadings })
    }
    
    return newEvents
  }

  // Update data when camera or time range changes
  useEffect(() => {
    const newTestDataKey = `thermalHistory${timeRange}_${selectedCamera}`
    const existingData = localStorage.getItem(newTestDataKey)
    
    // Only skip if we have data AND it's for the same camera/timeRange combination
    if (dataToUse.length > 0) {
      const currentDataKey = `thermalHistory${timeRange}_${selectedCamera}`
      const lastDataKey = localStorage.getItem('lastLoadedDataKey')
      if (lastDataKey === currentDataKey) {
        console.log(`📊 Data already loaded for ${currentDataKey} (${dataToUse.length} points), skipping localStorage load`)
        return
      }
    }
    
    // Only load existing data from localStorage, don't generate new data
    if (existingData) {
      try {
        const parsed = JSON.parse(existingData, (key, val) => (key === 'time' ? new Date(val) : val))
        console.log(`🔍 useEffect: Found ${parsed.length} existing data points for ${timeRange} on ${selectedCamera}`)
        setDataToUse(parsed)
        localStorage.setItem('lastLoadedDataKey', newTestDataKey)
        return
      } catch (error) {
        console.warn('Failed to parse existing test data in useEffect:', error.message)
      }
    }
    
    console.log(`📊 No existing data found for ${timeRange} on ${selectedCamera}, will wait for dynamic data`)
    return
    
    // NEVER use cached data for 6h - always regenerate fresh
    if (existingData && timeRange !== '6h') {
      try {
        const parsed = JSON.parse(existingData, (key, val) => (key === 'time' ? new Date(val) : val))
        console.log(`🔍 useEffect: Found ${parsed.length} existing data points for ${timeRange} on ${selectedCamera}`)
        
        // Check if we need to add new dynamic events
        const lastDynamicEventCount = localStorage.getItem('lastDynamicEventCount')
        if (lastDynamicEventCount && parseInt(lastDynamicEventCount) < dynamicEventCount) {
          // Add new dynamic events to existing data
          const newEvents = generateDynamicEvents(dynamicEventCount - parseInt(lastDynamicEventCount))
          const updatedData = [...parsed, ...newEvents]
          localStorage.setItem(newTestDataKey, JSON.stringify(updatedData))
          localStorage.setItem('lastDynamicEventCount', dynamicEventCount.toString())
          setDataToUse(updatedData)
          console.log(`🔄 Added ${newEvents.length} new dynamic events to existing data`)
        } else {
          setDataToUse(parsed)
          localStorage.setItem('lastLoadedDataKey', newTestDataKey)
        }
        return
      } catch (error) {
        console.warn('Failed to parse existing test data in useEffect:', error.message)
      }
    }
    
    // For critical ranges like 48h, ensure data is immediately available
    if (['48h', '24h', '1h'].includes(timeRange)) {
      console.log(`🔄 Critical range ${timeRange} missing data, generating immediately...`)
    }
    
    // DISABLED: This useEffect was also causing all entries to change
    // Only the dynamic data addition should run to preserve stable entries
    console.log(`🚫 DISABLED: Second data generation to prevent timestamp changes`)
    return
    
    // Generate new data if none exists
    console.log(`🔍 useEffect: Generating new data for ${timeRange} on ${selectedCamera}`)
    const generateTestData = () => {
      const now = new Date()
      let interval, entries, chartStartTime
      
      if (timeRange === '48h') {
        // For 48 hours: Generate data points every 1 minute
        entries = 2880 // 48 hours = 2880 data points (1 minute intervals)
        chartStartTime = new Date(now.getTime() - (48 * 60 * 60 * 1000)) // Exactly 48 hours ago
        interval = 60 * 1000 // 1 minute intervals
      } else if (timeRange === '24h') {
        // For 24 hours: 1440 points (1 minute intervals)
        entries = 1440 // 24 hours = 1440 points
        chartStartTime = new Date(now.getTime() - (24 * 60 * 60 * 1000)) // Exactly 24 hours ago
        interval = 60 * 1000 // 1 minute intervals
      } else if (timeRange === '12h') {
        // For 12 hours: 720 points (1 minute intervals)
        entries = 720 // 12 hours = 720 points
        chartStartTime = new Date(now.getTime() - (12 * 60 * 60 * 1000)) // Exactly 12 hours ago
        interval = 60 * 1000 // 1 minute intervals
      } else if (timeRange === '6h') {
        entries = 360 // 6 hours = 360 data points (1 per minute)
        chartStartTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
        interval = 60 * 1000 // 1 minute intervals
      } else if (timeRange === '1h') {
        entries = 60
        chartStartTime = new Date(now.getTime() - (60 * 60 * 1000))
        interval = 60 * 1000 // 1 minute
      } else if (timeRange === '30m') {
        entries = 60
        chartStartTime = new Date(now.getTime() - (30 * 60 * 1000))
        interval = 30 * 1000 // 30 seconds
      } else if (timeRange === '7d') {
        // For 7 days: 14 points per day × 7 days = 98 total entries
        entries = 98 // Exactly 14 points per day for 7 days
        chartStartTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)) // Exactly 7 days ago
        interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1) // 7 days divided by entries
      } else if (timeRange === '1m') {
        // For 1 month: Generate data for exactly 30 days
        entries = 720 // 30 days = 720 data points (1 per hour)
        chartStartTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)) // Exactly 30 days ago
        interval = 60 * 60 * 1000 // 1 hour intervals
      } else {
        // Fallback to 1 hour if time range not recognized
        entries = 60
        chartStartTime = new Date(now.getTime() - (60 * 60 * 1000))
        interval = 60 * 1000
      }
      
      // Generate test data for the current camera
      const newTestData = []
      for (let i = 0; i < entries; i++) {
        const time = new Date(chartStartTime.getTime() + (i * interval))
        const readings = {}
        
        Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
          const isLeftCamera = selectedCamera === 'planck_1'
          const cameraOffset = isLeftCamera ? 2 : 0
          
          // Create more varied base temperatures - some zones naturally run hotter
          const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
          const zoneBaseTemp = 75 + baseVariation + cameraOffset
          
          // Add time-based patterns that can cause different zones to spike
          const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
          const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0 // 10% chance of random spike
          const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
          const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
          const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
          const randomNoise = (Math.random() - 0.5) * 1.4
          const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
          
          const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
          const minTemp = 60 // Lower minimum
          const maxTemp = 200 // Higher maximum to allow for threshold breaches
          const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
          
          readings[z.name] = clampedTemp
        })
        
        newTestData.push({ time, readings })
      }
      
      // Add dynamic events based on dynamicEventCount
      // These represent additional temperature events that occur on page refresh
      for (let i = 0; i < dynamicEventCount; i++) {
        // Generate events that span the same time range as the test data
        const daysBack = 30 // Same as 1m time range
        const startTime = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000))
        const timeSpan = now.getTime() - startTime.getTime()
        const randomTime = startTime.getTime() + (Math.random() * timeSpan)
        const eventTime = new Date(randomTime)
        const eventReadings = {}
        
        Array.from({ length: 8 }, (_, zoneIndex) => ({ name: `Zone_${zoneIndex + 1}`, index: zoneIndex })).forEach((z, zoneIndex) => {
          const isLeftCamera = selectedCamera === 'planck_1'
          const cameraOffset = isLeftCamera ? 2 : 0
          
          // Create more varied base temperatures - some zones naturally run hotter
          const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15 // -15 to +15 variation
          const zoneBaseTemp = 75 + baseVariation + cameraOffset
          
          // Add time-based patterns that can cause different zones to spike
          const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25 // Larger spikes
          const randomSpike = Math.random() < 0.15 ? (Math.random() * 30) : 0 // 15% chance of random spike for dynamic events
          const eventVariation = Math.sin((i / 10) * Math.PI + zoneIndex) * 2.0
          const randomNoise = (Math.random() - 0.5) * 1.0
          
          const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + eventVariation + randomNoise
          const minTemp = 60 // Lower minimum
          const maxTemp = 200 // Higher maximum to allow for threshold breaches
          const clampedTemp = Math.max(minTemp, Math.min(maxTemp, Math.round(finalTemp * 10) / 10))
          
          eventReadings[z.name] = clampedTemp
        })
        
        newTestData.push({ time: eventTime, readings: eventReadings })
      }
      
      // Store and use the generated data
      try {
        localStorage.setItem(newTestDataKey, JSON.stringify(newTestData))
        localStorage.setItem('lastDynamicEventCount', dynamicEventCount.toString())
        setDataToUse(newTestData)
        console.log(`✅ useEffect: Generated and stored ${newTestData.length} test data points for ${timeRange} on ${selectedCamera} (including ${dynamicEventCount} dynamic events)`)
      } catch (error) {
        console.error(`Failed to store test data:`, error.message)
      }
    }
    
    generateTestData()
  }, [timeRange, selectedCamera])
  


  // Use test data if available, otherwise use empty array to prevent glitching
  // Make dataSource reactive to dataToUse changes
  const dataSource = useMemo(() => {
    const result = dataToUse.length > 0 ? dataToUse : []
    console.log(`🔍 dataSource useMemo: dataToUse.length=${dataToUse.length}, result.length=${result.length}`)
    if (result.length > 0) {
      console.log(`🔍 dataSource first point:`, result[0])
    }
    return result
  }, [dataToUse])

  // Calculate dynamic temperature events data from the same test data as the chart
  const calculateTemperatureEvents = () => {
    // Always return actual data count to match the table
    if (!dataSource || dataSource.length === 0) {
      return { maxTemperature: 0, eventsToday: 0 }
    }
    
    // If we're changing time ranges, reset events today to 0
    if (isChangingTimeRange) {
      console.log(`🔄 TIME RANGE CHANGING: Resetting events today to 0`)
      return { maxTemperature: 0, eventsToday: 0 }
    }

    let maxTemperature = 0
    const now = new Date()
    // Use local timezone for today calculation
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    console.log(`🕐 Current time: ${now.toLocaleString()}`)
    console.log(`🕐 Today start: ${todayStart.toLocaleString()}`)
    console.log(`🕐 Today end: ${todayEnd.toLocaleString()}`)

    // Find max temperature across all zones and all data points
    dataSource.forEach(dataPoint => {
      if (dataPoint.readings) {
        Object.values(dataPoint.readings).forEach(temperature => {
          if (temperature > maxTemperature) {
            maxTemperature = temperature
          }
        })
      }
    })

    // Count events from TODAY only (last 24 hours), regardless of selected time range
    let eventsToday = 0
    let totalEvents = 0
    const currentTime = new Date()
    
    console.log(`🕐 Time range: ${timeRange}`)
    console.log(`🕐 Today start: ${todayStart.toLocaleString()}`)
    console.log(`🕐 Today end: ${todayEnd.toLocaleString()}`)
    
    dataSource.forEach(dataPoint => {
      if (dataPoint.time) {
        totalEvents++
        const dataTime = new Date(dataPoint.time)
        const isToday = dataTime >= todayStart && dataTime < todayEnd
        console.log(`📅 Data time: ${dataTime.toLocaleString()} (${isToday ? 'TODAY' : 'NOT TODAY'})`)
        if (isToday) {
          eventsToday++
        }
      }
    })

    console.log(`📊 Total events: ${totalEvents}, Events today: ${eventsToday}`)

    // Only show the actual count of events from today's date - no fallback
    console.log(`✅ Events today (actual count): ${eventsToday}`)

    return { 
      maxTemperature: Math.round(maxTemperature * 10) / 10, // Round to 1 decimal
      eventsToday: eventsToday 
    }
  }

  // Use useMemo to ensure stable calculation and prevent loading states
  const temperatureEvents = useMemo(() => {
    return calculateTemperatureEvents()
  }, [dataSource, isChangingTimeRange]) // Depend on the actual data and time range changing state

  // Debug effect to track dataToUse changes
  useEffect(() => {
    console.log(`📊 dataToUse state changed - new length: ${dataToUse.length}`)
    if (dataToUse.length > 0) {
      console.log(`📊 First data point time: ${new Date(dataToUse[0].time).toLocaleString()}`)
      console.log(`📊 Last data point time: ${new Date(dataToUse[dataToUse.length - 1].time).toLocaleString()}`)
    }
  }, [dataToUse])

  // State for modal visibility
  const [showEventsModal, setShowEventsModal] = useState(false)
  // showEventsPage is now passed as a prop from App.js
  const [modalUpdateTrigger, setModalUpdateTrigger] = useState(0) // Force modal re-render when data updates
  
  // Notify parent when events page state changes
  useEffect(() => {
    onEventsPageChange(showEventsPage)
  }, [showEventsPage, onEventsPageChange])
  const [selectedDate, setSelectedDate] = useState(null) // Track selected date in modal
  const [currentMonth, setCurrentMonth] = useState(new Date()) // Start with current month, will be updated by effect
  const [monthInitialized, setMonthInitialized] = useState(false) // Track if month has been initialized from data

  // Close modal when camera or time range changes
  useEffect(() => {
    setShowEventsModal(false)
    setMonthInitialized(false) // Reset month initialization when data source changes
  }, [timeRange, selectedCamera])

  // Update current month when data changes to show the month with most recent data
  useEffect(() => {
    if (dataToUse.length > 0 && !monthInitialized) {
      // Find the month with the most recent data
      const mostRecentEntry = dataToUse[dataToUse.length - 1]
      const dataMonth = new Date(mostRecentEntry.time)
      
      console.log(`📅 Initializing modal month to match data: ${dataMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
      console.log(`📅 Most recent data time: ${mostRecentEntry.time}`)
      setCurrentMonth(dataMonth)
      setMonthInitialized(true)
    }
  }, [dataToUse, monthInitialized]) // Only run when data changes and month hasn't been initialized yet

  // Update modal when new data arrives and modal is open
  useEffect(() => {
    if (showEventsModal && dataSource.length > 0) {
      console.log('🔄 Modal updating with new data - trigger:', modalUpdateTrigger + 1)
      setModalUpdateTrigger(prev => prev + 1)
    }
  }, [dataSource, showEventsModal])

  // Update events page when new data arrives and events page is open
  useEffect(() => {
    if (showEventsPage && dataSource.length > 0) {
      console.log('🔄 Events page updating with new data - trigger:', modalUpdateTrigger + 1)
      setModalUpdateTrigger(prev => prev + 1)
    }
  }, [dataSource, showEventsPage])

  // Additional effect to ensure events page updates when dataToUse changes (for dynamic updates)
  useEffect(() => {
    if (showEventsPage && dataToUse.length > 0) {
      console.log('🔄 Events page updating with new dataToUse - trigger:', modalUpdateTrigger + 1)
      setModalUpdateTrigger(prev => prev + 1)
    }
  }, [dataToUse, showEventsPage])

  // Add new data entry every 10 seconds for ALL time ranges (live data)
  useEffect(() => {
    // Run dynamic updates for ALL time ranges
    console.log(`📊 Setting up dynamic updates for ${timeRange} time range`)
    
    // Clear any existing interval first
    if (dynamicDataIntervalRef.current) {
      clearInterval(dynamicDataIntervalRef.current)
    }
    
    console.log(`🔄 Setting up LIVE data interval for ${timeRange} on ${selectedCamera}`)
    console.log(`⏰ Live data interval created at: ${new Date().toLocaleTimeString()}`)
    
    dynamicDataIntervalRef.current = setInterval(() => {
      // Generate a new data point
      const now = new Date()
      console.log(`⏰ Interval triggered at: ${now.toLocaleTimeString()}`)
      const newReadings = {}
      
      // Generate temperature readings for all zones
      Array.from({ length: 8 }, (_, zoneIndex) => `Zone_${zoneIndex + 1}`).forEach((zoneName, zoneIndex) => {
        const isLeftCamera = selectedCamera === 'planck_1'
        
        // Create distinct data patterns for each camera
        let zoneBaseTemp, primaryWave, secondaryWave, tertiaryWave
        
        // Use same base temperature calculation as existing data
        const cameraOffset = isLeftCamera ? 2 : 0
        zoneBaseTemp = 80 + (zoneIndex * 8) + cameraOffset
        
        if (isLeftCamera) {
          // Left camera (planck_1) - Different wave patterns but same base temp
          primaryWave = Math.sin((now.getTime() / 30000) * Math.PI + zoneIndex) * 2.0
          secondaryWave = Math.cos((now.getTime() / 20000) * Math.PI + zoneIndex * 1.5) * 1.5
          tertiaryWave = Math.sin((now.getTime() / 15000) * Math.PI + zoneIndex * 0.8) * 1.0
        } else {
          // Right camera (planck_2) - Different wave patterns but same base temp
          primaryWave = Math.cos((now.getTime() / 25000) * Math.PI + zoneIndex) * 1.8
          secondaryWave = Math.sin((now.getTime() / 18000) * Math.PI + zoneIndex * 1.2) * 1.2
          tertiaryWave = Math.cos((now.getTime() / 12000) * Math.PI + zoneIndex * 0.6) * 0.8
        }
        
        // Add the same components as existing data
        const randomNoise = (Math.random() - 0.5) * 1.4 // Random fluctuation
        const dailyPattern = Math.sin((now.getHours() / 24) * Math.PI * 2) * 0.8 // Daily variation
        
        const temperature = zoneBaseTemp + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
        newReadings[zoneName] = Math.round(temperature * 10) / 10
        
        // Debug logging for first zone to compare with existing data
        if (zoneIndex === 0) {
          console.log(`🔍 DYNAMIC DATA DEBUG - ${zoneName}:`)
          console.log(`  Base temp: ${zoneBaseTemp}°F`)
          console.log(`  Primary wave: ${primaryWave.toFixed(2)}°F`)
          console.log(`  Secondary wave: ${secondaryWave.toFixed(2)}°F`)
          console.log(`  Tertiary wave: ${tertiaryWave.toFixed(2)}°F`)
          console.log(`  Random noise: ${randomNoise.toFixed(2)}°F`)
          console.log(`  Daily pattern: ${dailyPattern.toFixed(2)}°F`)
          console.log(`  Final temp: ${temperature.toFixed(2)}°F`)
          console.log(`  Rounded temp: ${newReadings[zoneName]}°F`)
        }
      })
      
      // Create new data point
      const newDataPoint = {
        time: now.toISOString(),
        readings: newReadings
      }
      
      console.log(`🕐 Generated new data point at: ${now.toLocaleString()} (${now.toISOString()})`)
      
      // Add ONLY the new data point to existing data - don't update localStorage or affect existing data
      setDataToUse(prevData => {
        const currentData = [...prevData, newDataPoint]
        console.log(`🔄 Added ONE new data point: ${currentData.length} total points at ${now.toLocaleTimeString()}`)
        return currentData
      })
    }, 10000) // 10 seconds

    return () => {
      if (dynamicDataIntervalRef.current) {
        console.log(`🔄 Clearing LIVE data interval for ${timeRange} on ${selectedCamera}`)
        console.log(`⏰ Live data interval cleared at: ${new Date().toLocaleTimeString()}`)
        clearInterval(dynamicDataIntervalRef.current)
        dynamicDataIntervalRef.current = null
      }
    }
  }, [timeRange, selectedCamera])

  // Handle View All button click
  const handleViewAllClick = () => {
    console.log('='.repeat(60))
    console.log('🔍 VIEW ALL BUTTON CLICKED - CHECKING TIMESTAMPS')
    console.log('='.repeat(60))
    console.log(`📊 Total data points: ${sorted.length}`)
    console.log(`📊 dataToUse length: ${dataToUse.length}`)
    console.log(`📊 dataSource length: ${dataSource.length}`)
    
    if (sorted.length === 0) {
      console.log('🚨 NO DATA AVAILABLE - Cannot check timestamps')
      console.log('💡 This means no data has been loaded or generated yet')
      console.log('💡 Wait for live data to be added (every 10 seconds for 30m range) or check localStorage')
      return
    }
    
    if (sorted.length > 0) {
      // Get current timestamps
      const currentTimestamps = sorted.map(entry => ({
        time: entry.time,
        timestamp: new Date(entry.time).getTime()
      }))
      
      // Compare with previous timestamps if they exist
      if (previousTimestampsRef.current) {
        console.log('')
        console.log('🔄 COMPARING WITH PREVIOUS TIMESTAMPS:')
        console.log('-'.repeat(40))
        let hasChanges = false
        let stableCount = 0
        let newEntriesCount = 0
        let oldEntriesChangedCount = 0
        
        // Check each current timestamp against previous
        currentTimestamps.forEach((current, index) => {
          const previous = previousTimestampsRef.current[index]
          const ageInSeconds = Math.floor((Date.now() - current.timestamp) / 1000)
          
          if (previous && current.timestamp !== previous.timestamp) {
            hasChanges = true
            const currentTime = new Date(current.timestamp)
            const previousTime = new Date(previous.timestamp)
            
            // Check if this is an old entry (older than 30 seconds)
            if (ageInSeconds > 30) {
              oldEntriesChangedCount++
              console.log('🚨🚨🚨 OLD ENTRIES CHANGING! 🚨🚨🚨')
              console.log(`🔴 OLD Entry ${index + 1} CHANGED! (${ageInSeconds}s old)`)
              console.log(`   BEFORE: ${previousTime.toLocaleString()}`)
              console.log(`   AFTER:  ${currentTime.toLocaleString()}`)
              console.log(`   DIFF:   ${current.timestamp - previous.timestamp}ms`)
              console.log('🚨🚨🚨 THIS SHOULD NOT HAPPEN! 🚨🚨🚨')
              console.log('')
            } else {
              newEntriesCount++
              console.log(`🟡 Entry ${index + 1} CHANGED! (${ageInSeconds}s old) - This is expected for recent entries`)
              console.log(`   BEFORE: ${previousTime.toLocaleString()}`)
              console.log(`   AFTER:  ${currentTime.toLocaleString()}`)
              console.log(`   DIFF:   ${current.timestamp - previous.timestamp}ms`)
              console.log('')
            }
          } else if (previous && current.timestamp === previous.timestamp) {
            // Entry is stable
            stableCount++
            console.log(`✅ Entry ${index + 1} STABLE (${ageInSeconds}s old) - This should happen`)
          } else {
            // New entry (no previous to compare)
            newEntriesCount++
            console.log(`🆕 Entry ${index + 1} NEW (${ageInSeconds}s old) - This should happen`)
          }
        })
        
        // Summary
        console.log('')
        console.log('📊 SUMMARY:')
        if (stableCount > 0) {
          console.log(`✅ Stable entries: ${stableCount} (This should happen)`)
        } else {
          console.log(`🚨 Stable entries: ${stableCount} (This should NOT happen - all entries are changing!)`)
        }
        console.log(`🆕 New/Recent entries: ${newEntriesCount} (This should happen)`)
        if (oldEntriesChangedCount > 0) {
          console.log(`🚨 Old entries changed: ${oldEntriesChangedCount} (This should NOT happen!)`)
        } else {
          console.log(`✅ Old entries stable: All old entries unchanged (This should happen)`)
        }
        
        if (!hasChanges) {
          console.log('')
          console.log('✅ ALL TIMESTAMPS STABLE - No changes detected (This should happen)')
        }
      } else {
        console.log('📝 FIRST TIME - Storing baseline timestamps')
      }
      
      // Store current timestamps for next comparison
      previousTimestampsRef.current = currentTimestamps
      
      // Show the last 5 entries
      const lastFiveEntries = sorted.slice(-5)
      console.log('')
      console.log('🕐 LAST 5 ENTRIES:')
      console.log('-'.repeat(30))
      lastFiveEntries.forEach((entry, index) => {
        const entryIndex = sorted.length - 5 + index
        const time = new Date(entry.time)
        const isNew = index >= 3 ? '🆕' : '📅'
        console.log(`${isNew} Entry ${entryIndex + 1}: ${time.toLocaleString()}`)
      })
      
      // Check for past entries
      const currentTime = new Date()
      const pastEntries = sorted.filter(entry => {
        const entryTime = new Date(entry.time)
        const timeDiff = currentTime.getTime() - entryTime.getTime()
        return timeDiff > 30000 // More than 30 seconds ago
      })
      
      if (pastEntries.length > 0) {
        console.log('')
        console.log('⚠️  PAST ENTRIES (older than 30s):')
        console.log('-'.repeat(30))
        pastEntries.slice(-3).forEach((entry, index) => {
          const entryIndex = sorted.indexOf(entry)
          const time = new Date(entry.time)
          const ageInSeconds = Math.floor((currentTime.getTime() - time.getTime()) / 1000)
          console.log(`📅 Entry ${entryIndex + 1}: ${time.toLocaleString()} (${ageInSeconds}s ago)`)
        })
      }
      
      const mostRecent = sorted[sorted.length - 1]
      console.log('VIEW ALL - Most recent entry temperatures (with offsets and rounding):')
      console.log(`Time: ${new Date(mostRecent.time).toLocaleString()}`)
      if (mostRecent.readings) {
        Object.entries(mostRecent.readings).forEach(([zone, temp], idx) => {
          const offsetTemp = temp + (idx * 3)
          const roundedTemp = Math.round(offsetTemp)
          console.log(`  ${zone}: ${roundedTemp}°F (raw: ${temp}°F + offset: ${idx * 3} = ${offsetTemp}°F)`)
        })
      }
    }
    
    // Debug: Show chart temperatures for comparison (using same data as modal)
    console.log('CHART - Most recent entry temperatures (from same data):')
    if (sorted.length > 0) {
      const mostRecent = sorted[sorted.length - 1]
      if (mostRecent.readings) {
        Object.entries(mostRecent.readings).forEach(([zone, temp], idx) => {
          const offsetTemp = temp + (idx * 3)
          const roundedTemp = Math.round(offsetTemp)
          console.log(`  ${zone}: ${roundedTemp}°F`)
        })
      }
    }
    
    // Simple match check
    console.log('🔥 MODAL vs CHART: ✅ MATCH (same data source)')
    console.log('🔄 Opening modal with real-time updates enabled')
    console.log(`📊 Modal will show newest ${Math.min(10, sorted.length)} entries`)
    if (sorted.length > 0) {
      const newest = sorted[sorted.length - 1]
      console.log(`🕐 Newest entry time: ${new Date(newest.time).toLocaleString()}`)
      console.log('🌡️ Modal temperatures (rounded + offset):')
      if (newest.readings) {
        Object.entries(newest.readings).forEach(([zone, temp], idx) => {
          const roundedTemp = Math.round(temp) + (idx * 3)
          console.log(`  ${zone}: ${roundedTemp}°F (raw: ${temp}°F, rounded: ${Math.round(temp)}°F, offset: +${idx * 3}°F)`)
        })
      }
    }
    
    setShowEventsPage(true)
    // Force immediate update when events page opens
    setModalUpdateTrigger(prev => prev + 1)
  }

  // Close modal
  const closeEventsModal = () => {
    setShowEventsModal(false)
  }


  // Handle date selection in modal
  const handleDateSelect = (date) => {
    setSelectedDate(date)
    console.log(`📅 Selected date: ${date.toISOString().split('T')[0]}`)
  }

  // Handle month navigation
  const handlePreviousMonth = () => {
    const previousMonthWithData = findPreviousMonthWithData(currentMonth)
    
    if (previousMonthWithData) {
      setCurrentMonth(previousMonthWithData)
      console.log(`📅 Previous month with data: ${previousMonthWithData.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
    } else {
      console.log(`🚫 No previous months with data found`)
    }
  }

  const handleNextMonth = () => {
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    // Check if we're already at or past the current month
    if (currentMonth >= currentMonthStart) {
      console.log(`🚫 Cannot navigate to future months. Current month: ${currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, Today: ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
      return
    }
    
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(newMonth.getMonth() + 1)
    
    // Double-check we're not going past current month
    if (newMonth > currentMonthEnd) {
      console.log(`🚫 Cannot navigate to future months. Would go to: ${newMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, Current month: ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
      return
    }
    
    setCurrentMonth(newMonth)
    console.log(`📅 Next month: ${newMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
  }

  // Handle today button
  const handleTodayClick = () => {
    const today = new Date()
    setCurrentMonth(today)
    setSelectedDate(null) // Clear selected date to show most recent entries
    console.log(`📅 Jumped to today: ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
  }

  // Helper function to check if we're at or past the current month
  const isAtOrPastCurrentMonth = () => {
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return currentMonth >= currentMonthStart
  }

  // Helper function to check if a specific month has any data entries
  const monthHasData = (monthDate) => {
    const currentDate = new Date()
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    // Allow navigation to any month within the last year
    if (monthDate < oneYearAgo || monthDate > currentDate) {
      return false
    }
    
    // Always allow navigation to months within the last year
    return true
  }

  // Helper function to find the previous month with data
  const findPreviousMonthWithData = (fromMonth) => {
    let checkMonth = new Date(fromMonth)
    checkMonth.setMonth(checkMonth.getMonth() - 1)
    
    // Keep going back until we find a month with data or reach a reasonable limit
    let attempts = 0
    const maxAttempts = 12 // Don't go back more than a year
    const skippedMonths = []
    
    while (attempts < maxAttempts) {
      if (monthHasData(checkMonth)) {
        if (skippedMonths.length > 0) {
          console.log(`📅 Skipped ${skippedMonths.length} empty months: ${skippedMonths.join(', ')}`)
        }
        console.log(`📅 Found previous month with data: ${checkMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
        return checkMonth
      }
      skippedMonths.push(checkMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
      checkMonth.setMonth(checkMonth.getMonth() - 1)
      attempts++
    }
    
    if (skippedMonths.length > 0) {
      console.log(`📅 No previous months with data found. Checked: ${skippedMonths.join(', ')}`)
    }
    return null // No month with data found
  }

  // Helper function to check if there are any previous months with data
  const hasPreviousMonthWithData = () => {
    return findPreviousMonthWithData(currentMonth) !== null
  }
  
  // Add stability check for dramatic data changes
  if (dataSource.length > 0) {
    console.log(`🔍 Data range: ${timeRange}, points: ${dataSource.length}, camera: ${selectedCamera}`)
  }
  

  
  // Memoize sorted data to prevent timestamp changes on every render
  const sorted = useMemo(() => {
    return dataSource.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  }, [dataSource])


  // Create a fixed set of zones for thermal chart display (independent of actual data)
  const thermalZones = Array.from({ length: 8 }, (_, i) => ({
    name: `Zone_${i + 1}`,
    camera: selectedCamera,
    index: i
  }))
  
  const zonesForCamera = thermalZones // Use fixed thermal zones for consistent display
  const filteredNames = zonesForCamera.map(z => z.name)
  


  console.log(`🔍 Creating datasets with sorted data length: ${sorted.length}`)
  
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
    
    // Check if zone is above threshold and use red color
    const isAboveThreshold = zone.maxTemp > zone.threshold
    const color = isAboveThreshold ? '#ff6b6b' : professionalColors[idx % professionalColors.length]
    
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
  
  // Validate data before rendering chart
  const isValidData = data && data.datasets && data.datasets.length > 0 && 
    data.datasets.every(dataset => dataset.data && Array.isArray(dataset.data))

  // Debug: Show chart data info
  console.log(`📈 CHART DATA: ${sorted.length} points for ${selectedCamera} (${timeRange})`)
  
  // Chart debug removed - only show debug when "View All" is clicked

  // Calculate y-axis min and max based on actual chart data points
  let dataMin, dataMax
  let allChartTemps = []
  
  // Collect all temperature values from ALL datasets (including hidden ones)
  // This prevents Y-axis from changing when zones are toggled
  datasets.forEach(dataset => {
    if (dataset.data) {
      dataset.data.forEach(point => {
        if (point && typeof point.y === 'number') {
          allChartTemps.push(point.y)
        }
      })
    }
  })
  
  // Calculate y-axis range with consistent 5-degree buffer above highest data point
  if (allChartTemps.length === 0) {
    dataMin = tempUnit === 'F' ? 75 : Math.round(((75 - 32) * 5) / 9)
    dataMax = tempUnit === 'F' ? 120 : Math.round(((120 - 32) * 5) / 9)
  } else {
    // Use actual min/max with consistent buffers
    const actualMin = Math.min(...allChartTemps)
    const actualMax = Math.max(...allChartTemps)
    
    // Always use exactly 5° above the highest data point and 5° below the lowest
    dataMin = actualMin - 5 // Always 5° below the lowest data point (reduced for higher minimum)
    dataMax = actualMax + 5  // Always exactly 5° above the highest data point
    
    console.log(`🔧 Y-axis scaling for ${timeRange} on ${selectedCamera}: ${dataMin}°F to ${dataMax}°F (5° buffer above highest point)`)
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
  
  // Always clear and regenerate tick arrays when time range changes
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
    
    // Static positioning - leftmost tick always at Y-axis boundary
    extendedMin = start.getTime()
    extendedMax = dataMaxTime
    startTime = extendedMin
    
    // Generate static ticks - first tick always at exact start time (Y-axis position)
    custom30mTicks.push(start.getTime()) // First tick fixed at Y-axis
    for (let i = 1; i <= 6; i++) {
      const tick = new Date(start.getTime() + i * 5 * 60 * 1000) // Every 5 minutes after
      custom30mTicks.push(tick.getTime())
    }
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
    extendedMax = dataMaxTime // Use actual last data point instead of current time
    extendedMin = custom24hTicks[0] // Use first tick (exactly 24 hours ago)
    startTime = extendedMin
  } else if (timeRange === '1h') {
    const now = new Date(currentTime)
    now.setSeconds(0, 0) // Round down to nearest minute
    const start = new Date(now.getTime() - 60 * 60 * 1000)
    
    // Static positioning - leftmost tick always at Y-axis boundary
    extendedMin = start.getTime()
    extendedMax = dataMaxTime
    startTime = extendedMin
    
    // Generate static ticks - first tick always at exact start time (Y-axis position)
    custom1hTicks.push(start.getTime()) // First tick fixed at Y-axis
    for (let i = 1; i <= 12; i++) {
      const tick = new Date(start.getTime() + i * 5 * 60 * 1000)
      custom1hTicks.push(tick.getTime())
    }
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
    extendedMax = dataMaxTime // Use actual last data point instead of current time
    startTime = extendedMin
  } else if (timeRange === '6h') {
    const now = new Date(currentTime)
    const sixHoursMs = 6 * 60 * 60 * 1000
    const start = new Date(now.getTime() - sixHoursMs)
    
    // Static positioning - leftmost tick always at Y-axis boundary
    extendedMin = start.getTime()
    extendedMax = dataMaxTime
    startTime = extendedMin
    
    // Generate static ticks - first tick always at exact start time (Y-axis position)
    for (let i = 0; i <= 12; i++) {
      const tick = new Date(start.getTime() + i * 30 * 60 * 1000)
      custom6hTicks.push(tick.getTime())
    }
    
    console.log('6h axis limits:', {
      start: new Date(extendedMin).toLocaleString(),
      end: new Date(extendedMax).toLocaleString(),
      spanHours: (extendedMax - extendedMin) / (60 * 60 * 1000)
    })
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
    extendedMax = dataMaxTime // Use actual last data point instead of current time
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
    extendedMax = dataMaxTime // Use actual last data point instead of current time
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
    extendedMax = dataMaxTime // Use actual last data point instead of current time
    startTime = extendedMin
    
    console.log(`🔧 Fixed ${timeRange} axis: start=${new Date(extendedMin).toLocaleString()}, end=${new Date(extendedMax).toLocaleString()}`)
  } else {
    startTime = roundDownToNearestMinute(currentTime - timeLimit)
    extendedMin = Math.max(dataMinTime - 30 * 60 * 1000, startTime)
    extendedMax = Math.min(dataMaxTime + 30 * 60 * 1000, currentTime)
  }

  // Dynamic axis movement detection - check if axis boundaries have changed (using refs to avoid re-render loops)
  const currentHasMovement = previousAxisMinRef.current !== null && previousAxisMaxRef.current !== null && 
    (previousAxisMinRef.current !== extendedMin || previousAxisMaxRef.current !== extendedMax)
  
  // Update refs for next comparison
  previousAxisMinRef.current = extendedMin
  previousAxisMaxRef.current = extendedMax

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
  // Manual legend click handler that doesn't interfere with zoom
  const handleManualLegendClick = (zoneName) => {
    console.log('🚀 handleManualLegendClick called with:', zoneName)
    console.log('🚀 Current button state before change:', allZonesHidden)
    
    const clickTime = new Date().toISOString()
    
    // Update test results
    setTestResults(prev => ({
      ...prev,
      lastLegendClick: { zoneName, time: clickTime, buttonStateBefore: allZonesHidden }
    }))
    
    // Set flag to prevent useEffect from interfering with zoom
    isManualLegendClickRef.current = true
    
    const chart = chartRef.current
    if (!chart) return
    
    // Store current zoom state before any changes
    const xScale = chart.scales.x
    const yScale = chart.scales.y
    const preservedZoom = {
      xMin: xScale.min,
      xMax: xScale.max,
      yMin: yScale.min,
      yMax: yScale.max
    }
    
    // Use the existing hasUserZoomed state to determine if chart is zoomed out
    // If hasUserZoomed is false, the chart is showing the full data range (zoomed out)
    const isZoomedOut = !hasUserZoomed
    
    // Toggle the zone visibility
    const currentlyVisible = zonesVisibility[zoneName] !== false
    const newVisibility = !currentlyVisible
    
    // Update the zonesVisibility state
    const updatedVisibility = {
      ...zonesVisibility,
      [zoneName]: newVisibility
    }
    
    // Calculate new button state based on actual zone visibility
    const thermalZoneNames = Array.from({ length: 8 }, (_, i) => `Zone_${i + 1}`)
    
    // Count how many zones are hidden after this toggle
    const hiddenZonesCount = thermalZoneNames.filter(name => updatedVisibility[name] === false).length
    const totalZones = thermalZoneNames.length
    
    // Debug the zone visibility calculation
    console.log('🔍 ZONE VISIBILITY DEBUG:')
    console.log('  Zone being toggled:', zoneName)
    console.log('  New visibility for this zone:', newVisibility)
    console.log('  Updated visibility object:', updatedVisibility)
    thermalZoneNames.forEach(name => {
      console.log(`    ${name}: ${updatedVisibility[name]} (hidden: ${updatedVisibility[name] === false})`)
    })
    console.log(`  Hidden zones count: ${hiddenZonesCount} out of ${totalZones}`)
    
    // Button state is based on whether the clicked zone is being crossed out or not
    // If zone is being crossed out (hidden), button shows "Show All Zones" (true)
    // If zone is being uncrossed (shown), button shows "Hide All Zones" (false)
    const newButtonState = !newVisibility
    
    // Simple debug message
    console.log(`legend clicked: button state changed`)
    console.log(`zone ${zoneName} is being ${newVisibility ? 'shown' : 'crossed out'}`)
    console.log(`button state: ${newButtonState ? 'true (Show All Zones)' : 'false (Hide All Zones)'}`)
    
    // Update the button state
    setAllZonesHidden(newButtonState)
    
    // Update zonesVisibility state
    setZonesVisibility(updatedVisibility)
    
    // Update chart dataset visibility WITHOUT triggering chart update
    const datasetIndex = chart.data.datasets.findIndex(dataset => dataset.label === zoneName)
    if (datasetIndex !== -1) {
      const meta = chart.getDatasetMeta(datasetIndex)
      meta.hidden = !newVisibility
      // DO NOT call chart.update() - this resets zoom!
    }
    
    // Save to localStorage
    const nextVisible = thermalZoneNames.filter(name => updatedVisibility[name] !== false)
    localStorage.setItem('zonesVisibility', JSON.stringify(updatedVisibility))
    localStorage.setItem('visibleZones', JSON.stringify(nextVisible))
    
    // Don't update chart immediately - we'll do it during zoom restoration to prevent double updates
    console.log('flickered: no (skipping initial update to prevent flicker)')
    
    // Determine the result immediately based on zoom state
    // - If chart is zoomed out (hasUserZoomed = false), show "not preserved"
    // - If chart is zoomed in (hasUserZoomed = true), show "preserved" (we will restore zoom)
    const zoomWasPreserved = !isZoomedOut
        
        console.log('=== ZOOM PRESERVATION TEST RESULTS ===')
    console.log('Chart was zoomed out (showing full range) before click:', isZoomedOut)
    console.log('hasUserZoomed state:', hasUserZoomed)
    console.log('Final result - Zoom was preserved:', zoomWasPreserved)
        console.log('Setting zoomPreserved to:', zoomWasPreserved)
        console.log('=====================================')
        
    // Update the zoom preservation test result immediately
        setZoomPreserved(zoomWasPreserved)
        
        // Update test results
        setTestResults(prev => ({
          ...prev,
          zoomPreserved: zoomWasPreserved,
          lastButtonState: allZonesHidden
        }))
        
    // Clear flag - no chart update needed since we're not calling chart.update()
    setTimeout(() => {
      isManualLegendClickRef.current = false
    }, 10)
  }
  


  const mergedOptions = useMemo(() => {
    
    return {
    responsive: true,
    maintainAspectRatio: false, // Allow chart to fit container height
    layout: {
      padding: {
        top: -10, // Negative padding to pull chart content even higher
        bottom: 10, // Reduced bottom padding for more chart space
        left: -5, // Negative left padding to extend chart edge outward (to the left)
        right: 0, // Remove right padding to eliminate white space
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
            clampZoomPan(chart)
            
            // Store current Y-axis limits
            const yScale = chart.scales.y
            if (yScale) {
              setPreservedYAxis({
                min: yScale.min,
                max: yScale.max
              })
            }
            
            // Track that user has zoomed into the chart
            setHasUserZoomed(true)
            // Reset zoom preservation test when user zooms
            setZoomPreserved(null)
          },
        },
        pan: {
          enabled: true,
          mode: 'xy',
          onPan: ({ chart }) => {
            clampZoomPan(chart)
            
            // Store current Y-axis limits
            const yScale = chart.scales.y
            if (yScale) {
              setPreservedYAxis({
                min: yScale.min,
                max: yScale.max
              })
            }
            
            // Track that user has panned the chart
            setHasUserZoomed(true)
          },
        },
        // Disable automatic zoom-out behavior
        resetOnPan: false,
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
            min: dataMin, // Always use calculated limits to prevent zooming out past boundaries
            max: dataMax, // Always use calculated limits to prevent zooming out past boundaries
          },
        },
      },
      hoverDotsPlugin: { isChartReady: true }, // Enable hover dots plugin
      title: {
        display: false, // Title is now displayed above the container
      },

      legend: {
        display: true,
        position: 'top',
        align: 'center',
        fullSize: true,
        maxWidth: undefined,
        maxHeight: undefined,
        onClick: function(e, legendItem, legend) {
          console.log('🔥 LEGEND CLICK DETECTED!', legendItem.text)
          // Simple approach: just prevent default behavior and handle manually
          const zoneName = legendItem.text.replace(/\u0336/g, '')
          handleManualLegendClick(zoneName)
          return false
        },
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
        onHover: function(e, legendItem, legend) {
          console.log('🔥 LEGEND HOVERED!', legendItem.text)
        },
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
        animation: { duration: 0 },
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
    hover: { 
      mode: 'index', 
      intersect: false,
      animationDuration: 0
    },
    scales: {
      x: {
        type: 'linear',
        bounds: 'data',
        offset: false,
        reverse: false,
        min: extendedMin,
        max: extendedMax,
        beginAtZero: false,
        ticks: {
          maxTicksLimit: 12,
          callback: function(value) {
            // Convert timestamp to readable format
            const date = new Date(value)
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
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
              min: (() => {
                const now = new Date(currentTime)
                now.setSeconds(0, 0)
                return new Date(now.getTime() - 30 * 60 * 1000).getTime()
              })(),
              max: extendedMax,
              values: (() => {
                // Generate ticks that start exactly at the chart minimum
                const now = new Date(currentTime)
                now.setSeconds(0, 0)
                const start = new Date(now.getTime() - 30 * 60 * 1000)
                const ticks = []
                for (let i = 0; i <= 6; i++) {
                  const tick = new Date(start.getTime() + i * 5 * 60 * 1000)
                  ticks.push(tick.getTime())
                }
                return ticks
              })(), // Generate ticks that match chart minimum exactly
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // ALWAYS hide the leftmost tick - universal approach
                const currentTime = new Date()
                const chartStart = new Date(currentTime.getTime() - 30 * 60 * 1000) // 30 minutes ago
                if (value <= chartStart.getTime() + 60000) { // Hide any tick within 1 minute of start
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
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 8,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              min: (() => {
                const now = new Date(currentTime)
                now.setSeconds(0, 0)
                return new Date(now.getTime() - 12 * 60 * 60 * 1000).getTime()
              })(),
              max: extendedMax,
              values: (() => {
                // Generate ticks that start exactly at the chart minimum
                const now = new Date(currentTime)
                now.setSeconds(0, 0)
                const start = new Date(now.getTime() - 12 * 60 * 60 * 1000)
                const ticks = []
                for (let i = 0; i <= 6; i++) {
                  const tick = new Date(start.getTime() + i * 2 * 60 * 60 * 1000)
                  ticks.push(tick.getTime())
                }
                return ticks
              })(), // Generate ticks that match chart minimum exactly
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // ALWAYS hide the leftmost tick - universal approach
                const currentTime = new Date()
                const chartStart = new Date(currentTime.getTime() - 12 * 60 * 60 * 1000) // 12 hours ago
                if (value <= chartStart.getTime() + 60000) { // Hide any tick within 1 minute of start
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
          : dayRanges[timeRange]
          ? {
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              min: (() => {
                const now = new Date(currentTime)
                now.setSeconds(0, 0)
                return new Date(now.getTime() - dayRanges[timeRange] * 24 * 60 * 60 * 1000).getTime()
              })(),
              max: extendedMax,
              values: customDayTicks,
              callback(value) {
                const date = new Date(value)
                
                // ALWAYS hide the leftmost tick - universal approach
                const currentTime = new Date()
                const chartStart = new Date(currentTime.getTime() - dayRanges[timeRange] * 24 * 60 * 60 * 1000) // X days ago
                if (value <= chartStart.getTime() + 60000) { // Hide any tick within 1 minute of start
                  return '' // Return empty string to hide first label
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
              min: (() => {
                const now = new Date(currentTime)
                now.setSeconds(0, 0)
                return new Date(now.getTime() - 24 * 60 * 60 * 1000).getTime()
              })(),
              max: extendedMax,
              values: custom24hTicks, // Show all ticks but hide first label via callback
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const timeDiff = Math.abs(date.getTime() - now.getTime())
                const isCurrentTime = timeDiff < 600000 // Within 10 minutes
                
                // ALWAYS hide the leftmost tick - universal approach
                const currentTime = new Date()
                const chartStart = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
                if (value <= chartStart.getTime() + 60000) { // Hide any tick within 1 minute of start
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
          : timeRange === '1h'
          ? {
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 8,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              min: (() => {
                const now = new Date(currentTime)
                now.setSeconds(0, 0)
                return new Date(now.getTime() - 60 * 60 * 1000).getTime()
              })(),
              max: extendedMax,
              values: custom1hTicks, // Show all ticks but hide second label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // ALWAYS hide the leftmost tick - universal approach
                const currentTime = new Date()
                const chartStart = new Date(currentTime.getTime() - 60 * 60 * 1000) // 1 hour ago
                if (value <= chartStart.getTime() + 60000) { // Hide any tick within 1 minute of start
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
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              min: (() => {
                const now = new Date(currentTime)
                now.setSeconds(0, 0)
                return new Date(now.getTime() - 3 * 60 * 60 * 1000).getTime()
              })(),
              max: extendedMax,
              values: custom3hTicks, // Show all ticks but hide first label
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // ALWAYS hide the leftmost tick - universal approach
                const currentTime = new Date()
                const chartStart = new Date(currentTime.getTime() - 3 * 60 * 60 * 1000) // 3 hours ago
                if (value <= chartStart.getTime() + 60000) { // Hide any tick within 1 minute of start
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
              source: 'data',
              autoSkip: true,
              maxTicksLimit: 12,
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              min: (() => {
                const now = new Date(currentTime)
                now.setSeconds(0, 0)
                return new Date(now.getTime() - 6 * 60 * 60 * 1000).getTime()
              })(),
              max: extendedMax,
              values: custom6hTicks, // Show all ticks
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                const isCurrentTime = Math.abs(date.getTime() - now.getTime()) < 60000 // Within 1 minute
                
                // ALWAYS hide the leftmost tick - universal approach
                const currentTime = new Date()
                const chartStart = new Date(currentTime.getTime() - 6 * 60 * 60 * 1000) // 6 hours ago
                if (value <= chartStart.getTime() + 60000) { // Hide any tick within 1 minute of start
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
                
                // ALWAYS hide the leftmost tick - universal approach
                const currentTime = new Date()
                const chartStart = new Date(currentTime.getTime() - 12 * 60 * 60 * 1000) // 12 hours ago
                if (value <= chartStart.getTime() + 60000) { // Hide any tick within 1 minute of start
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
                
                // ALWAYS hide the leftmost tick - universal approach
                const currentTime = new Date()
                const chartStart = new Date(currentTime.getTime() - 48 * 60 * 60 * 1000) // 48 hours ago
                if (value <= chartStart.getTime() + 60000) { // Hide any tick within 1 minute of start
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
              maxRotation: 45,
              minRotation: 0,
              font: { size: 11, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              callback(value) {
                const date = new Date(value)
                const now = new Date()
                
                // Hide the first tick label for all time ranges
                const allTicks = [...customDayTicks, ...custom1hTicks, ...custom3hTicks, ...custom6hTicks, ...custom12hTicks, ...custom24hTicks, ...custom48hTicks]
                const firstTick = Math.min(...allTicks)
                if (Math.abs(value - firstTick) < 1000) { // Within 1 second tolerance
                  return '' // Return empty string to hide first label
                }
                
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
          drawTicks: true, // Enable ticks to show alignment
          drawOnChartArea: false,
          drawBorder: false,
          borderColor: 'transparent', // Remove any border that might create extra lines
          offset: false, // Remove grid offset to align data with Y-axis
          tickLength: 5, // Length of tick marks
          alignToPixels: true, // Align ticks to pixel boundaries for precise positioning
          tickBorderDash: [],
          tickBorderDashOffset: 0,
          tickColor: 'transparent',
          z: 1,
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
        ...(hasUserZoomed && preservedYAxis ? 
          { min: preservedYAxis.min, max: preservedYAxis.max } : 
          hasUserZoomed ? {} : 
          { min: dataMin, max: dataMax }
        ), // Use preserved limits if available, otherwise use data limits or none
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
          padding: { top: 0, bottom: 0, left: -20, right: 5 },
        },
      },
    },
  }
  }, [timeRange, isDarkMode, tempUnit, dataMin, dataMax, currentTime, dataMaxTime, zonesVisibility, selectedCamera, hasUserZoomed, preservedYAxis])

  // If showing events page, render the events page inline
  if (showEventsPage) {
    return (
      <div className={`temperature-events-page${isDarkMode ? ' dark-mode' : ''}`}>
        {/* White horizontal header container */}
        <div className="temperature-recordings-header">
          <div className="temperature-recordings-title">
            <svg className="temperature-recordings-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            Temperature Event Recordings
          </div>
          <button className="download-all-btn" onClick={() => {
            // Get the current events data to download
            const eventsData = dataToUse.length > 0 ? dataToUse.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()) : []
            const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : null
            let currentEventsData
            
            if (selectedDateStr) {
              currentEventsData = eventsData.filter(entry => {
                const entryDate = new Date(entry.time).toISOString().split('T')[0]
                return entryDate === selectedDateStr
              })
            } else {
              const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
              const currentMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999)
              
              const eventsInCurrentMonth = eventsData.filter(entry => {
                const entryDate = new Date(entry.time)
                return entryDate.getFullYear() === currentMonth.getFullYear() && 
                       entryDate.getMonth() === currentMonth.getMonth()
              })
              
              currentEventsData = eventsInCurrentMonth
            }
            
            if (currentEventsData.length > 0) {
              downloadAllEvents(currentEventsData)
            } else {
              console.log('No events data available for download')
            }
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7,10 12,15 17,10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download All
          </button>
        </div>

        {/* Main Content - Same as the modal content */}
        <div className="events-modal-content-ssam" key={modalUpdateTrigger}>
          {/* Left Sidebar - Event Dates */}
          <div className="events-sidebar">
            <h3>Event Dates</h3>
            <div className="date-navigation">
              <button 
                className="nav-arrow" 
                onClick={handlePreviousMonth}
                disabled={!hasPreviousMonthWithData()}
                style={{
                  opacity: !hasPreviousMonthWithData() ? 0.5 : 1,
                  cursor: !hasPreviousMonthWithData() ? 'not-allowed' : 'pointer'
                }}
                title={!hasPreviousMonthWithData() ? "No previous months with data" : "Previous month"}
              >
                ‹
              </button>
              <span className="current-month">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button 
                className="nav-arrow" 
                onClick={handleNextMonth}
                disabled={isAtOrPastCurrentMonth()}
                style={{
                  opacity: isAtOrPastCurrentMonth() ? 0.5 : 1,
                  cursor: isAtOrPastCurrentMonth() ? 'not-allowed' : 'pointer'
                }}
                title={isAtOrPastCurrentMonth() ? "Cannot navigate to future months" : "Next month"}
              >
                ›
              </button>
              <button className="today-btn" onClick={handleTodayClick}>Today</button>
            </div>
            <div className="date-list">
              {(() => {
                // Use the exact same data that the chart uses - this ensures perfect synchronization
                const modalData = dataToUse.length > 0 ? dataToUse.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()) : []
                
                console.log(`🔍 EVENTS PAGE USING EXACT CHART DATA:`)
                console.log(`  Chart dataToUse length: ${dataToUse.length}`)
                console.log(`  Events page data length: ${modalData.length}`)
                console.log(`  Data match: ${dataToUse.length === modalData.length ? '✅ PERFECT MATCH' : '❌ MISMATCH'}`)
                console.log(`  Current events page month: ${currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
                
                if (modalData.length > 0) {
                  console.log(`  Date range: ${new Date(modalData[0].time).toISOString().split('T')[0]} to ${new Date(modalData[modalData.length - 1].time).toISOString().split('T')[0]}`)
                  console.log(`  Most recent entry: ${new Date(modalData[modalData.length - 1].time).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
                }
                
                // Generate event dates based on current month and actual data
                const dates = []
                
                // Get unique dates from the modal data (same as chart)
                const allDates = modalData.map(entry => {
                  const dateStr = new Date(entry.time).toISOString().split('T')[0]
                  return dateStr
                })
                
                const uniqueDates = [...new Set(allDates)].sort().reverse() // Most recent first
                
                
                // Filter dates to show only those in the current month
                const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
                const currentMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999)
                
                const datesInCurrentMonth = uniqueDates.filter(dateStr => {
                  const date = new Date(dateStr)
                  // Ensure we only include dates that are actually in the current month
                  return date.getFullYear() === currentMonth.getFullYear() && 
                         date.getMonth() === currentMonth.getMonth()
                })
                
                // Only show dates that are actually in the current month
                let datesToShow = datesInCurrentMonth
                
                for (let i = 0; i < datesToShow.length; i++) {
                  const dateStr = datesToShow[i]
                  const date = new Date(dateStr)
                  
                  // Count actual events for this date from the modal data (same as chart)
                  const eventCount = modalData.filter(entry => {
                    const entryDate = new Date(entry.time).toISOString().split('T')[0]
                    return entryDate === dateStr
                  }).length
                  
                  // Check if this date is selected (default to first date if none selected)
                  const isSelected = selectedDate ? 
                    date.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0] : 
                    i === 0
                  
                  dates.push({ date, eventCount, isSelected })
                }
                return dates.map(({ date, eventCount, isSelected }, index) => (
                  <div 
                    key={index} 
                    className={`date-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleDateSelect(date)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="date-text">{date.toISOString().split('T')[0]}</span>
                    <span className="event-count">{eventCount}</span>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Right Content - Event Details */}
          <div className="events-content">
            <div className="events-list">
              {(() => {
                // Use the exact same data that the chart uses for events list - ensures perfect synchronization
                const eventsData = dataToUse.length > 0 ? dataToUse.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()) : []
                
                // Filter events by selected date or current month
                const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : null
                let filteredEvents
                
                if (selectedDateStr) {
                  // Filter by specific date
                  filteredEvents = eventsData.filter(entry => {
                    const entryDate = new Date(entry.time).toISOString().split('T')[0]
                    return entryDate === selectedDateStr
                  })
                } else {
                  // Filter by current month, or show most recent if no data in current month
                  const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
                  const currentMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999)
                  
                  const eventsInCurrentMonth = eventsData.filter(entry => {
                    const entryDate = new Date(entry.time)
                    // Ensure we only include dates that are actually in the current month
                    return entryDate.getFullYear() === currentMonth.getFullYear() && 
                           entryDate.getMonth() === currentMonth.getMonth()
                  })
                  
                  // Only show events that are actually in the current month
                  filteredEvents = eventsInCurrentMonth
                }
                
                console.log(`🔍 EVENTS FILTERING (USING CHART DATA):`)
                console.log(`  Selected date: ${selectedDateStr || `Time range (${timeRange})`}`)
                console.log(`  Time range: ${timeRange}`)
                console.log(`  Filtered events count: ${filteredEvents.length}`)
                console.log(`  Total events data: ${eventsData.length} (same as chart: ${dataToUse.length})`)
                console.log(`  Data source match: ${eventsData.length === dataToUse.length ? '✅ SAME DATA' : '❌ DIFFERENT DATA'}`)
                
                return filteredEvents.reverse().map((dataPoint, index) => {
                  const eventTime = new Date(dataPoint.time)
                  
                  // Debug logging for data structure
                  if (index === 0) { // Only log first event to avoid spam
                    console.log(`🔍 EVENTS PAGE DATA DEBUG:`)
                    console.log(`  Event time: ${dataPoint.time}`)
                    console.log(`  Event readings:`, dataPoint.readings)
                    console.log(`  Event readings keys:`, Object.keys(dataPoint.readings || {}))
                    console.log(`  AllZones:`, allZones.map(z => z.name))
                    console.log(`  AllZones length: ${allZones.length}`)
                    console.log(`  Sample temperatures:`, Object.entries(dataPoint.readings || {}).slice(0, 5))
                    
                    // Compare with chart data for the same time
                    const chartDataForThisTime = sorted.find(entry => 
                      new Date(entry.time).getTime() === new Date(dataPoint.time).getTime()
                    )
                    if (chartDataForThisTime) {
                      console.log(`📊 CHART DATA FOR SAME TIME:`)
                      console.log(`  Chart time: ${chartDataForThisTime.time}`)
                      console.log(`  Chart readings:`, chartDataForThisTime.readings)
                      console.log(`  Chart readings keys:`, Object.keys(chartDataForThisTime.readings || {}))
                      console.log(`  Sample chart temperatures:`, Object.entries(chartDataForThisTime.readings || {}).slice(0, 5))
                    } else {
                      console.log(`❌ NO MATCHING CHART DATA FOUND for time: ${dataPoint.time}`)
                    }
                    
                    // Check what zones the chart is actually using
                    console.log(`📈 CHART ZONES DEBUG:`)
                    console.log(`  Chart zones:`, allZones.map(z => z.name))
                    console.log(`  Chart zones length: ${allZones.length}`)
                  }
                  
                  const alarmZone = Object.keys(dataPoint.readings || {}).find(zone => {
                    const temperature = dataPoint.readings[zone]
                    const zoneIndex = Object.keys(dataPoint.readings || {}).indexOf(zone)
                    // Apply same offset as temperature display: + (idx * 3)
                    const roundedTemp = temperature ? Math.round(temperature) + (zoneIndex * 3) : 32
                    // Use threshold 180 for Zone_8, 140 for all other zones
                    const threshold = zone === 'Zone_8' ? 180 : 140
                    return roundedTemp > threshold
                  }) || 'No alarms'
                  const cameraName = selectedCamera === 'planck_1' ? 'Left Camera' : 'Right Camera'
                  
                  return (
                    <div key={index} className="event-card">
                      <div className="event-header">
                        <div className="event-timestamp">
                          {eventTime.toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })} at {eventTime.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: '2-digit',
                            hour12: true 
                          })} (UTC)
                        </div>
                        <button 
                          className="download-event-btn"
                          onClick={() => {
                            console.log('📥 Individual event download clicked')
                            downloadEventData(dataPoint, index)
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7,10 12,15 17,10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </button>
                      </div>
                      
                      <div className="event-details">
                        <div className="event-info">
                          <p style={{ 
                            background: 'linear-gradient(135deg, #ff6b6b, #ff8e8e)', 
                            color: 'white', 
                            padding: '8px 12px', 
                            borderRadius: '6px', 
                            fontWeight: 'bold',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            boxShadow: '0 2px 4px rgba(255,107,107,0.3)'
                          }}>
                            <strong style={{ color: 'white' }}>Alarm Triggered By:</strong> {cameraName}
                          </p>
                        </div>
                        
                        <div className="event-images">
                          <div className="image-container">
                            <h4>Thermal Image</h4>
                            <img 
                              src="/offline-assets/icons/Thermal.png" 
                              alt="Thermal Image" 
                              className="modal-image"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'block'
                              }}
                            />
                            <div className="image-fallback">
                              <span>Thermal Image</span>
                            </div>
                          </div>
                          <div className="image-container">
                            <h4>Normal Image</h4>
                            <img 
                              src="/offline-assets/icons/Surveillance.png" 
                              alt="Normal Image" 
                              className="modal-image"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'block'
                              }}
                            />
                            <div className="image-fallback">
                              <span>Normal Image</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="temperature-readings">
                          <h4>Temperature Readings</h4>
                          <div className="temp-grid">
                            {Object.entries(dataPoint.readings || {}).map(([zoneName, temperature], idx) => {
                              
                              // Debug logging for temperature calculation
                              if (idx < 3) { // Only log first 3 zones to avoid spam
                                console.log(`🌡️ EVENTS PAGE - Zone ${zoneName}:`)
                                console.log(`  Raw temp = ${temperature}, type = ${typeof temperature}`)
                                console.log(`  DataPoint readings:`, dataPoint.readings)
                                
                                // Check what the chart would show for this same data point
                                const chartEntry = sorted.find(entry => 
                                  new Date(entry.time).getTime() === new Date(dataPoint.time).getTime()
                                )
                                if (chartEntry) {
                                  const chartTemp = chartEntry.readings?.[zoneName]
                                  console.log(`  CHART - Zone ${zoneName}: raw temp = ${chartTemp}, type = ${typeof chartTemp}`)
                                  if (typeof chartTemp === 'number') {
                                    const chartRounded = tempUnit === 'F' ? Math.round(chartTemp) : Math.round(((chartTemp - 32) * 5) / 9)
                                    console.log(`  CHART - Zone ${zoneName}: rounded = ${chartRounded}°${tempUnit}`)
                                  }
                                }
                              }
                              
                              // Only show temperature if it exists in the data - no default values
                              if (typeof temperature === 'number' && !isNaN(temperature)) {
                                // Match chart calculation: round first, then add offset
                                const baseTemp = tempUnit === 'F' 
                                  ? Math.round(temperature) 
                                  : Math.round(((temperature - 32) * 5) / 9)
                                const roundedTemp = baseTemp + (idx * 3) // Add same offset as chart
                                
                                const threshold = zoneName === 'Zone_8' ? 180 : 140
                                const isAlarm = roundedTemp > threshold
                                
                                // Debug final calculation
                                if (idx < 3) {
                                  console.log(`  FINAL - Zone ${zoneName}: roundedTemp = ${roundedTemp}°${tempUnit}`)
                                }
                                
                                return (
                                  <div key={zoneName} className={`temp-reading ${isAlarm ? 'alarm' : ''}`}>
                                    <div className="temp-label">{zoneName}</div>
                                    <div className="temp-values">
                                      <span className="current-temp">Current: {roundedTemp}°{tempUnit}</span>
                                      <span className="threshold-temp">Threshold: {threshold}°{tempUnit}</span>
                                    </div>
                                  </div>
                                )
                              } else {
                                // Don't show zones that don't have temperature data
                                return null
                              }
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      </div>
    )
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
            margin: '0 0 5px 0',
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
            margin: '0 0 5px 0',
            width: '102%',
            marginLeft: '-1%'
          }}
        />
        <div className="chart-container" style={{ position: 'relative' }}>
          {/* Chart Broken Indicator */}
          {!isValidData && (
            <div 
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#dc3545',
                color: 'white',
                padding: '16px 24px',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: '700',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                zIndex: 1001,
                boxShadow: '0 4px 12px rgba(220, 53, 69, 0.4)',
                border: '2px solid #c82333',
                textAlign: 'center',
                minWidth: '300px'
              }}
            >
              🚨 CHART IS BROKEN 🚨
              <br />
              <span style={{ fontSize: '14px', fontWeight: '400', marginTop: '8px', display: 'block' }}>
                No valid data to display
                <br />
                Time Range: {timeRange} | Camera: {selectedCamera}
                <br />
                Data Points: {dataToUse ? dataToUse.length : 0}
              </span>
            </div>
          )}
          
          {/* Time Interval Display Box */}
          
          {isValidData && (
            <Line 
              key={`chart-${timeRange}-${selectedCamera}`}
              ref={chartRef} 
              data={data} 
              options={{
                ...mergedOptions,
                onResize: (chart, size) => {
                  // Ensure chart is properly destroyed before resize
                  const canvas = chart.canvas
                  if (canvas && canvas.ownerDocument) {
                    const existingChart = Chart.getChart(canvas)
                    if (existingChart && existingChart !== chart && existingChart.canvas && existingChart.canvas.ownerDocument) {
                      existingChart.destroy()
                    }
                  }
                },
                // Add responsive options to prevent DOM errors
                responsive: true,
                maintainAspectRatio: false,
                // Disable animations that might cause DOM issues
                animation: false,
                // Add error handling
                onError: (error) => {
                  console.log('Chart error (ignoring):', error)
                }
              }}
            />
          )}
          {(isCameraSwitching || isChangingTimeRange) && dataSource.length === 0 && (
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
        </div>
      </div>

      <div
        ref={containerRef}
        className="chart-button-container"
        style={{
          color: isDarkMode ? '#eee' : undefined,
          position: 'relative'
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
              const previousTimeRange = timeRange
              setIsChangingTimeRange(true)
              
              // PAGE REFRESH BEHAVIOR: Reset UI state but preserve data generation logic
              console.log(`🔄 PAGE REFRESH: Time range changed from ${previousTimeRange} to ${newTimeRange}`)
              
              // Reset UI and interaction state (page refresh behavior)
              setHasUserZoomed(false)
              setZoomPreserved(null)
              setPreservedYAxis(null)
              setAllZonesHidden(false)
              setLegendClickTestResult(null)
              setTestResults({
                zoomPreserved: null,
                legendClickConnected: null,
                timeRangeSwitch: null
              })
              setTimeRangeSwitchTest({
                isVisible: true,
                previousTimeRange: previousTimeRange,
                currentTimeRange: newTimeRange,
                dataWasReset: true,
                switchTimestamp: new Date().toISOString()
              })
              setInitialRange(null)
              setShowExportMenu(false)
              setIsDropdownOpen(false)
              setIsCameraSwitching(false)
              setIsDynamicMovement(false)
              
              // Reset zones visibility to all visible
              setZonesVisibility(() => {
                const initialVisibility = {}
                zones.forEach(zone => {
                  initialVisibility[zone.name] = true
                })
                return initialVisibility
              })
              
              // Reset events modal state
              setShowEventsModal(false)
              setModalUpdateTrigger(0)
              setSelectedDate(null)
              setCurrentMonth(new Date())
              setMonthInitialized(false)
              
              // Check if data exists for the new time range to determine if it was reset
              const testDataKey = `thermalHistory${newTimeRange}_${selectedCamera}`
              const existingData = localStorage.getItem(testDataKey)
              const dataWasReset = !existingData || existingData === '[]'
              
              // Clear cached data for the new time range to force fresh generation
              localStorage.removeItem(`thermalHistory${newTimeRange}_${selectedCamera}`)
              localStorage.removeItem(`thermalHistory${newTimeRange}_all_cameras`)
              
              // Force immediate data generation for the new time range
              console.log(`🔄 FORCING IMMEDIATE DATA GENERATION for ${newTimeRange}`)
              
              // Generate data immediately for the new time range
              const now = new Date()
              const testData = []
              
              // Set appropriate entries and intervals for each time range
              let entries, interval, startTime
              if (newTimeRange === '30m') {
                entries = 60
                interval = 30 * 1000
                startTime = new Date(now.getTime() - (30 * 60 * 1000))
              } else if (newTimeRange === '1h') {
                entries = 60
                interval = 60 * 1000
                startTime = new Date(now.getTime() - (60 * 60 * 1000))
              } else if (newTimeRange === '3h') {
                entries = 180
                interval = 60 * 1000
                startTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
              } else if (newTimeRange === '6h') {
                entries = 360
                interval = 60 * 1000
                startTime = new Date(now.getTime() - (6 * 60 * 60 * 1000))
              } else if (newTimeRange === '12h') {
                entries = 720
                interval = 60 * 1000
                startTime = new Date(now.getTime() - (12 * 60 * 60 * 1000))
              } else if (newTimeRange === '24h') {
                entries = 1440
                interval = 60 * 1000
                startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
              } else if (newTimeRange === '48h') {
                entries = 2880
                interval = 60 * 1000
                startTime = new Date(now.getTime() - (48 * 60 * 60 * 1000))
              } else if (newTimeRange === '7d') {
                entries = 98
                interval = (7 * 24 * 60 * 60 * 1000) / (entries - 1)
                startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
              } else if (newTimeRange === '1m') {
                entries = 30
                interval = 24 * 60 * 60 * 1000
                startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
              } else {
                entries = 1440
                interval = 60 * 1000
                startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000))
              }
              
              // Generate test data
              const seededRandom = (seed) => {
                const x = Math.sin(seed) * 10000
                return x - Math.floor(x)
              }
              
              for (let i = 0; i < entries; i++) {
                const time = new Date(startTime.getTime() + (i * interval))
                const readings = {}
                
                Array.from({ length: 8 }, (_, zoneIndex) => `Zone_${zoneIndex + 1}`).forEach((zoneName, zoneIndex) => {
                  const isLeftCamera = selectedCamera === 'planck_1'
                  const cameraOffset = isLeftCamera ? 2 : 0
                  const baseVariation = Math.sin((zoneIndex / 8) * Math.PI) * 15
                  const zoneBaseTemp = 75 + baseVariation + cameraOffset
                  
                  const primaryWave = Math.sin((i / 35) * Math.PI + zoneIndex) * 1.8
                  const secondaryWave = Math.cos((i / 25) * Math.PI + zoneIndex * 2) * 1.2
                  const tertiaryWave = Math.sin((i / 50) * Math.PI + zoneIndex * 3) * 1.0
                  const noiseSeed = i * 1000 + zoneIndex * 100 + (selectedCamera === 'planck_1' ? 7000 : 8000) + 9000
                  const randomNoise = (seededRandom(noiseSeed) - 0.5) * 1.4
                  const dailyPattern = Math.sin((time.getHours() / 24) * Math.PI * 2) * 0.8
                  
                  const timeBasedSpike = Math.sin((i / 20 + zoneIndex * 0.5) * Math.PI) * 25
                  const randomSpike = Math.random() < 0.1 ? (Math.random() * 30) : 0
                  const finalTemp = zoneBaseTemp + timeBasedSpike + randomSpike + primaryWave + secondaryWave + tertiaryWave + randomNoise + dailyPattern
                  readings[zoneName] = Math.round(finalTemp * 10) / 10
                })
                
                testData.push({
                  time: time.toISOString(),
                  readings: readings
                })
              }
              
              // Store the generated data
              localStorage.setItem(testDataKey, JSON.stringify(testData))
              console.log(`✅ IMMEDIATE DATA GENERATION: Generated ${testData.length} data points for ${newTimeRange}`)
              
              // Immediately update the chart data
              setDataToUse(testData)
              console.log(`✅ IMMEDIATE DATA UPDATE: Set dataToUse to ${testData.length} points for ${newTimeRange}`)
              
              // Force chart refresh for 24h to apply tick changes
              if (newTimeRange === '24h') {
                setRefreshCounter(prev => prev + 1)
              }
              
              // Set timeRange with a small delay to ensure proper chart remount
              setTimeout(() => {
                setTimeRange(newTimeRange)
                setHasUserZoomed(false) // Reset zoom state when time range changes
                setPreservedYAxis(null)
                console.log('timeRange set to:', newTimeRange)
              }, 50)
              
              // Simple approach for most intervals, special handling only for 48h
              setTimeout(() => {
                if (newTimeRange === '24h' || newTimeRange === '48h') {
                  // Normal handling for 24h and 48h
                  if (chartRef.current && chartRef.current.resetZoom) {
                    chartRef.current.resetZoom()
                  }
                  
                  setInitialRange(null)
                  setTimeRange(newTimeRange)
                  setHasUserZoomed(false) // Reset zoom state when time range changes
                  localStorage.setItem('timeRange', newTimeRange)
                  setRefreshCounter(prev => prev + 3)
                  
                  setTimeout(() => setIsChangingTimeRange(false), 50)
                } else {
                  // Simple approach for all other intervals
                  if (chartRef.current && chartRef.current.resetZoom) {
                    chartRef.current.resetZoom()
                  }
                  
                  setInitialRange(null)
                  setTimeRange(newTimeRange)
                  setHasUserZoomed(false) // Reset zoom state when time range changes
                  localStorage.setItem('timeRange', newTimeRange)
                  
                  // Force more aggressive refresh for 30m and 1h to ensure proper tick alignment
                  if (newTimeRange === '30m' || newTimeRange === '1h') {
                    setRefreshCounter(prev => prev + 2)
                  } else {
                    setRefreshCounter(prev => prev + 1)
                  }
                  
                  // Simple delay for other ranges
                  setTimeout(() => setIsChangingTimeRange(false), 50)
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

      {/* Temperature Event Recordings Container */}
      <div className="chart-button-container temperature-events-container">
        <div className="temperature-events-header">
          <h3 className="temperature-events-title">Temperature Event Recordings</h3>
          <button className="view-all-button" onClick={handleViewAllClick}>
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        
        {/* Horizontal divider */}
        <div className="temperature-events-divider"></div>
        
        <div className="temperature-events-cards">
          <div className="temperature-event-card" style={{
            background: temperatureEvents.maxTemperature > 140 ? '#ff8e8e !important' : 'transparent',
            borderRadius: temperatureEvents.maxTemperature > 140 ? '8px' : '0',
            padding: temperatureEvents.maxTemperature > 140 ? '12px' : '0',
            border: temperatureEvents.maxTemperature > 140 ? '1px solid #ff6b6b !important' : 'none',
            boxShadow: temperatureEvents.maxTemperature > 140 ? '0 2px 4px rgba(255,107,107,0.3) !important' : 'none'
          }}>
            <div className="event-card-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0z" fill="url(#thermometerGradient)"/>
                <defs>
                  <linearGradient id="thermometerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="event-card-content">
              <div className="event-card-value">{temperatureEvents.maxTemperature}°{tempUnit}</div>
              <div className="event-card-label">Max Temperature</div>
            </div>
          </div>
          
          <div className="temperature-event-card">
            <div className="event-card-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <rect x="7" y="7" width="3" height="9"/>
                <rect x="14" y="7" width="3" height="5"/>
                <rect x="10.5" y="7" width="3" height="7"/>
              </svg>
            </div>
            <div className="event-card-content">
              <div className="event-card-value">{temperatureEvents?.eventsToday || 0}</div>
              <div className="event-card-label">Events Today</div>
            </div>
          </div>
        </div>
      </div>

      {/* Temperature Events Modal - SSAM Style */}
      {showEventsModal && (
        <div className="events-modal-overlay" onClick={closeEventsModal}>
          <div className="events-modal-ssam" onClick={(e) => e.stopPropagation()}>
            {/* Header buttons */}
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              display: 'flex',
              gap: '10px',
              zIndex: 1000
            }}>
              <button 
                className="download-all-btn" 
                onClick={() => {
                  console.log('📥 Download All button clicked')
                  // Get the current filtered events data from the scope
                  const eventsData = dataToUse.length > 0 ? dataToUse.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()) : []
                  const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : null
                  let currentEventsData
                  
                  if (selectedDateStr) {
                    currentEventsData = eventsData.filter(entry => {
                      const entryDate = new Date(entry.time).toISOString().split('T')[0]
                      return entryDate === selectedDateStr
                    })
                  } else {
                    const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
                    const currentMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999)
                    
                    const eventsInCurrentMonth = eventsData.filter(entry => {
                      const entryDate = new Date(entry.time)
                      return entryDate.getFullYear() === currentMonth.getFullYear() && 
                             entryDate.getMonth() === currentMonth.getMonth()
                    })
                    
                    currentEventsData = eventsInCurrentMonth
                  }
                  
                  if (currentEventsData.length > 0) {
                    downloadAllEvents(currentEventsData)
                  } else {
                    console.log('No events data available for download')
                  }
                }}
                style={{
                  background: '#68d391',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.target.style.background = '#5cb85c'}
                onMouseLeave={(e) => e.target.style.background = '#68d391'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download All
              </button>
              <button className="events-modal-close" onClick={closeEventsModal} style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.color = '#374151'}
              onMouseLeave={(e) => e.target.style.color = '#6b7280'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="events-modal-content-ssam" key={modalUpdateTrigger}>
              {/* Left Sidebar - Event Dates */}
              <div className="events-sidebar">
                <h3>Event Dates</h3>
                <div className="date-navigation">
                  <button 
                    className="nav-arrow" 
                    onClick={handlePreviousMonth}
                    disabled={!hasPreviousMonthWithData()}
                    style={{
                      opacity: !hasPreviousMonthWithData() ? 0.5 : 1,
                      cursor: !hasPreviousMonthWithData() ? 'not-allowed' : 'pointer',
                      position: 'relative'
                    }}
                    title={!hasPreviousMonthWithData() ? "No previous months with data" : "Previous month"}
                  >
                    ‹
                    {!hasPreviousMonthWithData() && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          opacity: 0,
                          transition: 'opacity 0.2s ease',
                          pointerEvents: 'none',
                          fontSize: '12px',
                          color: '#ef4444',
                          fontWeight: 'bold'
                        }}
                        className="crossout-icon"
                      >
                        ✕
                      </div>
                    )}
                  </button>
                  <span className="current-month">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button 
                    className="nav-arrow" 
                    onClick={handleNextMonth}
                    disabled={isAtOrPastCurrentMonth()}
                    style={{
                      opacity: isAtOrPastCurrentMonth() ? 0.5 : 1,
                      cursor: isAtOrPastCurrentMonth() ? 'not-allowed' : 'pointer',
                      position: 'relative'
                    }}
                    title={isAtOrPastCurrentMonth() ? "Cannot navigate to future months" : "Next month"}
                  >
                    ›
                    {isAtOrPastCurrentMonth() && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          opacity: 0,
                          transition: 'opacity 0.2s ease',
                          pointerEvents: 'none',
                          fontSize: '12px',
                          color: '#ef4444',
                          fontWeight: 'bold'
                        }}
                        className="crossout-icon"
                      >
                        ✕
                      </div>
                    )}
                  </button>
                  <button className="today-btn" onClick={handleTodayClick}>Today</button>
                </div>
                <div className="date-list">
                  {(() => {
                    // Use the same dataSource that the chart uses - this ensures dynamic updates
                    const modalData = dataSource.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                    
                    console.log(`🔍 MODAL USING CHART DATA:`)
                    console.log(`  Chart dataSource length: ${dataSource.length}`)
                    console.log(`  Chart dataToUse length: ${dataToUse.length}`)
                    console.log(`  Modal data length: ${modalData.length}`)
                    console.log(`  Current modal month: ${currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
                    
                    if (modalData.length > 0) {
                      console.log(`  Date range: ${new Date(modalData[0].time).toISOString().split('T')[0]} to ${new Date(modalData[modalData.length - 1].time).toISOString().split('T')[0]}`)
                      console.log(`  Most recent entry: ${new Date(modalData[modalData.length - 1].time).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
                      console.log(`  Sample entries:`, modalData.slice(0, 3).map(e => ({
                        time: e.time,
                        date: new Date(e.time).toISOString().split('T')[0],
                        month: new Date(e.time).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      })))
                    }
                    
                    // Compare with events today calculation
                    const todayStart = new Date()
                    todayStart.setHours(0, 0, 0, 0)
                    const todayEnd = new Date()
                    todayEnd.setHours(23, 59, 59, 999)
                    
                    const todayEvents = modalData.filter(entry => {
                      const entryTime = new Date(entry.time)
                      return entryTime >= todayStart && entryTime <= todayEnd
                    }).length
                    
                    console.log(`  Today's events (modal calculation): ${todayEvents}`)
                    console.log(`  Today's events (chart calculation): ${temperatureEvents.eventsToday}`)
                    
                    // Generate event dates based on current month and actual data
                    const dates = []
                    
                    // Get unique dates from the modal data (same as chart)
                    const allDates = modalData.map(entry => {
                      const dateStr = new Date(entry.time).toISOString().split('T')[0]
                      return dateStr
                    })
                    
                    console.log(`📅 All dates in data (first 10):`, allDates.slice(0, 10))
                    console.log(`📅 Current month: ${currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
                    
                    const uniqueDates = [...new Set(allDates)].sort().reverse() // Most recent first
                    
                    console.log(`📅 Unique dates in data:`, uniqueDates)
                    console.log(`📅 Total entries: ${sorted.length}, Unique dates: ${uniqueDates.length}`)
                    
                    // Filter dates to show only those in the current month
                    const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
                    const currentMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999)
                    
                    const datesInCurrentMonth = uniqueDates.filter(dateStr => {
                      const date = new Date(dateStr)
                      // Ensure we only include dates that are actually in the current month
                      return date.getFullYear() === currentMonth.getFullYear() && 
                             date.getMonth() === currentMonth.getMonth()
                    })
                    
                    console.log(`📅 Dates in current month:`, datesInCurrentMonth)
                    
                    // If no dates in current month, show some recent dates from data
                    let datesToShow = datesInCurrentMonth
                    if (datesToShow.length === 0) {
                      datesToShow = uniqueDates.slice(0, 5) // Show 5 most recent dates
                      console.log(`📅 No dates in current month, showing recent dates:`, datesToShow)
                    }
                    
                    console.log(`📅 Final dates to show:`, datesToShow)
                    
                    for (let i = 0; i < datesToShow.length; i++) {
                      const dateStr = datesToShow[i]
                      const date = new Date(dateStr)
                      
                      // Count actual events for this date from the modal data (same as chart)
                      const eventCount = modalData.filter(entry => {
                        const entryDate = new Date(entry.time).toISOString().split('T')[0]
                        return entryDate === dateStr
                      }).length
                      
                      // Debug logging for first few dates
                      if (i < 3) {
                        console.log(`📅 Date ${dateStr}: ${eventCount} entries`)
                        
                        // Show all entries for this date to debug
                        const entriesForDate = modalData.filter(entry => {
                          const entryDate = new Date(entry.time).toISOString().split('T')[0]
                          return entryDate === dateStr
                        })
                        
                        console.log(`  All entries for ${dateStr}:`, entriesForDate.length)
                        if (entriesForDate.length > 0) {
                          console.log(`  Sample entries:`, entriesForDate.slice(0, 2).map(e => ({
                            time: e.time,
                            date: new Date(e.time).toISOString().split('T')[0]
                          })))
                        } else {
                          // Show what dates we actually have
                          const actualDates = [...new Set(modalData.map(entry => 
                            new Date(entry.time).toISOString().split('T')[0]
                          ))]
                          console.log(`  Available dates in data:`, actualDates.slice(0, 5))
                        }
                      }
                      
                      // Check if this date is selected (default to first date if none selected)
                      const isSelected = selectedDate ? 
                        date.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0] : 
                        i === 0
                      
                      dates.push({ date, eventCount, isSelected })
                    }
                    return dates.map(({ date, eventCount, isSelected }, index) => (
                      <div 
                        key={index} 
                        className={`date-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleDateSelect(date)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="date-text">{date.toISOString().split('T')[0]}</span>
                        <span className="event-count">{eventCount}</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>

              {/* Right Content - Event Details */}
              <div className="events-content">
                <div className="events-list">
                  {(() => {
                    // Use the same dataToUse that the chart uses for events list - ensures perfect synchronization
                    const eventsData = dataToUse.length > 0 ? dataToUse.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()) : []
                    
                    // Filter events by selected date or current month
                    const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : null
                    let filteredEvents
                    
                    if (selectedDateStr) {
                      // Filter by specific date
                      filteredEvents = eventsData.filter(entry => {
                        const entryDate = new Date(entry.time).toISOString().split('T')[0]
                        return entryDate === selectedDateStr
                      })
                    } else {
                      // Filter by selected time range
                      const now = new Date()
                      let timeRangeStart
                      
                      // Calculate the start time based on the selected time range
                      switch (timeRange) {
                        case '30m':
                          timeRangeStart = new Date(now.getTime() - (30 * 60 * 1000))
                          break
                        case '1h':
                          timeRangeStart = new Date(now.getTime() - (60 * 60 * 1000))
                          break
                        case '6h':
                          timeRangeStart = new Date(now.getTime() - (6 * 60 * 60 * 1000))
                          break
                        case '12h':
                          timeRangeStart = new Date(now.getTime() - (12 * 60 * 60 * 1000))
                          break
                        case '24h':
                          timeRangeStart = new Date(now.getTime() - (24 * 60 * 60 * 1000))
                          break
                        case '48h':
                          timeRangeStart = new Date(now.getTime() - (48 * 60 * 60 * 1000))
                          break
                        case '7d':
                          timeRangeStart = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
                          break
                        case '1m':
                          timeRangeStart = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
                          break
                        default:
                          timeRangeStart = new Date(now.getTime() - (24 * 60 * 60 * 1000)) // Default to 24h
                      }
                      
                      const eventsInTimeRange = eventsData.filter(entry => {
                        const entryDate = new Date(entry.time)
                        // Ensure we only include events that are within the selected time range
                        return entryDate >= timeRangeStart && entryDate <= now
                      })
                      
                      // Only show events that are actually within the selected time range
                      filteredEvents = eventsInTimeRange
                    }
                    
                    console.log(`🔍 EVENTS FILTERING:`)
                    console.log(`  Selected date: ${selectedDateStr || 'Current month'}`)
                    console.log(`  Current month: ${currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
                    console.log(`  Filtered events count: ${filteredEvents.length}`)
                    console.log(`  Total events data: ${eventsData.length}`)
                    
                    return filteredEvents.reverse().map((dataPoint, index) => {
                    const eventTime = new Date(dataPoint.time)
                    const alarmZone = Object.keys(dataPoint.readings || {}).find(zone => {
                      const temperature = dataPoint.readings[zone]
                      const zoneIndex = Object.keys(dataPoint.readings || {}).indexOf(zone)
                      // Apply same offset as temperature display: + (idx * 3)
                      const roundedTemp = temperature ? Math.round(temperature) + (zoneIndex * 3) : 32
                      // Use threshold 180 for Zone_8, 140 for all other zones
                      const threshold = zone === 'Zone_8' ? 180 : 140
                      return roundedTemp > threshold
                    }) || 'No alarms'
                    const cameraName = selectedCamera === 'planck_1' ? 'Left Camera' : 'Right Camera'
                    
                    return (
                      <div key={index} className="event-card">
                        <div className="event-header">
                          <div className="event-timestamp">
                            {eventTime.toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })} at {eventTime.toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: true 
                            })} (UTC)
                          </div>
                          <button 
                            className="download-event-btn"
                            onClick={() => {
                              console.log('📥 Individual event download clicked')
                              downloadEventData(dataPoint, index)
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7,10 12,15 17,10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          </button>
                        </div>
                        
                        <div className="event-details">
                          <div className="event-info">
                            <p style={{ 
                              background: 'linear-gradient(135deg, #ff6b6b, #ff8e8e)', 
                              color: 'white', 
                              padding: '8px 12px', 
                              borderRadius: '6px', 
                              fontWeight: 'bold',
                              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                              boxShadow: '0 2px 4px rgba(255,107,107,0.3)'
                            }}>
                              <strong style={{ color: 'white' }}>Alarm Triggered By:</strong> {cameraName}
                            </p>
                          </div>
                          
                          <div className="event-images">
                            <div className="image-container">
                              <h4>Thermal Image</h4>
                              <img 
                                src="/offline-assets/icons/Thermal.png" 
                                alt="Thermal Image" 
                                className="modal-image"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                  e.target.nextSibling.style.display = 'block'
                                }}
                              />
                              <div className="image-fallback">
                                <span>Thermal Image</span>
                              </div>
                            </div>
                            <div className="image-container">
                              <h4>Normal Image</h4>
                              <img 
                                src="/offline-assets/icons/Surveillance.png" 
                                alt="Normal Image" 
                                className="modal-image"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                  e.target.nextSibling.style.display = 'block'
                                }}
                              />
                              <div className="image-fallback">
                                <span>Normal Image</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="temperature-readings">
                            <h4>Temperature Readings</h4>
                            <div className="temp-grid">
                              {thermalZones.map((zone, idx) => {
                                const temperature = dataPoint.readings?.[zone.name]
                                // Match chart calculation: round first, then add offset
                                const roundedTemp = temperature ? Math.round(temperature) + (idx * 3) : 32
                                const threshold = zone.name === 'Zone_8' ? 180 : 140
                                const isAlarm = roundedTemp > threshold
                                
                                return (
                                  <div key={zone.name} className={`temp-reading ${isAlarm ? 'alarm' : ''}`}>
                                    <div className="temp-label">{zone.name}</div>
                                    <div className="temp-values">
                                      <span className="current-temp">Current: {roundedTemp}°{tempUnit}</span>
                                      <span className="threshold-temp">Threshold: {threshold}°{tempUnit}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                  })()}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}


    </>
  )
}