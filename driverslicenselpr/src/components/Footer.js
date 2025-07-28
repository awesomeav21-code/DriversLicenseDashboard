// src/components/Footer.js

import React from 'react';
import AssetLogo from '../components/images/Assetlogo.png';
import '../styles/footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <span className="footer-icon" style={{ display: 'flex', alignItems: 'center', height: 28 }}>
          <img
            src={AssetLogo}
            alt="SSAM Logo"
            style={{ width: 100, height: 100, objectFit: 'contain', display: 'block' }}
          />
        </span>
        <span className="footer-text">
          2025 SAM Analytics Solutions LLC. All rights reserved. Powered by SSAM: Smart Surveillance &amp; Asset Monitoring&nbsp;&nbsp;v1.0.0
        </span>
      </div>
    </footer>
  );
}