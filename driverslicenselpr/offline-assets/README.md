# Offline Assets for Drivers License LPR Dashboard

This folder contains all the necessary assets to run the Drivers License LPR Dashboard completely offline.

## Folder Structure

```
offline-assets/
├── libraries/          # Chart.js and related libraries (local .tgz files)
├── cdn-libraries/      # CDN versions of all libraries
├── fonts/             # Font files (Segoe UI)
├── plugins/           # Chart.js plugins
├── assets/            # JSON data files and app assets
├── icons/             # Application icons and images
└── README.md          # This file
```

## Libraries Included

### Chart Libraries (libraries/)
- `chart.js-4.5.0.tgz` - Chart.js main library
- `chartjs-adapter-date-fns-3.0.0.tgz` - Date adapter for Chart.js
- `chartjs-plugin-zoom-2.2.0.tgz` - Zoom plugin for Chart.js
- `date-fns-4.1.0.tgz` - Date utility library
- `react-chartjs-2-5.3.0.tgz` - React wrapper for Chart.js

### CDN Libraries (cdn-libraries/)
- `react.production.min.js` - React 19.1.0
- `react-dom.production.min.js` - React DOM 19.1.0
- `bootstrap.min.css` - Bootstrap 5.3.7 CSS
- `bootstrap.bundle.min.js` - Bootstrap 5.3.7 JS
- `chart.min.js` - Chart.js 4.5.0
- `chartjs-adapter-date-fns.min.js` - Date adapter
- `chartjs-plugin-zoom.min.js` - Zoom plugin
- `date-fns.min.js` - Date utilities
- `react-chartjs-2.min.js` - React Chart.js wrapper
- `recharts.min.js` - Recharts library

### Fonts (fonts/)
- `Segoe UI.zip` - Segoe UI font family

### Assets (assets/)
- `favicon.ico` - Application favicon
- `logo192.png` - 192px logo
- `logo512.png` - 512px logo
- `manifest.json` - Web app manifest
- `robots.txt` - Search engine robots file
- `thermaldata.json` - Thermal data configuration
- `zones.json` - Zone configuration data
- `SSAM.temperature_logs.json` - Temperature logs data
- `nameconfig.json` - Name configuration

### Icons (icons/)
- `ANEEC.png` - ANEEC logo
- `ANEEC 2.png` - ANEEC logo variant
- `Assetlogo.png` - Asset logo
- `Camera-icon.png` - Camera icon
- `LineChart.png` - Line chart icon
- `settings.png` - Settings icon
- `Surveillance.png` - Surveillance icon
- `Thermal.png` - Thermal icon

## How to Use Offline

### Option 1: Using Local .tgz Files
The application is already configured to use local .tgz files in the `package.json`:

```json
"chart.js": "file:chart-libraries/chart.js-4.5.0.tgz",
"chartjs-adapter-date-fns": "file:chart-libraries/chartjs-adapter-date-fns-3.0.0.tgz",
"chartjs-plugin-zoom": "file:chart-libraries/chartjs-plugin-zoom-2.2.0.tgz",
"date-fns": "file:chart-libraries/date-fns-4.1.0.tgz",
"react-chartjs-2": "file:chart-libraries/react-chartjs-2-5.3.0.tgz"
```

### Option 2: Using CDN Libraries
To use the CDN versions, you can reference them directly in your HTML:

```html
<!-- React -->
<script src="offline-assets/cdn-libraries/react.production.min.js"></script>
<script src="offline-assets/cdn-libraries/react-dom.production.min.js"></script>

<!-- Bootstrap -->
<link rel="stylesheet" href="offline-assets/cdn-libraries/bootstrap.min.css">
<script src="offline-assets/cdn-libraries/bootstrap.bundle.min.js"></script>

<!-- Chart.js -->
<script src="offline-assets/cdn-libraries/chart.min.js"></script>
<script src="offline-assets/cdn-libraries/chartjs-adapter-date-fns.min.js"></script>
<script src="offline-assets/cdn-libraries/chartjs-plugin-zoom.min.js"></script>
<script src="offline-assets/cdn-libraries/date-fns.min.js"></script>
<script src="offline-assets/cdn-libraries/react-chartjs-2.min.js"></script>
<script src="offline-assets/cdn-libraries/recharts.min.js"></script>
```

## Installation Instructions

1. **For Development**: The application is already configured to use local libraries
2. **For Production**: Use the CDN libraries by copying them to your web server
3. **For Complete Offline**: Ensure all assets are accessible via relative paths

## Data Files

The following JSON files are included for offline operation:
- `thermaldata.json` - Thermal sensor configuration
- `zones.json` - Surveillance zone definitions
- `SSAM.temperature_logs.json` - Historical temperature data
- `nameconfig.json` - Application configuration

## Font Installation

The Segoe UI font is included as a ZIP file. To install:
1. Extract the ZIP file
2. Install the font files on your system
3. The application will use the installed font

## Notes

- All libraries are version-matched to the package.json dependencies
- The CDN versions are minified for production use
- Local .tgz files are the original npm packages
- All assets are organized for easy deployment and maintenance
