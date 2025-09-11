import React from "react";
import ReactDOM from "react-dom";




export default function FixedPopup({ children, style, className }) {
  // Check if dark mode is active
  const isDarkMode = document.body.classList.contains('dark-mode');
  
  const portalStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 100000,
    backgroundColor: isDarkMode ? '#101e34' : 'white',
    border: isDarkMode ? '1px solid #fff' : '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.5)' : '0 4px 20px rgba(0, 0, 0, 0.3)',
    padding: '20px',
    minWidth: '300px',
    maxWidth: '80vw',
    maxHeight: '80vh',
    overflow: 'auto',
    color: isDarkMode ? '#e2e8f0' : '#1f2937',
    ...style
  };

  return ReactDOM.createPortal(
    <div style={portalStyle} className={className}>
      {children}
    </div>,
    document.body
  );
}
