// src/components/ThermalData.js
import React from 'react';
import '../styles/thermaldata.css';

const dataSeries = [
  { name: "Area10", color: "#ef476f", values: [70, 75, 80, 78, 85, 90, 88, 92] },
  { name: "Area11", color: "#118ab2", values: [72, 74, 78, 80, 82, 85, 87, 88] },
  { name: "Area9", color: "#06d6a0", values: [74, 76, 79, 83, 85, 84, 86, 89] },
  { name: "Crossarm", color: "#9d4edd", values: [73, 75, 77, 78, 81, 82, 84, 85] },
  { name: "HV1", color: "#f79d65", values: [76, 78, 80, 82, 84, 86, 87, 89] },
  { name: "HV2", color: "#6650a4", values: [68, 70, 73, 75, 78, 80, 82, 85] },
  { name: "LV1", color: "#3d3d3d", values: [66, 67, 69, 71, 73, 74, 75, 76] },
  { name: "Global", color: "#ef233c", values: [71, 73, 76, 78, 80, 82, 84, 86] }
];

export default function ThermalData() {
  const chartWidth = 800;
  const chartHeight = 400;
  const padding = 50;
  const maxTemp = 100;
  const minTemp = 60;
  const points = 8;

  const getY = (val) =>
    padding + ((maxTemp - val) / (maxTemp - minTemp)) * (chartHeight - 2 * padding);

  const getX = (i) =>
    padding + (i * (chartWidth - 2 * padding)) / (points - 1);

  return (
    <div className="thermal-data-container">
      <h2 className="thermal-heading">Temperature Data</h2>
      <svg width={chartWidth} height={chartHeight}>
        {/* Gridlines */}
        {[...Array(5)].map((_, i) => {
          const y = padding + (i * (chartHeight - 2 * padding)) / 4;
          return (
            <line
              key={i}
              x1={padding}
              x2={chartWidth - padding}
              y1={y}
              y2={y}
              stroke="#ccc"
              strokeDasharray="4"
            />
          );
        })}

        {/* Y-axis Labels */}
        {[...Array(5)].map((_, i) => {
          const temp = maxTemp - (i * (maxTemp - minTemp)) / 4;
          const y = padding + (i * (chartHeight - 2 * padding)) / 4 + 4;
          return (
            <text
              key={i}
              x={10}
              y={y}
              fontSize="12"
              fill="#666"
            >
              {temp}°F
            </text>
          );
        })}

        {/* X-axis Labels */}
        {[...Array(points)].map((_, i) => {
          const x = getX(i);
          return (
            <text
              key={i}
              x={x}
              y={chartHeight - 10}
              fontSize="12"
              textAnchor="middle"
              fill="#666"
            >
              Jun {12 + i}
            </text>
          );
        })}

        {/* Lines */}
        {dataSeries.map((series, idx) => (
          <polyline
            key={idx}
            fill="none"
            stroke={series.color}
            strokeWidth="2"
            points={series.values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ')}
          />
        ))}

        {/* Dots */}
        {dataSeries.map((series, idx) =>
          series.values.map((v, i) => (
            <circle
              key={`${idx}-${i}`}
              cx={getX(i)}
              cy={getY(v)}
              r={2.5}
              fill={series.color}
            />
          ))
        )}
      </svg>

      {/* Legend */}
      <div className="legend">
        {dataSeries.map((s, idx) => (
          <div key={idx} className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: s.color }}
            />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
