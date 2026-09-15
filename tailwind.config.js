/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // A card table and the ledger kept beside it. The orange is the app's
      // own splash colour (app.json) and is spent on one thing only: the
      // viewer's own stake, and the action that changes it. Nothing else in
      // the app is orange, so "orange means me" holds everywhere.
      colors: {
        table: {
          DEFAULT: "#1E3A33", // baize: the header band
          deep: "#152A25", // its own shadow, for depth without a drop shadow
          edge: "#375C52", // rules and inactive marks drawn on the band
        },
        ground: "#E9E9E4", // the page behind the slips
        paper: "#FBFAF8", // the slips themselves
        rule: "#D5D6CE", // every border in the app
        ink: {
          DEFAULT: "#16231F", // text
          soft: "#3F4E49", // secondary text that still has to be read
        },
        dusk: "#6B7A75", // labels, spent units, anything receded
        ante: {
          DEFAULT: "#EF8120", // you
          deep: "#C4600F", // you, pressed
          wash: "#FDF0E3", // you, as a background
        },
        brass: "#D9A227", // the last day before the deadline, and nothing else
      },
    },
  },
  plugins: [],
};
