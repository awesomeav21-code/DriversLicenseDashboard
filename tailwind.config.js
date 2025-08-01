/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // scans all JS, JSX, TS, TSX files in src folder
    "./src/**/*.css",              // scans all CSS files in src folder
    "./*.css"                     // scans CSS files in project root folder
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
