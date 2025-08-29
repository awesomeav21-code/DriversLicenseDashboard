#!/bin/bash

echo "🚫 Starting Drivers License Dashboard - NO INTERNET REQUIRED!"
echo "=================================================="

# Check if build exists
if [ ! -d "build" ]; then
    echo "❌ Build folder not found!"
    echo "Please run: npm run build (with WiFi first)"
    exit 1
fi

# Start the offline server
echo "🚀 Starting offline server..."
node serve-offline.js
