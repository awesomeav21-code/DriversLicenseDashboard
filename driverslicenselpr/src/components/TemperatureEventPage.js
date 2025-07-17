import React, { useState } from 'react';

const TemperatureEventPage = () => {
  const [cameraCount, setCameraCount] = useState(1);

  const addCamera = () => setCameraCount(count => count + 1);

  return (
    <div style={{ padding: 20, background: '#0f172a', color: '#e5e7eb', minHeight: '100vh' }}>
      <h1>Temperature Event Recordings</h1>
      <button
        onClick={addCamera}
        style={{
          padding: '10px 20px',
          fontSize: '1.2rem',
          borderRadius: '6px',
          background: '#5cffcb',
          color: '#1c2337',
          border: 'none',
          cursor: 'pointer',
          marginBottom: 20,
          fontWeight: '700',
        }}
      >
        Trigger + Add Camera
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {[...Array(cameraCount)].map((_, i) => (
          <div
            key={i}
            style={{
              width: 200,
              height: 150,
              background: '#222f48',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#99d0f7',
              fontSize: '1.2rem',
              userSelect: 'none',
              boxShadow: '0 2px 8px rgba(10,18,36,0.4)',
            }}
          >
            Camera {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemperatureEventPage;
