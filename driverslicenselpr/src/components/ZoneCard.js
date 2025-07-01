import React from 'react';

export default function ZoneCards({ zone, extraClass = '' }) {
  return (
    <div className={`zone-card ${extraClass}`}>
      <h4 className="zone-name">{zone.name}</h4>
      <div className="zone-temp">{zone.temperature}°F</div>
      <div className="zone-threshold">
        Threshold: {zone.threshold}°F
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
