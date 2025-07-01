// src/components/Navigation.js

import React from 'react';
import '../styles/navigation.css';

export default function Navigation({ activeTab }) {
  return (
    <nav
      className="navigation"
      style={{
        width: 'calc(100% - 240px)',  // Adjust width for sidebar + gap
        marginLeft: '240px',           // Shift nav right by sidebar + gap
      }}
    >
      <button
        className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={e => e.preventDefault()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.5 }}
        >
          <rect x="3" y="3" width="8" height="8" rx="1" ry="1" />
          <rect x="13" y="3" width="8" height="8" rx="1" ry="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" ry="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" ry="1" />
        </svg>
        Dashboard
      </button>

      <button
        className={`nav-button thermal ${activeTab === 'thermal' ? 'active' : ''}`}
        onClick={e => e.preventDefault()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.5 }}
        >
          <path d="M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0z" />
        </svg>
        Thermal Data
      </button>
    </nav>
  );
}
