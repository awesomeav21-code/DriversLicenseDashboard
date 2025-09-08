// Chart.js plugins for thermal plotting

export const hoverDotsPlugin = {
  id: 'hoverDotsPlugin',
  beforeDatasetsDraw(chart) {
    // Check if zoom plugin is active or if zooming/panning is happening
    const zoomPlugin = chart.options.plugins.zoom
    const isZooming = chart._zooming || chart._panning || 
                     (zoomPlugin && zoomPlugin.zoom && zoomPlugin.zoom.enabled) ||
                     (zoomPlugin && zoomPlugin.pan && zoomPlugin.pan.enabled)
    
    // Completely disable plugin during zoom operations
    if (isZooming) {
      return
    }
    
    const tooltip = chart.tooltip
    
    // Show dots on all lines at the same x-position when hovering
    if (tooltip.opacity === 1 && tooltip.dataPoints && tooltip.dataPoints.length > 0) {
      const hoveredPoint = tooltip.dataPoints[0]
      const hoveredDataIndex = hoveredPoint.dataIndex
      
      // Show dots on all visible datasets at the same time position
      chart.data.datasets.forEach((dataset, dsIndex) => {
        // Reset all point radii to 0 first
        if (dataset.data && Array.isArray(dataset.data)) {
          dataset.data.forEach((point, pointIndex) => {
            if (typeof point === 'object' && point !== null) {
              point.pointRadius = 0
            }
          })
        }
        
        // Find the data point at the same time position and show it
        if (dataset.data && dataset.data[hoveredDataIndex]) {
          const dataPoint = dataset.data[hoveredDataIndex]
          if (dataPoint && typeof dataPoint === 'object') {
            // Show dot only if the dataset is not hidden
            if (!dataset.hidden) {
              dataPoint.pointRadius = 5
              dataPoint.pointHoverRadius = 6
            }
          }
        }
      })
    } else {
      // Hide all points when not hovering
      chart.data.datasets.forEach(dataset => {
        if (dataset.data && Array.isArray(dataset.data)) {
          dataset.data.forEach((point, pointIndex) => {
            if (typeof point === 'object' && point !== null) {
              point.pointRadius = 0
              point.pointHoverRadius = 0
            }
          })
        }
      })
    }
  }
}

