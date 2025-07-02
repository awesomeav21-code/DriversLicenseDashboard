// src/App.js

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import VideoFeed from './components/VideoFeed';
import './styles/videofeed.css';
import SidebarPanel from './components/SidebarPanel';
import ThermalData from './components/ThermalData';
import Footer from './components/Footer';
import './App.css';

const camera1BaseNames = [
  "HV1", "XMER1", "LV1", "HV2", "XMER2", "LV2",
  "Tie Swit", "Global", "Zone9", "Zone10",
  "Zone11", "Zone12"
];

const camera2BaseNames = [
  "XMERS", "Area2", "Area3", "Area4", "Area5",
  "Area6", "Area7", "Area8", "Area9", "Area10",
  "Area11", "Area12"
];

const getRandomSubset = (arr, maxCount) => {
  const count = Math.floor(Math.random() * maxCount) + 1;
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
};

const createZones = () => {
  const cam1Names = getRandomSubset(camera1BaseNames, 12);
  const cam2Names = getRandomSubset(camera2BaseNames, 12);

  const cam1Zones = cam1Names.map((name, i) => {
    const temp = Math.floor(Math.random() * 61) + 120;
    const status = temp > 140 ? 'ALERT' : 'NORMAL';
    return {
      id: i + 1,
      name,
      temperature: temp,
      threshold: 140,
      status,
      lastTriggered: status === 'ALERT'
        ? new Date().toLocaleTimeString()
        : 'Never',
      camera: 'left'
    };
  });

  const cam2Zones = cam2Names.map((name, i) => {
    const temp = Math.floor(Math.random() * 61) + 120;
    const status = temp > 140 ? 'ALERT' : 'NORMAL';
    return {
      id: cam1Zones.length + i + 1,
      name,
      temperature: temp,
      threshold: 140,
      status,
      lastTriggered: status === 'ALERT'
        ? new Date().toLocaleTimeString()
        : 'Never',
      camera: 'right'
    };
  });

  return [...cam1Zones, ...cam2Zones];
};

export default function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
  const [zones, setZones] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false); // Dark mode toggle default OFF
  const [tempUnit, setTempUnit] = useState('F');

  useEffect(() => {
    setZones(createZones());
  }, []);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('light-mode', !isDarkMode);
  }, [isDarkMode]);

  const addZone = () => {
    const newId = zones.length + 1;
    const newZone = {
      id: newId,
      name: `Zone ${newId}`,
      temperature: 132,
      threshold: 140,
      status: 'NORMAL',
      lastTriggered: 'Never',
      camera: 'left'
    };
    setZones(prev => [...prev, newZone]);
  };

  const camera1Zones = zones.filter(z => z.camera === 'left');
  const camera2Zones = zones.filter(z => z.camera === 'right');

  return (
    <>
      <Header
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        tempUnit={tempUnit}
        setTempUnit={setTempUnit}
      />

      <div className="app-layout">
        <div className="main-content">
          <SidebarPanel
            isDarkMode={isDarkMode}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            addZone={addZone}
          />

          <div className="content-area">
            <div className="content-box">
              <Navigation
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isDarkMode={isDarkMode}
              />
            </div>

            <div className="scroll-container">
              {activeTab === 'dashboard' && (
                <VideoFeed
                  isDarkMode={isDarkMode}
                  tempUnit={tempUnit}
                  camera1Zones={camera1Zones}
                  camera2Zones={camera2Zones}
                />
              )}

              {activeTab === 'thermal' && (
                <ThermalData
                  isDarkMode={isDarkMode}
                  tempUnit={tempUnit}
                />
              )}
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
