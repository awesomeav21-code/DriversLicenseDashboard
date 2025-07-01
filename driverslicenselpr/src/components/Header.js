import React, { useState, useRef, useEffect } from 'react';
import '../styles/header.css';
import ANECLogo from './images/ANEEC.png';
import AssetLogo from './images/Assetlogo.png';

function Header({ substationName, isDarkMode, setIsDarkMode }) {
  const [showHelp, setShowHelp] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isAlertOn, setIsAlertOn] = useState(true);

  const helpRef = useRef(null);
  const settingsRef = useRef(null);
  const profileRef = useRef(null);

  const helpMouseInside = useRef(false);
  const settingsMouseInside = useRef(false);
  const profileMouseInside = useRef(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (helpRef.current && !helpRef.current.contains(event.target)) {
        setShowHelp(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onHelpEnter = () => { helpMouseInside.current = true; setShowHelp(true); };
  const onSettingsEnter = () => { settingsMouseInside.current = true; setShowSettingsMenu(true); };
  const onProfileEnter = () => { profileMouseInside.current = true; setShowProfileMenu(true); };

  const onHelpLeave = () => {
    helpMouseInside.current = false;
    setTimeout(() => {
      if (!helpMouseInside.current) setShowHelp(false);
    }, 100);
  };
  const onSettingsLeave = () => {
    settingsMouseInside.current = false;
    setTimeout(() => {
      if (!settingsMouseInside.current) setShowSettingsMenu(false);
    }, 100);
  };
  const onProfileLeave = () => {
    profileMouseInside.current = false;
    setTimeout(() => {
      if (!profileMouseInside.current) setShowProfileMenu(false);
    }, 100);
  };

  return (
    <header className="header">
      <div className="logo-container">
        <div className="ssam-logo-group">
          <img src={AssetLogo} alt="SSAM Logo" className="ssam-image" />
        </div>

        <div className="divider-container">
          <div className="divider"></div>
        </div>

        <div className="logo transparent-logo">
          <a href={ANECLogo} target="_blank" rel="noopener noreferrer" aria-label="ANEC">
            <img src={ANECLogo} alt="ANEC Logo" className="logo-image anec-filter" />
          </a>
        </div>

        <div className="substation-info" style={{ color: 'white', marginLeft: '24px', alignSelf: 'center', fontWeight: '600', fontSize: '16px' }}>
          Substation: {substationName || 'N/A'}
        </div>
      </div>

      <div className="header-icons">
        <div className="icon-container dropdown-parent" ref={helpRef} onMouseEnter={onHelpEnter} onMouseLeave={onHelpLeave}>
          <button className="icon-button" aria-label="Help" onClick={() => setShowHelp(prev => !prev)}>?</button>
          {showHelp && (
            <div className="dropdown help-dropdown">
              For help, contact support@samitsolutions.com or call 123-456-7890.
            </div>
          )}
        </div>

        <div className={`icon-container alert-toggle ${isAlertOn ? 'on' : ''}`}>
          <button
            className="alert-button"
            onClick={() => setIsAlertOn(prev => !prev)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isAlertOn ? 'red' : 'gray'}>
              <path d="M9 21h6v-1H9v1zm3-19a7 7 0 0 0-7 7c0 2.88 1.67 5.38 4.08 6.49L9 21h6l-.08-5.51A6.987 6.987 0 0 0 15 9a7 7 0 0 0-7-7z" />
            </svg>
            {isAlertOn ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="icon-container dropdown-parent" ref={settingsRef} onMouseEnter={onSettingsEnter} onMouseLeave={onSettingsLeave}>
          <button className="icon-button" aria-label="Settings" onClick={() => setShowSettingsMenu(prev => !prev)}>Settings</button>
          {showSettingsMenu && (
            <div className="dropdown settings-dropdown">
              <div className="settings-title">Settings</div>

              <div className="setting-item">
                <div className="setting-text">
                  <div className="setting-name">Temperature Unit</div>
                  <div className="setting-description">Switch between Fahrenheit and Celsius</div>
                </div>
                <div className="toggle-row">
                  <span>F°</span>
                  <label className="switch">
                    <input type="checkbox" />
                    <span className="slider" />
                  </label>
                  <span>C°</span>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-text">
                  <div className="setting-name">Dark Mode</div>
                  <div className="setting-description">Switch between light and dark theme</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={isDarkMode}
                    onChange={(e) => setIsDarkMode(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="dropdown-parent" ref={profileRef} onMouseEnter={onProfileEnter} onMouseLeave={onProfileLeave}>
          <button className="profile-button" aria-label="User Profile" onClick={() => setShowProfileMenu(prev => !prev)}>
            <span className="profile-label">Operator</span>
            <div className="profile-circle">O</div>
          </button>
          {showProfileMenu && (
            <div className="dropdown profile-dropdown">
              <ul className="profile-menu-list">
                <li className="profile-menu-item" tabIndex={0}>Edit Profile</li>
                <li className="profile-menu-item" tabIndex={0}>View Profile</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
