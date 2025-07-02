// src/components/ZoneCard.js

import React from 'react';

export default function ZoneCards({ zone, extraClass = '', tempUnit = 'F', isDarkMode = false }) {
  const convertTemp = (f) => {
    return tempUnit === 'C' ? Math.round((f - 32) * (5 / 9)) : f;
  };

  const unitSymbol = tempUnit === 'C' ? '°C' : '°F';

  return (
    <div className={`zone-card ${extraClass} ${isDarkMode ? 'dark-zone' : ''}`}>
      <h4 className="zone-name">{zone.name}</h4>
      <div className="zone-temp">{convertTemp(zone.temperature)}{unitSymbol}</div>
      <div className="zone-threshold">
        Threshold: {convertTemp(zone.threshold)}{unitSymbol}
      </div>
      <div className="zone-last">
        Last triggered: {zone.lastTriggered}
      </div>
      <div className={`zone-status ${zone.status.toLowerCase()}`}>
        {zone.status}
      </div>
    </div>
  );
}
