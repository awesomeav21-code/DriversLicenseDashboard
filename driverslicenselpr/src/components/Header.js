import React, { useState, useRef, useEffect } from 'react'
import '../styles/header.css'
import ANECLogo from './images/ANEEC 2.png'
import AssetLogo from './images/Assetlogo.png'
import SettingsIcon from './images/settings.png'

function Header({
  isDarkMode,
  setIsDarkMode,
  tempUnit,
  setTempUnit,
}) {
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

  const [selectedSubstationId, setSelectedSubstationId] = useState(substations[0].id)
  const [showSubstationDropdown, setShowSubstationDropdown] = useState(false)
  const substationDropdownRef = useRef(null)
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

  const currentSubstation = substations.find(s => s.id === selectedSubstationId)

  const [showHelp, setShowHelp] = useState(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isAlertOn, setIsAlertOn] = useState(false)
  const [modalContent, setModalContent] = useState(null)
  const [profileName, setProfileName] = useState(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profileColor, setProfileColor] = useState('#1c7ed6')
  const [tempColor, setTempColor] = useState(profileColor)
  const [substationMargin, setSubstationMargin] = useState('8px')
  const [substationWidth, setSubstationWidth] = useState('auto')
  const [testCounter, setTestCounter] = useState(0)

  const helpRef = useRef(null)
  const settingsRef = useRef(null)
  const profileRef = useRef(null)

  const helpMouseInside = useRef(false)
  const settingsMouseInside = useRef(false)
  const profileMouseInside = useRef(false)

  // Load saved profile
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
      } catch {}
    }
  }, [])

  // Load uploaded logo from localStorage on mount
  const [uploadedLogo, setUploadedLogo] = useState(localStorage.getItem('uploadedLogo') || null)
  
  // Ref for file input to reset value after upload
  const logoInputRef = useRef(null)

  // Calculate substation transform and width - moves LEFT as screen gets larger, width increases as screen gets smaller
  useEffect(() => {
    const calculateTransform = () => {
      const width = window.innerWidth
      // Move left by 1px for every 100px of screen width
      const offset = -Math.floor(width / 100) * 1
      return `translateX(${offset}px)`
    }

    const calculateWidth = () => {
      const width = window.innerWidth
      // Increase width dramatically as screen gets larger - add 50px for every 100px increase
      const baseWidth = 140
      const widthIncrease = Math.floor(width / 100) * 50
      const finalWidth = baseWidth + widthIncrease
      return `${Math.max(finalWidth, 140)}px`
    }

    const updateTransform = () => {
      const newTransform = calculateTransform()
      const newWidth = calculateWidth()
      setSubstationMargin(newTransform)
      setSubstationWidth(newWidth)
      setTestCounter(prev => prev + 1) // Force re-render
    }

    // Set initial transform
    updateTransform()

    // Add resize listener
    window.addEventListener('resize', updateTransform)

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateTransform)
    }
  }, [])

  // Close dropdowns/modals on outside click
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

  // Hover handlers
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

  // Profile menu actions
  const handleEditProfile = () => {
    setFirstName('')
    setLastName('')
    setTempColor(profileColor)
    setModalContent('edit')
    setShowProfileMenu(false)
  }
  const handleViewProfile = () => {
    setModalContent('view')
    setShowProfileMenu(false)
  }
  const closeModal = () => setModalContent(null)
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
  const handleRemoveProfile = () => {
    setProfileName(null)
    setProfileColor('#1c7ed6')
    setTempColor('#1c7ed6')
    localStorage.removeItem('userProfile')
    setModalContent(null)
  }

  const profileInitial = profileName ? profileName.charAt(0).toUpperCase() : 'O'

  // Theme‐based styling values
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

  // Icons/components
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

  const StatusDot = ({ active }) => (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: active ? '#3b82f6' : '#ef4444',
        marginLeft: 10,
        verticalAlign: 'middle',
        boxShadow: active ? '0 0 5px #60a5fa' : undefined,
      }}
    />
  )

  function handleSubstationSelect(id) {
    setSelectedSubstationId(id)
    setShowSubstationDropdown(false)
  }

  // Logo upload handler with localStorage persistence and input reset
  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
  
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      localStorage.setItem('uploadedLogo', result)
      setUploadedLogo(result)
    }
    reader.readAsDataURL(file)
  }
          return (
    <>
      <header className="header">
        <div className="logo-container">
          <div className="ssam-logo-group">
            <img src={AssetLogo} alt="SSAM Logo" className="ssam-image" />
          </div>
          <div className="divider-container">
            <div className="divider"></div>
          </div>

          {/* Logo display area */}
          <div
            className="logo transparent-logo"
            tabIndex={0}
            aria-label="Current Logo"
            style={{ cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
<img
  src={uploadedLogo ? `${uploadedLogo}?${Date.now()}` : ANECLogo}
  alt="ANEC Logo"
  className="logo-image anec-filter"
/>
            {uploadedLogo && (
              <span style={{ marginTop: 4, fontSize: 12, color: isDarkMode ? '#a5b4fc' : '#4b5563' }}>
                Image uploaded
              </span>
            )}
          </div>
        </div>

        {/* Center section for substation */}
        <div className="header-center">
          <div
            ref={substationDropdownRef}
            className="substation-container"
            style={{ 
              transform: substationMargin,
              width: substationWidth,
              border: '3px solid red', // Visual test - red border
              backgroundColor: 'rgba(255, 0, 0, 0.1)', // Visual test - red background
              minHeight: '40px' // Visual test - ensure height is visible
            }}
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
                backgroundColor: showSubstationDropdown
                  ? (isDarkMode ? '#1c2336' : '#e0f0ff')
                  : (isDarkMode ? '#2f3747' : '#f0f4f8'),
                color: showSubstationDropdown
                  ? (isDarkMode ? '#a5b4fc' : '#1c3a70')
                  : (isDarkMode ? 'white' : 'black'),
                transition: 'background-color 0.3s, color 0.3s',
              }}
              aria-label="Select Substation"
            >
              <span><strong>Substation:&nbsp;</strong>{currentSubstation.name}</span>
              <DropdownArrow open={showSubstationDropdown} />
            </div>

            {showSubstationDropdown && (
              <div
                className="substation-dropdown"
                style={{
                  position: 'absolute',
                  backgroundColor: isDarkMode ? '#1c2336' : 'white',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  border: isDarkMode ? '1px solid #2a3346' : '1px solid #e5eaf0',
                  zIndex: 2000,
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
                      backgroundColor: s.id === selectedSubstationId
                        ? (isDarkMode ? '#233151' : '#eaf6ff')
                        : 'transparent',
                      color: s.id === selectedSubstationId
                        ? (isDarkMode ? '#cbd5e1' : '#444')
                        : (isDarkMode ? '#8b93a8' : '#888'),
                      fontWeight: s.id === selectedSubstationId ? 700 : 500,
                      fontSize: 15,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom:
                        s.id !== substations[substations.length - 1].id
                          ? (isDarkMode ? '1px solid #2a3346' : '1px solid #f1f3f6')
                          : 'none',
                      userSelect: 'none',
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
                  padding: '16px',
                  borderRadius: '8px',
                  maxWidth: '320px',
                }}
              >
                <h3 style={{ color: helpHeadingColor, marginBottom: '12px' }}>Help Manual</h3>

                {/* Dashboard Overview */}
                <div style={{ marginBottom: '12px' }}>
                  <h4 style={{ color: helpHeadingColor, marginBottom: '8px' }}>Dashboard Overview</h4>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                      <path d="M12 2a5 5 0 0 0-5 5v5a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
                    </svg>
                    <span>Monitor real-time temperature data from different zones</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                      <path d="M23 7l-7 5 7 5V7z M1 5h16v14H1V5z" />
                    </svg>
                    <span>View live camera feeds from PTZ, thermal, and normal cameras</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                      <path d="M12 2c4 0 8 4 8 8s-4 8-8 8-8-4-8-8 4-8 8-8z" />
                    </svg>
                    <span>Track AI-powered animal detection alerts</span>
                  </div>
                </div>

                {/* Temperature Monitoring */}
                <div style={{ marginBottom: '12px' }}>
                  <h4 style={{ color: helpHeadingColor, marginBottom: '8px' }}>Temperature Monitoring</h4>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                      <path d="M10.29 3.86L1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z" />
                    </svg>
                    <span>Red indicators show when temperatures exceed thresholds</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                      <path d="M4 12h16 M12 4v16" />
                    </svg>
                    <span>Toggle between Fahrenheit and Celsius in settings</span>
                  </div>
                </div>

                {/* Event Logs */}
                <div style={{ marginBottom: '12px' }}>
                  <h4 style={{ color: helpHeadingColor, marginBottom: '8px' }}>Event Logs</h4>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                      <path d="M8 7V3H4a2 2 0 0 0-2 2v4h6z" />
                    </svg>
                    <span>Filter events by date range</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l4 4-4 4 M7 8l-4 4 4 4" />
                    </svg>
                    <span>Download logs for selected date range</span>
                  </div>
                </div>

                {/* Troubleshooting */}
                <div>
                  <h4 style={{ color: helpHeadingColor, marginBottom: '8px' }}>Troubleshooting</h4>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke={isDarkMode ? '#a5b4fc' : '#1c7ed6'} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                      <path d="M4.05 4.05a9 9 0 1 1 0 12.73 M1 1l22 22" />
                    </svg>
                    <span>If temperature shows “--°”, check network connection and refresh the page.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Alert icon */}
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

          {/* Settings dropdown (with Upload Logo) */}
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
                <div className="settings-title" style={{ color: settingsTextColor }}>
                  Settings
                </div>

                <div className="setting-item" style={{ color: settingsTextColor }}>
                  <div className="setting-text">
                    <div className="setting-name">Temperature Unit</div>
                    <div className="setting-description">Switch between Fahrenheit and Celsius</div>
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
                  <div className="setting-text">
                    <div className="setting-name">Dark Mode</div>
                    <div className="setting-description">Switch between light and dark theme</div>
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

                <div
                  className="setting-item"
                  style={{
                    color: settingsTextColor,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '12px 16px',
                  }}
                >
                  <div className="setting-name" style={{ marginBottom: 6 }}>Upload Logo</div>
                  <label
  style={{
    padding: '6px 12px',
    backgroundColor: '#4a7a3f',
    color: 'white',
    fontWeight: '600',
    borderRadius: 6,
    cursor: 'pointer',
    userSelect: 'none',
    fontSize: 14,
  }}
>
  Choose File
  <input
    type="file"
    accept="image/*"
    style={{ display: 'none' }}
    onChange={handleLogoUpload}
    ref={logoInputRef}
  />
</label>

                </div>
              </div>
            )}
          </div>


          {/* Profile dropdown */}
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
              <div
                className="dropdown profile-dropdown"
                style={{
                  backgroundColor: isDarkMode ? '#0f172a' : 'white',
                  color: isDarkMode ? 'white' : 'black',
                }}
              >
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

      {/* Profile edit/view modal */}
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
