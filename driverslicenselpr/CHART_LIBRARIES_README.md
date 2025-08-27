# Chart.js Libraries & Fonts - Complete Download Package

## 📦 Downloaded Libraries

All chart libraries have been downloaded to your computer in the `chart-libraries/` folder:

### **Core Libraries:**
1. **chart.js-4.5.0.tgz** (1.5MB) - Main charting library
2. **react-chartjs-2-5.3.0.tgz** (10KB) - React wrapper for Chart.js
3. **chartjs-plugin-zoom-2.2.0.tgz** (24KB) - Zoom and pan functionality
4. **chartjs-adapter-date-fns-3.0.0.tgz** (54KB) - Date adapter for Chart.js
5. **date-fns-4.1.0.tgz** (3.2MB) - Date utility library

### **Fonts:**
- **Segoe UI** - Primary font used in the chart (downloaded as Roboto alternative)

## 🗂️ File Structure

```
driverslicenselpr/
├── chart-libraries/
│   ├── chart.js-4.5.0.tgz
│   ├── react-chartjs-2-5.3.0.tgz
│   ├── chartjs-plugin-zoom-2.2.0.tgz
│   ├── chartjs-adapter-date-fns-3.0.0.tgz
│   └── date-fns-4.1.0.tgz
├── fonts/
│   └── Segoe UI.zip (Roboto alternative)
└── CHART_LIBRARIES_README.md
```

## 🔧 How to Use These Libraries

### **For Offline Development:**

1. **Extract the .tgz files:**
   ```bash
   cd chart-libraries
   tar -xzf chart.js-4.5.0.tgz
   tar -xzf react-chartjs-2-5.3.0.tgz
   tar -xzf chartjs-plugin-zoom-2.2.0.tgz
   tar -xzf chartjs-adapter-date-fns-3.0.0.tgz
   tar -xzf date-fns-4.1.0.tgz
   ```

2. **Install from local files:**
   ```bash
   npm install ./chart-libraries/chart.js-4.5.0.tgz
   npm install ./chart-libraries/react-chartjs-2-5.3.0.tgz
   npm install ./chart-libraries/chartjs-plugin-zoom-2.2.0.tgz
   npm install ./chart-libraries/chartjs-adapter-date-fns-3.0.0.tgz
   npm install ./chart-libraries/date-fns-4.1.0.tgz
   ```

### **For Font Installation:**

1. **macOS:** Double-click the font file to install
2. **Windows:** Right-click → Install
3. **Linux:** Copy to `~/.local/share/fonts/` and run `fc-cache -fv`

## 📊 What Each Library Does

### **Chart.js (4.5.0)**
- Core charting engine
- Provides Line, Bar, Pie, and other chart types
- Handles data visualization and rendering

### **React-ChartJS-2 (5.3.0)**
- React components for Chart.js
- Enables easy integration with React applications
- Provides `<Line>`, `<Bar>`, `<Pie>` components

### **ChartJS Plugin Zoom (2.2.0)**
- Adds zoom and pan functionality
- Enables users to zoom into chart data
- Provides mouse wheel and pinch zoom support

### **ChartJS Adapter Date-FNS (3.0.0)**
- Connects Chart.js with date-fns library
- Enables proper date/time axis handling
- Supports various date formats and timezones

### **Date-FNS (4.1.0)**
- Modern JavaScript date utility library
- Provides date parsing, formatting, and manipulation
- Lightweight alternative to Moment.js

## 🎨 Font Information

### **Segoe UI**
- Primary font used in ThermalPlot.js charts
- Microsoft's system font (Windows)
- **Alternative:** Roboto (Google Fonts) - downloaded as fallback
- **System Font Stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

## 🔗 Online Sources

If you need to download these libraries again:

- **Chart.js:** https://www.chartjs.org/
- **React-ChartJS-2:** https://react-chartjs-2.js.org/
- **ChartJS Plugin Zoom:** https://github.com/chartjs/chartjs-plugin-zoom
- **Date-FNS:** https://date-fns.org/
- **Segoe UI Font:** https://fonts.google.com/specimen/Roboto

## 📝 Usage in ThermalPlot.js

The ThermalPlot.js file uses these libraries as follows:

```javascript
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import 'chartjs-adapter-date-fns'
```

## ✅ Verification

To verify all libraries are working:

1. Run your React app: `npm start`
2. Navigate to the Thermal tab
3. Check that charts render properly
4. Test zoom functionality
5. Verify date/time axis formatting

---

**Total Package Size:** ~4.8MB
**Last Updated:** August 27, 2025
**Compatible with:** React 19.1.0, Chart.js 4.5.0
