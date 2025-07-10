import React, { useState, useRef, useEffect } from 'react'
import '../styles/header.css'
import ANECLogo from './images/ANEEC.png'
import AssetLogo from './images/Assetlogo.png'
import SettingsIcon from './images/settings.png'

function Header({
  substationName,
  isDarkMode,
  setIsDarkMode,
  tempUnit,
  setTempUnit,
}) {
  const [showHelp, setShowHelp] = useState(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isAlertOn, setIsAlertOn] = useState(false)
  const [modalContent, setModalContent] = useState(null) // null | 'edit' | 'view'
  const [profileName, setProfileName] = useState(null)

  // Form fields for profile editing
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profileColor, setProfileColor] = useState('#1c7ed6') // default profile circle color
  const [tempColor, setTempColor] = useState(profileColor) // temporary color for modal

  const helpRef = useRef(null)
  const settingsRef = useRef(null)
  const profileRef = useRef(null)

  const helpMouseInside = useRef(false)
  const settingsMouseInside = useRef(false)
  const profileMouseInside = useRef(false)

  // Load saved profile from localStorage on component mount
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
        // Ignore JSON parse errors silently
      }
    }
  }, [])

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
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

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

  const handleEditProfile = () => {
    // Always clear inputs when opening edit modal
    setFirstName('')
    setLastName('')
    setTempColor(profileColor) // reset color picker to current color
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

    // Save profile info persistently in localStorage
    localStorage.setItem(
      'userProfile',
      JSON.stringify({ name: fullName, color: tempColor })
    )

    // Clear input fields after save
    setFirstName('')
    setLastName('')

    setModalContent(null)
  }

  // Clear profile info from state and localStorage
  const handleRemoveProfile = () => {
    setProfileName(null)
    setProfileColor('#1c7ed6')
    setTempColor('#1c7ed6')
    localStorage.removeItem('userProfile')
    setModalContent(null)
  }

  // Profile circle shows first letter uppercase or fallback "O"
  const profileInitial = profileName ? profileName.charAt(0).toUpperCase() : 'O'

  return (
    <>
      <header className="header">
        <div className="logo-container">
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
          <div className="substation-label">
            <span className="substation-title">Substation:</span>
            <span className="substation-name">{substationName || 'N/A'}</span>
          </div>
        </div>

        <div className="header-icons">
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
                stroke="#1c7ed6"
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
              >
                <h3 className="settings-title">Help Manual</h3>

                <div className="manual-section">
                  <h4 className="setting-name">Dashboard Overview</h4>
                  <div className="help-feature">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1c7ed6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2a5 5 0 0 0-5 5v5a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
                    </svg>
                    <span>Monitor real-time temperature data from different zones</span>
                  </div>
                  <div className="help-feature">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1c7ed6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M23 7l-7 5 7 5V7z M1 5h16v14H1V5z" />
                    </svg>
                    <span>View live camera feeds from PTZ, thermal, and normal cameras</span>
                  </div>
                  <div className="help-feature">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1c7ed6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2c4 0 8 4 8 8s-4 8-8 8-8-4-8-8 4-8 8-8z" />
                    </svg>
                    <span>Track AI-powered animal detection alerts</span>
                  </div>
                </div>

                <div className="manual-section">
                  <h4 className="setting-name">Temperature Monitoring</h4>
                  <div className="help-feature">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1c7ed6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10.29 3.86L1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z" />
                    </svg>
                    <span>Red indicators show when temperatures exceed thresholds</span>
                  </div>
                  <div className="help-feature">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1c7ed6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 12h16 M12 4v16" />
                    </svg>
                    <span>Toggle between Fahrenheit and Celsius in settings</span>
                  </div>
                </div>

                <div className="manual-section">
                  <h4 className="setting-name">Event Logs</h4>
                  <div className="help-feature">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1c7ed6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 7V3H4a2 2 0 0 0-2 2v4h6z" />
                    </svg>
                    <span>Filter events by date range</span>
                  </div>
                  <div className="help-feature">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1c7ed6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l4 4-4 4 M7 8l-4 4 4 4" />
                    </svg>
                    <span>Download logs for selected date range</span>
                  </div>
                </div>

                <div className="manual-section">
                  <h4 className="setting-name">Troubleshooting</h4>
                  <div className="help-feature">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1c7ed6"
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
              <div className="dropdown settings-dropdown">
                <div className="settings-title">Settings</div>

                <div className="setting-item">
                  <div className="setting-text">
                    <div className="setting-name">Temperature Unit</div>
                    <div className="setting-description">
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

                <div className="setting-item">
                  <div className="setting-text">
                    <div className="setting-name">Dark Mode</div>
                    <div className="setting-description">
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
              <div className="dropdown profile-dropdown">
                <ul className="profile-menu-list">
                  <li
                    className="profile-menu-item"
                    tabIndex={0}
                    onClick={handleEditProfile}
                  >
                    Edit Profile
                  </li>
                  <li
                    className="profile-menu-item"
                    tabIndex={0}
                    onClick={handleViewProfile}
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
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              width: '320px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              position: 'relative',
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
                lineHeight: '1',
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
                      style={{ display: 'block', marginBottom: '4px' }}
                    >
                      First Name:
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label
                      htmlFor="lastName"
                      style={{ display: 'block', marginBottom: '4px' }}
                    >
                      Last Name:
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label
                      htmlFor="colorPicker"
                      style={{ display: 'block', marginBottom: '4px' }}
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
