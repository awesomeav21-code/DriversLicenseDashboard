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
  const [chartOptions, setChartOptions] = useState(null)

  // Load chart options from thermaldata.json
  useEffect(() => {
    fetch('/thermaldata.json')
      .then(res => res.json())
      .then(opt => setChartOptions(opt))
      .catch(err => console.error('Failed to load thermaldata.json:', err))
  }, [])

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('thermalHistory')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const revived = parsed.map(e => ({
          ...e,
          time: new Date(e.time)
        }))
        setHistory(revived)
      } catch (e) {
        console.error('Failed to parse stored history:', e)
      }
    }
  }, [])

  // Update history with new readings from zones
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
      const updated = recent.concat({ time: now, readings })
      localStorage.setItem('thermalHistory', JSON.stringify(updated))
      return updated
    })
  }, [zones, visibleZones])

  if (!history.length || !chartOptions) {
    return <div style={{ padding: 20 }}>Waiting for data…</div>
  }

  const WINDOW_MS = 15 * 60 * 1000
  const windowStart = Date.now() - WINDOW_MS
  const windowed = history.filter(e => e.time.getTime() >= windowStart)
  const sorted = windowed.slice().sort((a, b) => a.time - b.time)

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
    tension: 0.4,
    pointRadius: 3,
    pointHoverRadius: 6,
    spanGaps: true
  }))

  const data = { datasets }

  const mergedOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        min: firstTimeMs,
        max: lastTimeMs
      },
      y: {
        ...chartOptions.scales.y,
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
      backgroundColor: '#f7fdfb',
      borderRadius: 12,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
    }}>
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

      <Line data={data} options={mergedOptions} />
    </div>
  )
}
