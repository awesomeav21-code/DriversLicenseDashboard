import React, { useState, useRef, useEffect } from 'react'
import '../styles/header.css'
import ANECLogo from './images/ANEEC.png'
import AssetLogo from './images/Assetlogo.png'
import SettingsIcon from './images/settings.png'

function Header({
  isDarkMode,
  setIsDarkMode,
  tempUnit,
  setTempUnit,
}) {
  // Sample substations data
  const substations = [
    {
      id: 1,
      name: 'Tasley - 1, VA',
      temperatureThreshold: '75°F',
      lastMaintenance: '2025-06-20',
      status: 'Normal',
    },
    {
      id: 2,
      name: 'Richmond - 2, VA',
      temperatureThreshold: '80°F',
      lastMaintenance: '2025-05-15',
      status: 'Warning',
    },
    {
      id: 3,
      name: 'Norfolk - 3, VA',
      temperatureThreshold: '78°F',
      lastMaintenance: '2025-04-10',
      status: 'Critical',
    },
  ]

  // State for current selected substation (defaults to first)
  const [selectedSubstationId, setSelectedSubstationId] = useState(substations[0].id)
  const [showSubstationDropdown, setShowSubstationDropdown] = useState(false)
  const substationDropdownRef = useRef(null)

  // Shuffle substations list for dropdown only
  const [shuffledSubstations, setShuffledSubstations] = useState([])

  useEffect(() => {
    function shuffle(array) {
      let arr = [...array]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }
    setShuffledSubstations(shuffle(substations))
  }, [])

  // Find current substation object
  const currentSubstation = substations.find(s => s.id === selectedSubstationId)

  // Profile and UI states
  const [showHelp, setShowHelp] = useState(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isAlertOn, setIsAlertOn] = useState(false)
  const [modalContent, setModalContent] = useState(null) // null | 'edit' | 'view'
  const [profileName, setProfileName] = useState(null)

  // Form fields for profile editing
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profileColor, setProfileColor] = useState('#1c7ed6')
  const [tempColor, setTempColor] = useState(profileColor)

  // Refs for dropdown close handling
  const helpRef = useRef(null)
  const settingsRef = useRef(null)
  const profileRef = useRef(null)

  const helpMouseInside = useRef(false)
  const settingsMouseInside = useRef(false)
  const profileMouseInside = useRef(false)

  // Load profile from localStorage once
  useEffect(() => {
    const savedProfile = localStorage.getItem('userProfile')
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile)
        if (parsed.name) setProfileName(parsed.name)
        if (parsed.color) {
          setProfileColor(parsed.color)
          setTempColor(parsed.color)
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [])

  // Close dropdowns on outside click (including substation dropdown)
  useEffect(() => {
    function handleClickOutside(event) {
      if (helpRef.current && !helpRef.current.contains(event.target)) {
        setShowHelp(false)
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettingsMenu(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
      if (substationDropdownRef.current && !substationDropdownRef.current.contains(event.target)) {
        setShowSubstationDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Mouse enter/leave handlers for help dropdown
  const onHelpEnter = () => {
    helpMouseInside.current = true
    setShowHelp(true)
  }
  const onHelpLeave = () => {
    helpMouseInside.current = false
    setTimeout(() => {
      if (!helpMouseInside.current) setShowHelp(false)
    }, 100)
  }
  // Mouse enter/leave handlers for settings dropdown
  const onSettingsEnter = () => {
    settingsMouseInside.current = true
    setShowSettingsMenu(true)
  }
  const onSettingsLeave = () => {
    settingsMouseInside.current = false
    setTimeout(() => {
      if (!settingsMouseInside.current) setShowSettingsMenu(false)
    }, 100)
  }
  // Mouse enter/leave handlers for profile dropdown
  const onProfileEnter = () => {
    profileMouseInside.current = true
    setShowProfileMenu(true)
  }
  const onProfileLeave = () => {
    profileMouseInside.current = false
    setTimeout(() => {
      if (!profileMouseInside.current) setShowProfileMenu(false)
    }, 100)
  }

  // Edit profile modal open
  const handleEditProfile = () => {
    setFirstName('')
    setLastName('')
    setTempColor(profileColor)
    setModalContent('edit')
    setShowProfileMenu(false)
  }
  // View profile modal open
  const handleViewProfile = () => {
    setModalContent('view')
    setShowProfileMenu(false)
  }
  // Close modal
  const closeModal = () => setModalContent(null)

  // Submit profile form
  const handleProfileSubmit = (e) => {
    e.preventDefault()
    const fullName = `${firstName.trim()}${lastName.trim() ? ' ' + lastName.trim() : ''}`
    setProfileName(fullName || null)
    setProfileColor(tempColor)

    localStorage.setItem(
      'userProfile',
      JSON.stringify({ name: fullName, color: tempColor })
    )

    setFirstName('')
    setLastName('')
    setModalContent(null)
  }
  // Remove profile data
  const handleRemoveProfile = () => {
    setProfileName(null)
    setProfileColor('#1c7ed6')
    setTempColor('#1c7ed6')
    localStorage.removeItem('userProfile')
    setModalContent(null)
  }

  const profileInitial = profileName ? profileName.charAt(0).toUpperCase() : 'O'

  // Colors for dark mode
  const helpTextColor = isDarkMode ? '#f9fafb' : '#1f2937'
  const helpHeadingColor = isDarkMode ? '#f3f4f6' : '#111827'
  const helpBorderColor = isDarkMode ? '#334155' : '#ccc'
  const helpBgColor = isDarkMode ? '#0f172a' : 'white'
  const helpShadow = isDarkMode
    ? '0 8px 24px rgba(0, 0, 0, 0.8)'
    : '0 8px 24px rgba(0, 0, 0, 0.2)'

  const settingsTextColor = isDarkMode ? '#f9fafb' : '#111827'
  const settingsBgColor = isDarkMode ? '#0f172a' : '#ffffff'
  const settingsBorderColor = isDarkMode ? '#334155' : 'none'
  const settingsShadow = isDarkMode
    ? '0 8px 24px rgba(0, 0, 0, 0.8)'
    : '0 8px 24px rgba(0, 0, 0, 0.12)'

  // Substation dropdown arrow component
  const DropdownArrow = ({ open }) => (
    <svg
      style={{
        marginLeft: 8,
        transition: 'transform 0.18s',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M5 8l5 5 5-5"
        stroke={isDarkMode ? '#a5b4fc' : '#4b5563'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  // Status dot component
  const StatusDot = ({ active }) => (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: active ? '#3b82f6' : '#ef4444', // blue for active, red for others
        marginLeft: 10,
        verticalAlign: 'middle',
        boxShadow: active ? '0 0 5px #60a5fa' : undefined,
      }}
    />
  )

  // Substation select handler
  function handleSubstationSelect(id) {
    setSelectedSubstationId(id)
    setShowSubstationDropdown(false)
  }

  return (
    <>
      <header className="header">
        <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="ssam-logo-group">
            <img src={AssetLogo} alt="SSAM Logo" className="ssam-image" />
          </div>
          <div className="divider-container" style={{ height: '100%' }}>
            <div
              className="divider"
              style={{ height: '100%', alignSelf: 'stretch' }}
            />
          </div>
          <div className="logo transparent-logo">
            <a
              href={ANECLogo}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ANEC"
            >
              <img
                src={ANECLogo}
                alt="ANEC Logo"
                className="logo-image anec-filter"
              />
            </a>
          </div>

          {/* Substation info box dropdown */}
          <div  
            ref={substationDropdownRef}
            style={{ position: 'relative', zIndex: 1000}}
            className="substation-container"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowSubstationDropdown(prev => !prev)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setShowSubstationDropdown(prev => !prev)
                }
              }}
              className="substation-clickable"
              style={{
                marginLeft: '20px',
                marginTop: '10px',
                display: 'flex', 
                alignItems: 'center', 
                flexWrap: 'nowrap',
                backgroundColor: showSubstationDropdown
                  ? (isDarkMode ? '#1c2336' : '#e0f0ff')
                  : (isDarkMode ? '#2f3747' : '#f0f4f8'),
                borderRadius: '12px',
                padding: '12px 16px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',  // prevents wrapping inside this text
                overflow: 'hidden',   // hides overflow content
                textOverflow: 'ellipsis',  // adds ... when text is too long
                color: showSubstationDropdown
                  ? (isDarkMode ? '#a5b4fc' : '#1c3a70')
                  : (isDarkMode ? 'white' : 'black'),
                fontWeight: '600',
                fontSize: '14px',
                display: 'flex',
                justifyContent: 'center',  // or 'space-between' as you want
                alignItems: 'center',
                userSelect: 'none',
                transition: 'background-color 0.3s, color 0.3s',
              }}
              aria-label="Select Substation"
            >
              <span><strong>Substation:&nbsp;</strong>{currentSubstation?.name || 'N/A'}</span>
              {/* Remove StatusDot here so no dot before dropdown click */}
              <DropdownArrow open={showSubstationDropdown} />
            </div>

            {showSubstationDropdown && (
              <div
                className="substation-dropdown" 
                style={{
                  position: 'absolute',
                  top: '74px',
                  left: '0',
                  backgroundColor: isDarkMode ? '#1c2336' : 'white',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  border: isDarkMode ? '1px solid #2a3346' : '1px solid #e5eaf0',
                  marginTop: 6,
                  zIndex: 2000,
                  overflow: 'hidden',
                }}
              >
                {substations.map(s => (
                  <div
                    key={s.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSubstationSelect(s.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSubstationSelect(s.id)
                      }
                    }}
                    style={{
                      padding: '14px 18px',
                      cursor: 'pointer',
                      backgroundColor: s.id === selectedSubstationId ? (isDarkMode ? '#233151' : '#eaf6ff') : 'transparent',
                      color: s.id === selectedSubstationId ? (isDarkMode ? '#cbd5e1' : '#444') : (isDarkMode ? '#8b93a8' : '#888'),
                      fontWeight: s.id === selectedSubstationId ? 700 : 500,
                      fontSize: 15,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: s.id !== substations[substations.length - 1].id ? (isDarkMode ? '1px solid #2a3346' : '1px solid #f1f3f6') : 'none',
                      userSelect: 'none',
                      outline: 'none',
                    }}
                  >
                    <span>{s.name}</span>
                    <StatusDot active={s.id === selectedSubstationId} />
                  </div>
                ))}

                <div
                  style={{
                    padding: '12px 18px',
                    backgroundColor: isDarkMode ? '#233151' : '#f9fafb',
                    borderTop: isDarkMode ? '1px solid #2a3346' : '1px solid #e5eaf0',
                    textAlign: 'center',
                  }}
                >
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '10px 0',
                      backgroundColor: '#4a7a3f',
                      color: 'white',
                      fontWeight: 600,
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    tabIndex={-1}
                  >
                    + Test Connectivity
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="header-icons">
          {/* Help icon */}
          <div
            className="icon-container dropdown-parent"
            ref={helpRef}
            onMouseEnter={onHelpEnter}
            onMouseLeave={onHelpLeave}
          >
            <button
              className="icon-button"
              aria-label="Help"
              onClick={() => setShowHelp(prev => !prev)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9 10a3 3 0 0 1 6 0c0 2-3 2-3 4" />
                <circle cx="12" cy="17" r="1" />
              </svg>
            </button>
            {showHelp && (
              <div
                className="dropdown help-dropdown manual-panel"
                onMouseEnter={() => (helpMouseInside.current = true)}
                onMouseLeave={onHelpLeave}
                style={{
                  backgroundColor: helpBgColor,
                  border: `1px solid ${helpBorderColor}`,
                  color: helpTextColor,
                  boxShadow: helpShadow,
                }}
              >
                <h3
                  className="settings-title"
                  style={{ color: helpHeadingColor }}
                >
                  Help Manual
                </h3>

                <div className="manual-section" style={{ color: helpTextColor }}>
                  <h4
                    className="setting-name"
                    style={{ color: helpHeadingColor }}
                  >
                    Dashboard Overview
                  </h4>
                  <div className="help-feature" style={{ color: helpTextColor }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2a5 5 0 0 0-5 5v5a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
                    </svg>
                    <span>Monitor real-time temperature data from different zones</span>
                  </div>
                  <div className="help-feature" style={{ color: helpTextColor }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M23 7l-7 5 7 5V7z M1 5h16v14H1V5z" />
                    </svg>
                    <span>View live camera feeds from PTZ, thermal, and normal cameras</span>
                  </div>
                  <div className="help-feature" style={{ color: helpTextColor }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2c4 0 8 4 8 8s-4 8-8 8-8-4-8-8 4-8 8-8z" />
                    </svg>
                    <span>Track AI-powered animal detection alerts</span>
                  </div>
                </div>

                <div className="manual-section" style={{ color: helpTextColor }}>
                  <h4 className="setting-name" style={{ color: helpHeadingColor }}>
                    Temperature Monitoring
                  </h4>
                  <div className="help-feature" style={{ color: helpTextColor }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10.29 3.86L1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z" />
                    </svg>
                    <span>Red indicators show when temperatures exceed thresholds</span>
                  </div>
                  <div className="help-feature" style={{ color: helpTextColor }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 12h16 M12 4v16" />
                    </svg>
                    <span>Toggle between Fahrenheit and Celsius in settings</span>
                  </div>
                </div>

                <div className="manual-section" style={{ color: helpTextColor }}>
                  <h4 className="setting-name" style={{ color: helpHeadingColor }}>
                    Event Logs
                  </h4>
                  <div className="help-feature" style={{ color: helpTextColor }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 7V3H4a2 2 0 0 0-2 2v4h6z" />
                    </svg>
                    <span>Filter events by date range</span>
                  </div>
                  <div className="help-feature" style={{ color: helpTextColor }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l4 4-4 4 M7 8l-4 4 4 4" />
                    </svg>
                    <span>Download logs for selected date range</span>
                  </div>
                </div>

                <div className="manual-section" style={{ color: helpTextColor }}>
                  <h4 className="setting-name" style={{ color: helpHeadingColor }}>
                    Troubleshooting
                  </h4>
                  <div className="help-feature" style={{ color: helpTextColor }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4.05 4.05a9 9 0 1 1 0 12.73 M1 1l22 22" />
                    </svg>
                    <span>
                      If temperature shows “--°”, check network connection and
                      refresh the page.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`icon-container alert-toggle ${isAlertOn ? 'on' : ''}`}>
            <button
              className="alert-button"
              onClick={() => setIsAlertOn(prev => !prev)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={isAlertOn ? 'red' : 'gray'}
              >
                <path d="M9 21h6v-1H9v1zm3-19a7 7 0 0 0-7 7c0 2.88 1.67 5.38 4.08 6.49L9 21h6l-.08-5.51A6.987 6.987 0 0 0 15 9a7 7 0 0 0-7-7z" />
              </svg>
            </button>
          </div>

          <div
            className="icon-container dropdown-parent settings-icon-container"
            ref={settingsRef}
            onMouseEnter={onSettingsEnter}
            onMouseLeave={onSettingsLeave}
          >
            <button
              className="settings-icon"
              aria-label="Settings"
              onClick={() => setShowSettingsMenu(prev => !prev)}
            >
              <img
                src={SettingsIcon}
                alt="Settings"
                className="icon-img"
                style={{ border: 'none' }}
              />
            </button>
            {showSettingsMenu && (
              <div
                className="dropdown settings-dropdown"
                style={{
                  backgroundColor: settingsBgColor,
                  color: settingsTextColor,
                  boxShadow: settingsShadow,
                  border: `1px solid ${settingsBorderColor}`,
                }}
              >
                <div
                  className="settings-title"
                  style={{ color: settingsTextColor }}
                >
                  Settings
                </div>

                <div className="setting-item" style={{ color: settingsTextColor }}>
                  <div className="setting-text" style={{ color: settingsTextColor }}>
                    <div className="setting-name" style={{ color: settingsTextColor }}>
                      Temperature Unit
                    </div>
                    <div className="setting-description" style={{ color: settingsTextColor }}>
                      Switch between Fahrenheit and Celsius
                    </div>
                  </div>
                  <div className="toggle-row">
                    <span>F°</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={tempUnit === 'C'}
                        onChange={() => setTempUnit(tempUnit === 'F' ? 'C' : 'F')}
                      />
                      <span className="slider" />
                    </label>
                    <span>C°</span>
                  </div>
                </div>

                <div className="setting-item" style={{ color: settingsTextColor }}>
                  <div className="setting-text" style={{ color: settingsTextColor }}>
                    <div className="setting-name" style={{ color: settingsTextColor }}>
                      Dark Mode
                    </div>
                    <div className="setting-description" style={{ color: settingsTextColor }}>
                      Switch between light and dark theme
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={isDarkMode}
                      onChange={e => setIsDarkMode(e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>
              </div>
            )}
          </div>
          <div
            className="dropdown-parent"
            ref={profileRef}
            onMouseEnter={onProfileEnter}
            onMouseLeave={onProfileLeave}
          >
            <button
              className="profile-button"
              aria-label="User Profile"
              onClick={() => setShowProfileMenu(prev => !prev)}
              style={{ color: isDarkMode ? 'white' : 'inherit' }}
            >
              <span
                className="profile-circle"
                style={{ backgroundColor: profileColor }}
              >
                {profileInitial}
              </span>
              <span className="profile-label-text">
                {profileName || ''}
              </span>
            </button>
            {showProfileMenu && (
              <div className="dropdown profile-dropdown" style={{ backgroundColor: isDarkMode ? '#0f172a' : 'white', color: isDarkMode ? 'white' : 'black' }}>
                <ul className="profile-menu-list">
                  <li
                    className="profile-menu-item"
                    tabIndex={0}
                    onClick={handleEditProfile}
                    style={{ color: isDarkMode ? 'white' : 'black' }}
                  >
                    Edit Profile
                  </li>
                  <li
                    className="profile-menu-item"
                    tabIndex={0}
                    onClick={handleViewProfile}
                    style={{ color: isDarkMode ? 'white' : 'black' }}
                  >
                    View Profile
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      {modalContent && (
        <div
          className="modal-overlay"
          onClick={closeModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              background: isDarkMode ? '#0f172a' : 'white',
              padding: '20px',
              borderRadius: '8px',
              width: '320px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              position: 'relative',
              color: isDarkMode ? 'white' : 'black',
            }}
          >
            <button
              onClick={closeModal}
              style={{
                position: 'absolute',
                top: '8px',
                right: '12px',
                border: 'none',
                background: 'transparent',
                fontSize: '24px',
                cursor: 'pointer',
                lineHeight: 1,
                color: isDarkMode ? 'white' : 'black',
              }}
              aria-label="Close modal"
            >
              &times;
            </button>
            {modalContent === 'edit' && (
              <>
                <h2>Edit Profile</h2>
                <form onSubmit={handleProfileSubmit}>
                  <div style={{ marginBottom: '12px' }}>
                    <label
                      htmlFor="firstName"
                      style={{ display: 'block', marginBottom: '4px', color: isDarkMode ? 'white' : 'black' }}
                    >
                      First Name:
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px',
                        boxSizing: 'border-box',
                        backgroundColor: isDarkMode ? '#0f172a' : 'white',
                        color: isDarkMode ? 'white' : 'black',
                        border: isDarkMode ? '1px solid #334155' : '1px solid #ccc',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label
                      htmlFor="lastName"
                      style={{ display: 'block', marginBottom: '4px', color: isDarkMode ? 'white' : 'black' }}
                    >
                      Last Name:
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px',
                        boxSizing: 'border-box',
                        backgroundColor: isDarkMode ? '#0f172a' : 'white',
                        color: isDarkMode ? 'white' : 'black',
                        border: isDarkMode ? '1px solid #334155' : '1px solid #ccc',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label
                      htmlFor="colorPicker"
                      style={{ display: 'block', marginBottom: '4px', color: isDarkMode ? 'white' : 'black' }}
                    >
                      Profile Color:
                    </label>
                    <input
                      id="colorPicker"
                      type="color"
                      value={tempColor}
                      onChange={e => setTempColor(e.target.value)}
                      style={{ width: '50px', height: '34px', border: 'none', padding: 0 }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#1c7ed6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '10px',
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveProfile}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: 'gray',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Remove Profile
                  </button>
                </form>
              </>
            )}
            {modalContent === 'view' && (
              <>
                <h2>View Profile</h2>
                {profileName ? (
                  <p>
                    <strong>Name:</strong> {profileName}
                  </p>
                ) : (
                  <p>No profile information available.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Header