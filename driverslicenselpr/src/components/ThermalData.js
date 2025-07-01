// src/components/ThermalData.js

import React from 'react';
import '../styles/thermaldata.css';
import LineChart from './images/LineChart.png';

const labels = [
  { color: '#ef476f', text: 'Area10' },
  { color: '#118ab2', text: 'Area11' },
  { color: '#06d6a0', text: 'Area9' },
  { color: '#9d4edd', text: 'Crossarm' },
  { color: '#f79d65', text: 'HV1' },
  { color: '#6650a4', text: 'HV2' },
  { color: '#3d3d3d', text: 'LV1' },
  { color: '#ef233c', text: 'Global' }
];

export default function ThermalData({ isDarkMode }) {
  return (
    <div className="thermal-data-container">
      <div className="legend">
        {labels.map((label, index) => (
          <div key={index} className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: label.color }}
            ></span>
            <span className="legend-label">{label.text}</span>
          </div>
        ))}
      </div>

      <div className={`thermal-chart-wrapper ${isDarkMode ? 'darken' : ''}`}>
        <img
          src={LineChart}
          alt="Line Chart"
          className="thermal-chart-image"
        />
        <div className="overlay-text">
          <p>Thermal Analysis Overview</p>
        </div>
      </div>
    </div>
  );
}
