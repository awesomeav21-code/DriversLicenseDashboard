const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'build')));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Offline server running at http://localhost:${port}`);
  console.log(`📱 No internet required!`);
  console.log(`🎯 Open your browser and go to: http://localhost:${port}`);
});
