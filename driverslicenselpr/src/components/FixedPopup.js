import React from "react";
import ReactDOM from "react-dom";

export default function FixedPopup({ children, style }) {
  return ReactDOM.createPortal(
    <div style={style}>
      {children}
    </div>,
    document.body
  );
}
