// src/components/ThermalPlot.js

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
  Legend
} from 'chart.js'
import zoomPlugin, { zoom } from 'chartjs-plugin-zoom'
import 'chartjs-adapter-date-fns'
import '../styles/thermaldata.css'

ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
)

export default function ThermalPlot({
  zones = [],
  visibleZones = [],
  setVisibleZones,
  allZones = []
}) {
  const chartRef = useRef(null)

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('thermalHistory')
    return saved
      ? JSON.parse(saved, (key, v) => (key === 'time' ? new Date(v) : v))
      : []
  })

  const [selectedCamera, setSelectedCamera] = useState(
    () => localStorage.getItem('selectedCamera') || 'left'
  )
  const [chartOptions, setChartOptions] = useState(null)
  const [initialRange, setInitialRange] = useState(null)
  const [timeRange, setTimeRange] = useState('1h')
  const [showExportMenu, setShowExportMenu] = useState(false)

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
    fetch('/thermaldata.json')
      .then(r => r.json())
      .then(opt => setChartOptions(opt))
      .catch(console.error)
  }, [])

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

  const handleCameraChange = cam => {
    setSelectedCamera(cam)
    localStorage.setItem('selectedCamera', cam)
    const current = allZones.filter(z => z.camera === cam).map(z => z.name)
    setVisibleZones(current)
  }

  const handleHideAll = () => {
    const chart = chartRef.current
    if (!chart) return
    chart.data.datasets.forEach((ds, idx) => {
      ds.hidden = true
      chart.getDatasetMeta(idx).hidden = true
    })
    chart.update()
  }

  const handleShowAll = () => {
    const chart = chartRef.current
    if (!chart) return
    chart.data.datasets.forEach((ds, idx) => {
      ds.hidden = false
      chart.getDatasetMeta(idx).hidden = false
    })
    chart.update()
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

  const handleZoomIn = () => {
    const chart = chartRef.current
    if (chart) {
      zoom(chart, { x: { scale: 'x', factor: 1.2 } })
    }
  }

  const handleResetZoom = () => {
    const chart = chartRef.current
    if (chart && chart.resetZoom) {
      chart.resetZoom()
    }
  }

  if (!history.length || !chartOptions || !initialRange) {
    return <div style={{ padding: 20 }}>Waiting for data…</div>
  }

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
    const timeLimit = timeMap[timeRange] || timeMap['7d']
    const currentTime = Date.now()
    const rangeCutoff = currentTime - timeLimit
    
    const sorted = history
      .filter(entry => new Date(entry.time).getTime() >= rangeCutoff)
      .sort((a, b) => new Date(a.time) - new Date(b.time))
    
    let xMin, xMax
    
    if (['1h', '3h', '24h', '2d'].includes(timeRange)) {
      const hours =
        timeRange === '24h' ? 24 :
        timeRange === '3h' ? 3 :
        timeRange === '2d' ? 48 :
        1
    
      xMin = new Date(currentTime - hours * 60 * 60 * 1000)
      xMin.setSeconds(0, 0)
    
      xMax = new Date(currentTime)
      xMax.setSeconds(0, 0)
      if (xMax.getTime() < currentTime) {
        xMax.setMinutes(xMax.getMinutes() + 1)
      }
    
      xMin = xMin.getTime()
      xMax = xMax.getTime()
    } else {
      xMin = rangeCutoff
      xMax = currentTime
    
      const span = xMax - xMin
      const basePadding = span * 0.05
      xMin -= basePadding
      xMax += basePadding
    }
    
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
      
  const datasets = filteredNames.map((name, idx) => {
    const color = `hsl(${(idx * 45) % 360},60%,50%)`
    return {
      label: name,
      data: sorted.map(pt => ({
        x: new Date(pt.time),
        y: (pt.readings && pt.readings[name] !== undefined) ? pt.readings[name] : null
      })),
      borderColor: color,
      backgroundColor: 'transparent',
      spanGaps: true,
      pointRadius: 4,
      pointHoverRadius: 8,
      pointHitRadius: 10,
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointBorderWidth: 1
    }
  })
  

  const data = { datasets }

  const mergedOptions = {
    ...chartOptions,
    elements: chartOptions.elements,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Temperature Data',
        position: 'top',
        font: { size: 16, family: 'Segoe UI', weight: 'bold' },
        padding: { top: 0, bottom: 12 }
      },
      legend: {
        ...chartOptions.plugins.legend,
        labels: {
          ...chartOptions.plugins.legend.labels,
          usePointStyle: false,
          boxWidth: 20,
          boxHeight: 10
        },
        onClick: (e, legendItem, legend) => {
          const ci = legend.chart
          const meta = ci.getDatasetMeta(legendItem.datasetIndex)
          meta.hidden = !meta.hidden
          ci.update()
        }
      },
      tooltip: {
        mode: 'index',
        axis: 'x',
        intersect: false,
        ...(chartOptions.plugins.tooltip || {}),
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
                const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                return `${time}\n${day}`
              }
              return time
            }
          }
        }
      },
      zoom: {
        zoom: {
          wheel: { enabled: false },
          pinch: { enabled: false },
          mode: 'x'
        },
        pan: { enabled: false, mode: 'x' }
      }
    },
    hover: { mode: 'nearest', intersect: true },
    scales: {
      x: {
        type: 'time',
        min: xMin,
        max: xMax,
        bounds: 'ticks',
        reverse: false,
        time: {
          unit: 'minute',
          stepSize: timeRange === '1h' ? 10 : timeRange === '3h' ? 30 : undefined,
          tooltipFormat: timeRange === '1h' || timeRange === '3h' ? 'h:mm a' : 'MMM d, yyyy',
          displayFormats: {
            minute: 'h:mm a',
            hour: 'MMM d, h a',
            day: 'MMM d, yyyy'
          }
        },
        ticks: {
          source: 'auto',
          autoSkip: true,
          maxRotation: 0,
          font: {
            size: 12,
            family: 'Segoe UI'
          },
          callback: function (value) {
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
                const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                return [time, day]
              }
              return time
            }
          }
        },
        grid: {
          display: false
        },
        title: {
          display: true,
          text: 'Time',
          font: { size: 14, family: 'Segoe UI', weight: 'bold' }
        }
      },
      y: {
        ...chartOptions.scales.y,
        grid: { display: false },
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: v => `${v}°F`
        }
      }
    }
  }
  
  return (
    <div style={{
      padding: 24,
      height: 550,
      width: '100%',
      boxSizing: 'border-box',
      backgroundColor: '#f7fdfb',
      borderRadius: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
      position: 'relative'
    }}>
      <div style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'center',
        gap: 10
      }}>
        <button onClick={() => handleCameraChange('left')} style={{
          padding: '8px 16px',
          backgroundColor: selectedCamera === 'left' ? '#4caf50' : '#e0e0e0',
          color: selectedCamera === 'left' ? 'white' : 'black',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer'
        }}>📷 Left Camera</button>
        <button onClick={() => handleCameraChange('right')} style={{
          padding: '8px 16px',
          backgroundColor: selectedCamera === 'right' ? '#4caf50' : '#e0e0e0',
          color: selectedCamera === 'right' ? 'white' : 'black',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer'
        }}>📷 Right Camera</button>
      </div>

      <Line ref={chartRef} data={data} options={mergedOptions} />

      <div className="chart-button-container" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button className="chart-button" onClick={() => setShowExportMenu(prev => !prev)}>
            Save Graph ▼
          </button>
          {showExportMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              backgroundColor: '#fff',
              boxShadow: '0px 4px 8px rgba(0,0,0,0.15)',
              zIndex: 10,
              borderRadius: 4,
              minWidth: 160,
              maxHeight: 120,
              overflowY: 'auto'
            }}>
              <div onClick={() => { setShowExportMenu(false); handleSaveGraph() }} style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee' }}>Save as PNG</div>
              <div onClick={() => { setShowExportMenu(false); handleExportCSV() }} style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee' }}>Save as CSV</div>
              <div onClick={() => { setShowExportMenu(false); handleExportPDF() }} style={{ padding: 8, cursor: 'pointer' }}>Save as PDF</div>
            </div>
          )}
        </div>

        <button onClick={handleResetZoom} className="chart-button">Reset Zoom</button>
        <button onClick={handleHideAll} className="chart-button">Hide All Zones</button>
        <button onClick={handleShowAll} className="chart-button">Show All Zones</button>
        <select className="chart-dropdown" value={timeRange} onChange={e => setTimeRange(e.target.value)}>
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
