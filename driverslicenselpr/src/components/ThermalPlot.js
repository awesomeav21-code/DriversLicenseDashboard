// src/components/ThermalPlot.js

import React, { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js'
import 'chartjs-adapter-date-fns'

ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
)

export default function ThermalPlot({ zones = [], visibleZones = [] }) {
  const [history, setHistory] = useState([])
  const [selectedCamera, setSelectedCamera] = useState('left')

  // Build history only when zones change
  useEffect(() => {
    const now = new Date()
    const readings = {}
    zones.forEach(z => {
      if (visibleZones.includes(z.name)) {
        readings[z.name] = z.temperature
      }
    })
    setHistory(prev => {
      const cutoffHour = Date.now() - 60 * 60 * 1000
      const recent = prev.filter(e => e.time.getTime() >= cutoffHour)
      return recent.concat({ time: now, readings })
    })
  }, [zones])

  if (!history.length) {
    return <div style={{ padding: 20 }}>Waiting for data…</div>
  }

  // only keep last 15 minutes worth of entries
  const WINDOW_MS = 15 * 60 * 1000
  const windowStart = Date.now() - WINDOW_MS
  const windowed = history.filter(e => e.time.getTime() >= windowStart)
  const sorted = windowed.slice().sort((a, b) => a.time - b.time)

  // compute explicit axis bounds so the first point sits at left edge
  const firstTimeMs = sorted[0].time.getTime()
  const lastTimeMs = firstTimeMs + WINDOW_MS

  const filteredNames = zones
    .filter(z => z.camera === selectedCamera && visibleZones.includes(z.name))
    .map(z => z.name)

  const datasets = filteredNames.map((name, idx) => ({
    label: name,
    data: sorted.map(pt => ({
      x: pt.time,
      y: pt.readings[name] ?? null
    })),
    borderColor: `hsl(${(idx * 45) % 360},60%,50%)`,
    backgroundColor: 'transparent',
    borderWidth: 2,
    tension: 0.3,
    spanGaps: true
  }))

  const data = { datasets }

  const options = {
    parsing: false,
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          stepSize: 2,
          tooltipFormat: 'PPpp'
        },
        // anchor axis to 15-minute window beginning at firstTimeMs
        min: firstTimeMs,
        max: lastTimeMs,
        reverse: false,
        ticks: {
          maxTicksLimit: 10,
          autoSkip: false
        },
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        min: 100,
        max: 160,
        ticks: {
          stepSize: 5,
          callback: v => `${v}°F`
        },
        title: {
          display: true,
          text: 'Temperature (°F)'
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    }
  }

  return (
    <div style={{ padding: 20, height: 550 }}>
      <h2 style={{ marginBottom: 16 }}>Temperature Data</h2>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setSelectedCamera('left')}
          style={{
            marginRight: 10,
            padding: '8px 16px',
            backgroundColor: selectedCamera === 'left' ? '#4caf50' : '#e0e0e0',
            color: selectedCamera === 'left' ? 'white' : 'black',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Left Camera
        </button>
        <button
          onClick={() => setSelectedCamera('right')}
          style={{
            padding: '8px 16px',
            backgroundColor: selectedCamera === 'right' ? '#4caf50' : '#e0e0e0',
            color: selectedCamera === 'right' ? 'white' : 'black',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Right Camera
        </button>
      </div>

      <Line data={data} options={options} />
    </div>
  )
}
