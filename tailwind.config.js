/** @type {import('tailwindcss').Config} */
module.exports = {
content: [
  "./src/**/*.{js,ts,jsx,tsx}",
  "./node_modules/@tiptap/**/*.{js,ts,jsx,tsx}" // ✅ toevoegen
]
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")], // optioneel maar aanbevolen voor `.prose`
};
