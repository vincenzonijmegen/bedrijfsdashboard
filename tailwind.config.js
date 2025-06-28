/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx,js,jsx}"
  ],
  safelist: [
    "bg-green-600", "hover:bg-green-700",
    "bg-blue-600", "hover:bg-blue-700",
    "bg-slate-700", "hover:bg-slate-800",
    "bg-fuchsia-600", "hover:bg-fuchsia-700",
    "bg-red-600", "hover:bg-red-700",
    "bg-yellow-400", "hover:bg-yellow-500",
    "bg-cyan-600", "hover:bg-cyan-700",
    "bg-pink-500", "hover:bg-pink-600",
    "bg-purple-600", "hover:bg-purple-700"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
