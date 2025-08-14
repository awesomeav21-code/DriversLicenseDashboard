import React, { useState, useEffect } from 'react';

export default function ZoneCard({
  zone,
  extraClass = '',
  tempUnit = 'F',
  isDarkMode = false,
  expandFullWidth = false,
}) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const convertTemp = (f) =>
    tempUnit === 'C' ? Math.round((f - 32) * (5 / 9)) : f;

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

  // Add the --fullwidth class conditionally here like you did for zone-grid-wrapper
  const zoneCardClassName = `zone-card ${extraClass} ${isDarkMode ? 'dark-zone' : ''}${
    expandFullWidth ? ' zone-card--fullwidth' : ''
  }`;

  return (
    <div
      className={zoneCardClassName}
      style={{
        flexShrink: 0,
        flexGrow: 0,
        boxSizing: 'border-box',
        transform: expandFullWidth ? 'scaleX(1.05)' : 'scaleX(1.1)',
        transformOrigin: expandFullWidth ? 'initial' : 'left center',
        position: 'relative',
      }}
    >
      <div className="zone-card-inner">
        <h4 className="zone-name">{zone.name}</h4>
        <div className="zone-temp">
          {convertTemp(zone.temperature)}
          {unitSymbol}
        </div>
        <div className="zone-threshold">
          Threshold: {convertTemp(zone.threshold)}
          {unitSymbol}
        </div>
        <div className="zone-last">
          Last triggered: {formatLastTriggered(zone.lastTriggered)}
        </div>
      </div>
    </div>
  );
}
