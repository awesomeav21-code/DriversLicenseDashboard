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
  afterDraw(chart) {
    if (!chart.options.plugins.jitterPlugin?.isChartReady) return
    if (chart._zooming || chart._panning) return

    const ctx = chart.ctx
    const datasets = chart.data.datasets
    const xScale = chart.scales.x

    const pointsByTime = new Map()
    datasets.forEach((dataset, dsIndex) => {
      const meta = chart.getDatasetMeta(dsIndex)
      if (meta.hidden) return

      dataset.data.forEach((point, i) => {
        if (point && point.x != null) {
          const timeMs = new Date(point.x).getTime()
          const roundedTime = Math.round(timeMs / 3000) * 3000
          if (!pointsByTime.has(roundedTime)) pointsByTime.set(roundedTime, [])
          pointsByTime.get(roundedTime).push({ dsIndex, index: i, timeMs, y: point.y })
        }
      })
    })

    const now = Date.now()
    const maxOffsetBase = 1
    const maxTimeSpan = 3600000

    ctx.save()
    ctx.lineWidth = 2

    pointsByTime.forEach(points => {
      const count = points.length
      if (count <= 1) return

      const avgTime = points.reduce((acc, p) => acc + p.timeMs, 0) / count
      let timeDiff = now - avgTime
      if (timeDiff < 0) timeDiff = 0
      const scaleFactor = 1 + (1 - Math.min(timeDiff / maxTimeSpan, 1)) * 2
      const maxOffsetPx = maxOffsetBase * scaleFactor

      points.forEach((p, i) => {
        const meta = chart.getDatasetMeta(p.dsIndex)
        if (meta.hidden) return

        const indexOffset = i - (count - 1) / 2
        const pxPerMs = xScale.getPixelForValue(p.timeMs + 1) - xScale.getPixelForValue(p.timeMs)
        const maxOffsetMs = maxOffsetPx / pxPerMs
        const jitterTimeOffset = indexOffset * maxOffsetMs
        const jitteredTime = p.timeMs + jitterTimeOffset
        const jitteredX = xScale.getPixelForValue(jitteredTime)
        const yAxisID = datasets[p.dsIndex].yAxisID || 'y'
        const yScale = chart.scales[yAxisID]
        if (!yScale) return
        const yPixel = yScale.getPixelForValue(p.y)
        if (jitteredX < xScale.left || jitteredX > xScale.right) return
        if (yPixel < yScale.top || yPixel > yScale.bottom) return
        const color = datasets[p.dsIndex].borderColor || 'black'
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(jitteredX, yPixel, 3, 0, 2 * Math.PI)
        ctx.fill()
      })
    })

    ctx.restore()
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

  const [isChartReady] = useState(false)

  const [timeRange, setTimeRange] = useState(() => {
    return localStorage.getItem('timeRange') || '1h'
  })

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

    const isEqual =
      visibleZones.length === cameraZoneNames.length &&
      cameraZoneNames.every(name => visibleZones.includes(name))

    if (!isEqual) {
      setVisibleZones(cameraZoneNames)
      localStorage.setItem('visibleZones', JSON.stringify(cameraZoneNames))
    }
  }, [selectedCamera, allZones, visibleZones, setVisibleZones])

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
        localStorage.setItem('thermalHistory', JSON.stringify(updated))
        return updated
      })
    }
  }, [zones, selectedCamera])

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

  const timeMap = {
    '1h': 3600000,
    '3h': 3 * 3600000,
    '24h': 24 * 3600000,
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
    setAllZonesHidden(false)
  }

  const updateZoneVisibility = (zoneName, visible) => {
    setZonesVisibility(prev => {
      const updated = { ...prev, [zoneName]: visible }
      localStorage.setItem('zonesVisibility', JSON.stringify(updated))
      return updated
    })
  }

  const toggleAllZones = () => {
    if (allZonesHidden) {
      const newVisibility = {}
      allZoneNames.forEach(name => (newVisibility[name] = true))
      setZonesVisibility(newVisibility)
      setVisibleZones(allZoneNames)
      setAllZonesHidden(false)
      localStorage.setItem('zonesVisibility', JSON.stringify(newVisibility))
      localStorage.setItem('visibleZones', JSON.stringify(allZoneNames))
    } else {
      const newVisibility = {}
      allZoneNames.forEach(name => (newVisibility[name] = false))
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

  const handleResetZoom = () => {
    const chart = chartRef.current
    if (chart && chart.resetZoom) {
      chart.resetZoom()
    }
  }

  if (!history.length || !initialRange) {
    return <div style={{ padding: 20 }}>Waiting for data…</div>
  }

  const timeLimit = timeMap[timeRange] || timeMap['7d']
  const currentTime = Date.now()
  const rangeCutoff = currentTime - timeLimit

  const sorted = history
    .filter(entry => new Date(entry.time).getTime() >= rangeCutoff)
    .sort((a, b) => new Date(a.time) - new Date(b.time))

  const filteredZones = allZones.filter(
    z => z.camera === selectedCamera && zonesVisibility[z.name] !== false && visibleZones.includes(z.name)
  )
  const filteredNames = filteredZones.map(z => z.name)

  const offsetStep = 7

  const datasets = filteredZones
    .map((zone, idx) => {
      const zoneDataPoints = sorted
        .map(entry => {
          const val = entry.readings?.[zone.name]
          if (typeof val === 'number') {
            const yValue =
              tempUnit === 'F'
                ? Math.round(val)
                : Math.round(((val - 32) * 5) / 9)
            return { x: new Date(entry.time), y: yValue + idx * offsetStep }
          }
          return null
        })
        .filter(Boolean)

      if (zoneDataPoints.length === 0) return null

      const smoothed = smoothData(zoneDataPoints.slice(0, -1), 5)
      const combinedData = [...smoothed, zoneDataPoints[zoneDataPoints.length - 1]]

      const color = `hsl(${(idx * 45) % 360}, 60%, 50%)`

      return {
        label: zone.name,
        data: combinedData,
        borderColor: color,
        backgroundColor: 'transparent',
        spanGaps: true,
        pointRadius: 2,
        pointHoverRadius: 6,
        pointHitRadius: 10,
        pointBackgroundColor: color,
        pointBorderColor: color,
        pointBorderWidth: 1,
        yAxisID: 'y',
        order: 2,
        hidden: false,
      }
    })
    .filter(Boolean)

  const data = { datasets }

  const allYs = datasets.flatMap(ds => ds.data.map(p => p.y).filter(y => y != null))
  const yMinRaw = allYs.length ? Math.min(...allYs) : tempUnit === 'F' ? 120 : fToC(120)
  const yMaxRaw = allYs.length ? Math.max(...allYs) : tempUnit === 'F' ? 160 : fToC(160)

  const padding = tempUnit === 'F' ? 15 : fToC(15)

  const range = yMaxRaw - yMinRaw
  const stepCount = 7
  const stepSizeRaw = Math.max(
    Math.ceil(range / stepCount / (tempUnit === 'F' ? 5 : 3)) * (tempUnit === 'F' ? 5 : 3),
    1
  )

  const paddingMs = 30 * 60 * 1000

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

  if (timeRange === '24h') {
    extendedMax = currentTime
    extendedMin = currentTime - 24 * 60 * 60 * 1000
    startTime = extendedMin
  } else {
    startTime = roundDownToNearestMinute(currentTime - timeLimit)
    extendedMin = Math.max(dataMinTime - paddingMs, startTime)
    extendedMax = Math.min(dataMaxTime + paddingMs, currentTime)
  }

  function clampZoomPan(chart) {
    const xScale = chart.scales.x
    if (!xScale) return

    const allPoints = chart.data.datasets.flatMap(ds => ds.data)
    if (allPoints.length === 0) return

    const times = allPoints.map(p => new Date(p.x).getTime()).sort((a, b) => a - b)
    const minTime = times[0]
    const now = Date.now()

    let newMin = xScale.min
    let newMax = xScale.max
    const windowWidth = newMax - newMin

    if (newMax > now) {
      newMax = now
      newMin = newMax - windowWidth
      if (newMin < minTime) newMin = minTime
    }

    if (newMin < minTime) {
      newMin = minTime
      newMax = newMin + windowWidth
      if (newMax > now) newMax = now
    }

    xScale.options.min = newMin
    xScale.options.max = newMax
  }

  function onLegendClick(e, legendItem, legend) {
    const zoneName = legendItem.text
    const currentlyVisible = zonesVisibility[zoneName] !== false

    const updatedVisibility = {
      ...zonesVisibility,
      [zoneName]: !currentlyVisible
    }
    setZonesVisibility(updatedVisibility)

    if (currentlyVisible) {
      setVisibleZones(prev => prev.filter(name => name !== zoneName))
      localStorage.setItem('visibleZones', JSON.stringify(visibleZones.filter(name => name !== zoneName)))
    } else {
      setVisibleZones(prev => [...prev, zoneName])
      localStorage.setItem('visibleZones', JSON.stringify([...visibleZones, zoneName]))
    }

    const allHidden = Object.values(updatedVisibility).every(v => v === false)
    setAllZonesHidden(allHidden)
    localStorage.setItem('allZonesHidden', JSON.stringify(allHidden))
  }

  const mergedOptions = {
    maintainAspectRatio: true,
    aspectRatio: 2.8,
    layout: {
      padding: {
        top: 10,
        bottom: 10,
        left: 20,
        right: 20,
      },
    },
    animation: { duration: 0 },
    elements: {
      line: {
        tension: 0.3,
        borderWidth: 2.5,
      },
      point: {
        radius: 3,
        hoverRadius: 7,
        hitRadius: 12,
      },
    },
    plugins: {
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
          threshold: 10,
          onZoom: ({ chart }) => {
            clampZoomPan(chart)
          },
        },
        pan: {
          enabled: true,
          mode: 'x',
          onPan: ({ chart }) => {
            clampZoomPan(chart)
          },
        },
        limits: {
          x: {
            min: timeRange === '24h' ? currentTime - 24 * 60 * 60 * 1000 : extendedMin,
            max: timeRange === '24h' ? currentTime : extendedMax,
          },
        },
      },
      jitterPlugin: { isChartReady },
      title: {
        display: true,
        text: 'Temperature Data',
        position: 'top',
        font: { size: 18, family: 'Segoe UI', weight: 'bold' },
        padding: { top: 4, bottom: 10 },
        color: isDarkMode ? '#ccc' : '#222',
      },
      legend: {
        labels: {
          usePointStyle: false,
          boxWidth: 20,
          boxHeight: 10,
          font: { size: 15, family: 'Segoe UI' },
          color: isDarkMode ? '#fff' : '#000',
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
            } else if (timeRange === '24h') {
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
            const rawValue = context.parsed.y - context.datasetIndex * offsetStep
            return `${zoneName}: ${Math.round(rawValue)}°${tempUnit}`
          },
        },
      },
    },
    hover: { mode: 'nearest', intersect: true },
    scales: {
      x: {
        type: 'time',
        bounds: 'ticks',
        reverse: false,
        min: timeRange === '24h' ? currentTime - 24 * 60 * 60 * 1000 : extendedMin,
        max: timeRange === '24h' ? currentTime : extendedMax,
        time: timeRange === '24h'
          ? {
              unit: 'minute',
              stepSize: 60,
              tooltipFormat: 'h:mm a MMM d',
              displayFormats: {
                minute: 'h:mm a',
                hour: 'MMM d, h a',
                day: 'MMM d, yyyy',
              },
            }
          : {
              unit:
                timeRange === '1h'
                  ? 'minute'
                  : timeRange === '3h'
                  ? 'minute'
                  : timeRange === '2d'
                  ? 'hour'
                  : timeRange === '4d'
                  ? 'hour'
                  : 'day',
              stepSize:
                timeRange === '1h'
                  ? 2
                  : timeRange === '3h'
                  ? 3
                  : timeRange === '2d'
                  ? 6
                  : timeRange === '4d'
                  ? 12
                  : 1,
              tooltipFormat:
                timeRange === '1h' || timeRange === '3h'
                  ? 'h:mm a'
                  : 'MMM d, yyyy',
              displayFormats: {
                minute: 'h:mm a',
                hour: 'MMM d, h a',
                day: 'MMM d, yyyy',
              },
            },
        ticks: timeRange === '24h'
          ? {
              source: 'auto',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 13, family: 'Segoe UI' },
              color: isDarkMode ? '#ccc' : '#222',
              values: (() => {
                const ticks = []
                const now = new Date(currentTime)
                // Do NOT round to 0 seconds, just use the current minute
                const minute = now.getMinutes()
                const hour = now.getHours()
                now.setSeconds(0, 0) // Optionally keep this, it should not skip the minute!
                const base = new Date(now)
                base.setHours(hour, minute, 0, 0)
                const start = new Date(base.getTime() - 24 * 60 * 60 * 1000)
                for (let i = 0; i <= 24; i++) {
                  const tick = new Date(start.getTime() + i * 60 * 60 * 1000)
                  ticks.push(tick.getTime())
                }
                return ticks
              })(),
              callback(value) {
                const date = new Date(value)
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
                if (['2d', '4d', '7d', '2w', '1m', '1y'].includes(timeRange)) {
                  return date.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                } else {
                  let hours = date.getHours()
                  const minutes = String(date.getMinutes()).padStart(2, '0')
                  const ampm = hours >= 12 ? 'PM' : 'AM'
                  hours = hours % 12 || 12
                  return `${hours}:${minutes} ${ampm}`
                }
              },
            },
        grid: {
          display: true,
          color: isDarkMode ? '#2226' : '#ccc7',
          drawTicks: false,
          drawBorder: false,
        },
        title: {
          display: true,
          text: 'Time',
          font: { size: 15, family: 'Segoe UI', weight: 'bold' },
          color: isDarkMode ? '#ccc' : '#222',
        },
      },
      y: {
        min: 20,
        max: 120,
        grid: {
          display: true,
          drawTicks: false,
          drawOnChartArea: true,
          drawBorder: false,
          color: isDarkMode ? '#2226' : '#ccc7',
          borderColor: isDarkMode ? '#666' : '#999',
        },
        ticks: {
          stepSize: 1,
          maxTicksLimit: 0,
          color: isDarkMode ? '#ccc' : '#222',
          font: { size: 13, family: 'Segoe UI' },
          callback: function (value) {
            return `${Math.round(value)}°${tempUnit}`
          },
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
    <div
      style={{
        padding: 24,
        height: 800,
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: isDarkMode ? '#0f172a' : '#f7fdfb',
        borderRadius: 12,
        boxShadow: isDarkMode
          ? '0 4px 16px rgba(15, 23, 42, 0.8)'
          : '0 4px 16px rgba(0,0,0,0.05)',
        position: 'relative',
      }}
    >
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <button
          onClick={() => handleCameraChange('planck_1')}
          style={{
            padding: '8px 16px',
            backgroundColor: selectedCamera === 'planck_1' ? '#4caf50' : '#e0e0e0',
            color: selectedCamera === 'planck_1' ? 'white' : 'black',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          <span>📷 Left Camera</span>
        </button>
        <button
          onClick={() => handleCameraChange('planck_2')}
          style={{
            padding: '8px 16px',
            backgroundColor: selectedCamera === 'planck_2' ? '#4caf50' : '#e0e0e0',
            color: selectedCamera === 'planck_2' ? 'white' : 'black',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          <span>📷 Right Camera</span>
        </button>
      </div>

      <Line ref={chartRef} data={data} options={mergedOptions} />

      <div
        className="chart-button-container"
        style={{
          position: 'relative',
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
            <div
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
            borderColor: isDarkMode ? '#fff' : '#000',
            color: isDarkMode ? '#fff' : '#000',
          }}
        >
          <span>{allZonesHidden ? 'Show All Zones' : 'Hide All Zones'}</span>
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
          <option value="1h">Last Hour</option>
          <option value="3h">Last 3 Hours</option>
          <option value="24h">Last 24 Hours</option>
          <option value="2d">Last 2 Days</option>
          <option value="4d">Last 4 Days</option>
          <option value="7d">Last 7 Days</option>
          <option value="2w">Last 2 Weeks</option>
          <option value="1m">Last Month</option>
          <option value="1y">Last Year</option>
        </select>
      </div>
    </div>
  )
}

