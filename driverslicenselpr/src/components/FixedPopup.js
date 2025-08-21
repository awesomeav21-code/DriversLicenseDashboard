import React from "react";
import ReactDOM from "react-dom";




export default function FixedPopup({ children, style, className }) {
  const portalStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 100000,
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    padding: '20px',
    minWidth: '300px',
    maxWidth: '80vw',
    maxHeight: '80vh',
    overflow: 'auto',
    ...style
  };

  return ReactDOM.createPortal(
    <div style={portalStyle} className={className}>
      {children}
    </div>,
    document.body
  );
}
