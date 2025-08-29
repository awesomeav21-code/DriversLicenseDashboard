#!/bin/bash

echo "🚀 Installing Drivers License Dashboard for Offline Use..."
echo "=================================================="

# Install chart libraries from local files
echo "📦 Installing Chart.js libraries..."
npm install ./chart-libraries/chart.js-4.5.0.tgz
npm install ./chart-libraries/react-chartjs-2-5.3.0.tgz
npm install ./chart-libraries/chartjs-plugin-zoom-2.2.0.tgz
npm install ./chart-libraries/chartjs-adapter-date-fns-3.0.0.tgz
npm install ./chart-libraries/date-fns-4.1.0.tgz

echo "✅ Chart libraries installed successfully!"

# Install other dependencies
echo "📦 Installing other dependencies..."
npm install

echo "✅ All dependencies installed!"

echo ""
echo "🎉 Installation Complete!"
echo "=================================================="
echo "To start the app: npm start"
echo "To test offline: Disconnect WiFi, then run: npm start"
echo "=================================================="
