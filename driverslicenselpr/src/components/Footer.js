// src/components/Footer.js

import React from 'react';
import '../styles/footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <span className="footer-text">© {new Date().getFullYear()} SAM IT Dashboard. All rights reserved.</span>
      </div>
    </footer>
  );
}
