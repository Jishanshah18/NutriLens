/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#2E7D32",
          lightGreen: "#81C784",
          dark: "#1B5E20",
        },
        danger: "#D32F2F",
        warning: "#F57C00"
      }
    },
  },
  plugins: [],
}
