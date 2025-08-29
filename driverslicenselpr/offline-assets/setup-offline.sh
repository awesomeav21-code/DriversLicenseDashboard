#!/bin/bash

# Offline Setup Script for Drivers License LPR Dashboard
# This script helps set up the offline environment

echo "🚀 Setting up offline environment for Drivers License LPR Dashboard..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the driverslicenselpr directory"
    exit 1
fi

# Create necessary directories if they don't exist
echo "📁 Creating directories..."
mkdir -p offline-assets/{libraries,cdn-libraries,fonts,plugins,assets,icons}

# Copy chart libraries
echo "📦 Copying chart libraries..."
if [ -d "chart-libraries" ]; then
    cp chart-libraries/* offline-assets/libraries/ 2>/dev/null || echo "⚠️  Some chart libraries already exist"
else
    echo "⚠️  chart-libraries directory not found"
fi

# Copy fonts
echo "🔤 Copying fonts..."
if [ -d "fonts" ]; then
    cp fonts/* offline-assets/fonts/ 2>/dev/null || echo "⚠️  Some fonts already exist"
else
    echo "⚠️  fonts directory not found"
fi

# Copy public assets
echo "📁 Copying public assets..."
if [ -d "public" ]; then
    cp public/*.json public/*.ico public/*.png offline-assets/assets/ 2>/dev/null || echo "⚠️  Some assets already exist"
else
    echo "⚠️  public directory not found"
fi

# Copy icons
echo "🎨 Copying icons..."
if [ -d "src/components/images" ]; then
    cp src/components/images/* offline-assets/icons/ 2>/dev/null || echo "⚠️  Some icons already exist"
else
    echo "⚠️  src/components/images directory not found"
fi

# Check if CDN libraries exist
echo "🌐 Checking CDN libraries..."
cd_libs_count=$(ls offline-assets/cdn-libraries/*.js offline-assets/cdn-libraries/*.css 2>/dev/null | wc -l)
if [ "$cd_libs_count" -gt 0 ]; then
    echo "✅ CDN libraries found: $cd_libs_count files"
else
    echo "⚠️  No CDN libraries found. Run the download script to get them."
fi

# Create a simple web server for testing
echo "🌐 Creating test server..."
cat > offline-assets/serve-offline.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

// Serve static files
app.use(express.static(__dirname));

// Serve the test page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-offline.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Offline test server running at http://localhost:${PORT}`);
    console.log(`📊 Test page available at http://localhost:${PORT}/test-offline.html`);
    console.log(`📁 All assets served from: ${__dirname}`);
});
EOF

# Create a package.json for the offline server
cat > offline-assets/package.json << 'EOF'
{
  "name": "drivers-license-offline-server",
  "version": "1.0.0",
  "description": "Offline server for Drivers License LPR Dashboard",
  "main": "serve-offline.js",
  "scripts": {
    "start": "node serve-offline.js",
    "test": "echo \"Open http://localhost:3001/test-offline.html in your browser\""
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

echo ""
echo "✅ Offline setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. To test offline functionality:"
echo "   cd offline-assets"
echo "   npm install"
echo "   npm start"
echo "   Then open http://localhost:3001/test-offline.html"
echo ""
echo "2. To use in production:"
echo "   - Copy the offline-assets folder to your web server"
echo "   - Update your HTML files to reference local paths"
echo "   - Ensure all assets are accessible via relative paths"
echo ""
echo "3. For development:"
echo "   - The application is already configured to use local .tgz files"
echo "   - Run 'npm start' from the main directory"
echo ""
echo "📚 See README.md for detailed usage instructions"
