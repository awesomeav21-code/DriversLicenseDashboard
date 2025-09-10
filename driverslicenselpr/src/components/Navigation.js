// src/components/Navigation.js

import React from 'react';
import '../styles/navigation.css';

export default function Navigation({ activeTab, setActiveTab, isDarkMode, showEventsPage = false, setShowEventsPage }) {
  return (
    <nav
      className={`navigation ${isDarkMode ? 'dark-nav' : 'light-nav'}`}
      style={{
        width: 'calc(100% - 240px)',
        marginLeft: '240px', 
        zIndex: 1, 
      }}
    >
      <button
        className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('dashboard')
          if (setShowEventsPage) setShowEventsPage(false)
        }}
      >
        {/* Dashboard Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDarkMode ? '#f9fafb' : '#000'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="8" height="8" rx="1" ry="1" />
          <rect x="13" y="3" width="8" height="8" rx="1" ry="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" ry="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" ry="1" />
        </svg>
        Dashboard
      </button>

      <button
        className={`nav-button ${activeTab === 'thermal' && !showEventsPage ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('thermal')
          if (setShowEventsPage) setShowEventsPage(false)
        }}
      >
        {/* Thermal Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDarkMode ? '#f9fafb' : '#000'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0z" />
        </svg>
        Thermal Data
      </button>

      <button
        className={`nav-button ${activeTab === 'streams' ? 'active' : ''}`}
        onClick={() => {
          setActiveTab('streams')
          if (setShowEventsPage) setShowEventsPage(false)
        }}
      >
        {/* Camera Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDarkMode ? '#f9fafb' : '#000'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <rect x="2" y="7" width="6" height="10" rx="1" ry="1" />
          <path d="M8 12h1" />
          <path d="M14 7h8v10h-8z" />
          <path d="M18 9l-4 3 4 3" />
        </svg>
        Surveillance Data
      </button>
    </nav>
  );
}