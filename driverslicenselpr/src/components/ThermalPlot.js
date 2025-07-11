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

// Updated jitter plugin: draws jitter dots after everything else
const jitterPlugin = {
  id: 'jitterPlugin',

  afterDraw(chart) {
    if (!chart.options.plugins.jitterPlugin?.isChartReady) return
    if (chart._zooming || chart._panning) return // skip during zoom/pan

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
      const maxOffset = maxOffsetBase * scaleFactor

      points.forEach((p, i) => {
        const meta = chart.getDatasetMeta(p.dsIndex)
        if (meta.hidden) return

        const offsetPx = ((i - (count - 1) / 2) * maxOffset) / ((count - 1) / 2)
        const originalX = xScale.getPixelForValue(p.timeMs)

        const yAxisID = datasets[p.dsIndex].yAxisID || 'y'
        const yScale = chart.scales[yAxisID]
        if (!yScale) return

        const jitteredX = originalX + offsetPx
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

// Simple Moving Average smoothing function
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
  visibleZones = [],
  setVisibleZones,
  allZones = [],
  tempUnit = 'F',
  isDarkMode = false
}) {
  const chartRef = useRef(null)
  const [isChartReady, setIsChartReady] = useState(false)

  useEffect(() => {
    const chart = chartRef.current?.chartInstance || chartRef.current
    if (!chart) return

    function onZoomStart() {
      chart._zooming = true
    }
    function onZoomEnd() {
      chart._zooming = false
      chart.update()
    }
    function onPanStart() {
      chart._panning = true
    }
    function onPanEnd() {
      chart._panning = false
      chart.update()
    }

    chart.options.plugins.zoom.zoom.onZoomStart = onZoomStart
    chart.options.plugins.zoom.zoom.onZoomComplete = onZoomEnd
    chart.options.plugins.zoom.pan.onPanStart = onPanStart
    chart.options.plugins.zoom.pan.onPanComplete = onPanEnd

    const readyTimeout = setTimeout(() => setIsChartReady(true), 600)
    return () => clearTimeout(readyTimeout)
  }, [])

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

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('thermalHistory')
    return saved
      ? JSON.parse(saved, (key, v) => (key === 'time' ? new Date(v) : v))
      : []
  })

  const [selectedCamera, setSelectedCamera] = useState(() =>
    localStorage.getItem('selectedCamera') || 'left'
  )

  const [initialRange, setInitialRange] = useState(null)
  const [timeRange, setTimeRange] = useState('1h')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [allZonesHidden, setAllZonesHidden] = useState(false)

  const fToC = f => Math.round(((f - 32) * 5) / 9)

  const updateHistory = camera => {
    const now = new Date()
    const readings = {}
    zones
      .filter(z => z.camera === camera && visibleZones.includes(z.name))
      .forEach(z => {
        readings[z.name] = z.temperature
      })
    setHistory(prev => {
      const updated = [...prev, { time: now, readings }]
      if (updated.length > 1000) updated.shift()
      localStorage.setItem('thermalHistory', JSON.stringify(updated))
      return updated
    })
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      updateHistory(selectedCamera)
    }, 0)
    return () => clearTimeout(timeout)
  }, [zones, visibleZones, selectedCamera])

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

  const handleCameraChange = cam => {
    setSelectedCamera(cam)
    localStorage.setItem('selectedCamera', cam)
    const current = allZones.filter(z => z.camera === cam).map(z => z.name)
    setVisibleZones(current)
    setAllZonesHidden(false)
  }

  const toggleAllZones = () => {
    const chart = chartRef.current
    if (!chart) return
    const hide = !allZonesHidden
    chart.data.datasets.forEach((ds, idx) => {
      ds.hidden = hide
      chart.getDatasetMeta(idx).hidden = hide
    })
    chart.update()
    setAllZonesHidden(hide)
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
    URL.revokeObjectURL(url)
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

  const filteredNames = Array.from(
    new Set(
      history.flatMap(entry =>
        Object.keys(entry.readings || {}).filter(name => {
          const z = allZones.find(z => z.name === name)
          return z && z.camera === selectedCamera && visibleZones.includes(name)
        })
      )
    )
  )

  const offsetStep = 5 // vertical offset between lines

  // Build smoothed + offset datasets here:
  const datasets = filteredNames.map((name, idx) => {
    const color = `hsl(${(idx * 45) % 360},60%,50%)`
    const rawData = sorted.map(pt => {
      if (pt.readings && pt.readings[name] !== undefined) {
        const baseValue = tempUnit === 'F' ? pt.readings[name] : fToC(pt.readings[name])
        return {
          x: new Date(pt.time),
          y: baseValue + idx * offsetStep // apply vertical offset per dataset
        }
      }
      return { x: new Date(pt.time), y: null }
    })
    const smoothedData = smoothData(rawData, 5) // smoothing window of 5 points

    return {
      label: name,
      data: smoothedData,
      borderColor: color,
      backgroundColor: 'transparent',
      spanGaps: true,
      pointRadius: 0,      // hide points to reduce clutter
      pointHoverRadius: 6, // show points on hover
      pointHitRadius: 10,
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointBorderWidth: 1,
      yAxisID: 'y',
      order: 2 // draw above grid and axes
    }
  })

  const allYValues = datasets.flatMap(ds =>
    ds.data.map(pt => pt.y).filter(y => y !== null)
  )
  const yMin = Math.min(...allYValues)
  const yMax = Math.max(...allYValues)
  const yPadding = (yMax - yMin) * 0.15 || 10
  const yAxisMin = yMin - yPadding
  const yAxisMax = yMax + yPadding

  // Explicit labels from sorted timestamps:
  const labels = sorted.map(pt => new Date(pt.time))

  const data = { labels, datasets }

  const mergedOptions = {
    maintainAspectRatio: false,
    elements: {
      line: {
        tension: 0.3,
        borderWidth: 2
      },
      point: {
        radius: 0,
        hoverRadius: 6,
        hitRadius: 10
      }
    },
    plugins: {
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
          limits: {
            x: {
              min: initialRange.min,
              max: initialRange.max
            }
          }
        },
        pan: {
          enabled: true,
          mode: 'x',
          limits: {
            x: {
              min: initialRange.min,
              max: initialRange.max
            }
          }
        }
      },
      jitterPlugin: { isChartReady },
      title: {
        display: true,
        text: 'Temperature Data',
        position: 'top',
        font: { size: 16, family: 'Segoe UI', weight: 'bold' },
        padding: { top: 0, bottom: 12 },
        color: isDarkMode ? '#ccc' : '#222'
      },
      legend: {
        labels: {
          usePointStyle: false,
          boxWidth: 20,
          boxHeight: 10,
          color: isDarkMode ? '#fff' : '#000'
        },
        onClick: (e, legendItem, legend) => {
          const ci = legend.chart
          const meta = ci.getDatasetMeta(legendItem.datasetIndex)
          meta.hidden = !meta.hidden
          ci.update()
        }
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
        callbacks: {
          title: function (tooltipItems) {
            const date = new Date(tooltipItems[0].parsed.x)
            if (['2d', '4d', '7d', '2w', '1m', '1y'].includes(timeRange)) {
              return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })
            } else {
              let hours = date.getHours()
              const minutes = String(date.getMinutes()).padStart(2, '0')
              const ampm = hours >= 12 ? 'PM' : 'AM'
              hours = hours % 12 || 12
              const time = `${hours}:${minutes} ${ampm}`
              if (['24h', '2d'].includes(timeRange)) {
                const day = date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                })
                return `${time}\n${day}`
              }
              return time
            }
          },
          label: function (context) {
            const zoneName = context.dataset.label || ''
            const value = context.parsed.y - context.datasetIndex * offsetStep
            return `${zoneName}: ${Math.round(value)}°${tempUnit}`
          }
        }
      }
    },
    hover: { mode: 'nearest', intersect: true },
    scales: {
      x: {
        type: 'time',
        bounds: 'ticks',
        reverse: false,
        time: {
          unit:
            timeRange === '1h'
              ? 'minute'
              : timeRange === '3h'
              ? 'minute'
              : timeRange === '24h'
              ? 'hour'
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
              : timeRange === '24h'
              ? 3
              : timeRange === '2d'
              ? 6
              : timeRange === '4d'
              ? 12
              : 1,
          tooltipFormat:
            timeRange === '1h' || timeRange === '3h' ? 'h:mm a' : 'MMM d, yyyy',
          displayFormats: {
            minute: 'h:mm a',
            hour: 'MMM d, h a',
            day: 'MMM d, yyyy'
          }
        },
        ticks: {
          source: 'labels',
          autoSkip: true,
          maxTicksLimit: ['24h', '2d'].includes(timeRange) ? 6 : 12,
          autoSkipPadding: ['24h', '2d'].includes(timeRange) ? 30 : 20,
          maxRotation: ['24h', '2d'].includes(timeRange) ? 90 : 45,
          minRotation: ['24h', '2d'].includes(timeRange) ? 60 : 30,
          font: { size: 12, family: 'Segoe UI' },
          color: isDarkMode ? '#ccc' : '#222',
          callback(value) {
            const date = new Date(value)
            if (['2d', '4d', '7d', '2w', '1m', '1y'].includes(timeRange)) {
              return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })
            } else {
              let hours = date.getHours()
              const minutes = String(date.getMinutes()).padStart(2, '0')
              const ampm = hours >= 12 ? 'PM' : 'AM'
              hours = hours % 12 || 12
              const time = `${hours}:${minutes} ${ampm}`
              if (['24h', '2d'].includes(timeRange)) {
                const day = date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                })
                return [time, day]
              }
              return time
            }
          }
        },
        grid: { display: false },
        title: {
          display: true,
          text: 'Time',
          font: { size: 14, family: 'Segoe UI', weight: 'bold' },
          color: isDarkMode ? '#ccc' : '#222'
        },
        min: initialRange.min,
        max: initialRange.max
      },
      y: {
        min: yAxisMin,
        max: yAxisMax,
        grid: {
          display: true,
          drawTicks: true,
          drawOnChartArea: true,
          drawBorder: true,
          color: isDarkMode ? '#444' : '#ccc',
          borderColor: isDarkMode ? '#666' : '#999'
        },
        ticks: {
          stepSize: tempUnit === 'F' ? 20 : 10,
          color: isDarkMode ? '#ccc' : '#222',
          callback: v => `${v.toFixed(0)}°${tempUnit}`
        },
        title: {
          display: true,
          text: 'Temperature',
          color: isDarkMode ? '#ccc' : '#222',
          font: { family: 'Segoe UI', size: 14 }
        }
      }
    }
  }

  return (
    <div
      style={{
        padding: 24,
        height: 500,  // Reduced from 900 for smaller vertical size
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: isDarkMode ? '#0f172a' : '#f7fdfb',
        borderRadius: 12,
        boxShadow: isDarkMode
          ? '0 4px 16px rgba(15, 23, 42, 0.8)'
          : '0 4px 16px rgba(0,0,0,0.05)',
        position: 'relative'
      }}
    >
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'center',
          gap: 10
        }}
      >
        <button
          onClick={() => handleCameraChange('left')}
          style={{
            padding: '8px 16px',
            backgroundColor: selectedCamera === 'left' ? '#4caf50' : '#e0e0e0',
            color: selectedCamera === 'left' ? 'white' : 'black',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          <span>📷 Left Camera</span>
        </button>
        <button
          onClick={() => handleCameraChange('right')}
          style={{
            padding: '8px 16px',
            backgroundColor: selectedCamera === 'right' ? '#4caf50' : '#e0e0e0',
            color: selectedCamera === 'right' ? 'white' : 'black',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
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
          color: isDarkMode ? '#eee' : undefined
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            className="chart-button"
            onClick={() => setShowExportMenu(prev => !prev)}
            style={{
              borderColor: isDarkMode ? '#fff' : '#000',
              color: isDarkMode ? '#fff' : '#000'
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
                color: isDarkMode ? '#eee' : '#222'
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
            color: isDarkMode ? '#fff' : '#000'
          }}
        >
          <span>Reset Zoom</span>
        </button>

        <button
          onClick={toggleAllZones}
          className="chart-button"
          style={{
            borderColor: isDarkMode ? '#fff' : '#000',
            color: isDarkMode ? '#fff' : '#000'
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
            cursor: 'pointer'
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
