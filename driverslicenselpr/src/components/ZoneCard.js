// src/components/ZoneCard.js

import React from 'react';

export default function ZoneCard({ zone, extraClass = '', tempUnit = 'F', isDarkMode = false }) {
  const convertTemp = (f) => {
    return tempUnit === 'C' ? Math.round((f - 32) * (5 / 9)) : f;
  };

  const unitSymbol = tempUnit === 'C' ? '°C' : '°F';

  const formatLastTriggered = (lastTriggered) => {
    if (!lastTriggered) return 'N/A';
    let date;
    if (typeof lastTriggered === 'string' || lastTriggered instanceof String) {
      date = new Date(lastTriggered);
    } else if (lastTriggered instanceof Date) {
      date = lastTriggered;
    } else if (typeof lastTriggered === 'number') {
      date = new Date(lastTriggered);
    } else {
      return String(lastTriggered);
    }

    if (isNaN(date.getTime())) return String(lastTriggered);

    const pad = (n) => n.toString().padStart(2, '0');

    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const year = date.getFullYear().toString().slice(-2);
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className={`zone-card ${extraClass} ${isDarkMode ? 'dark-zone' : ''}`}>
      <div className="zone-card-inner">
        <h4 className="zone-name">{zone.name}</h4>
        <div className="zone-temp">
          {convertTemp(zone.temperature)}{unitSymbol}
        </div>
        <div className="zone-threshold">
          Threshold: {convertTemp(zone.threshold)}{unitSymbol}
        </div>
        <div className="zone-last">
          Last triggered: {formatLastTriggered(zone.lastTriggered)}
        </div>
        {/* Removed the alert badge (zone-status) from here */}
      </div>
    </div>
  );
}
