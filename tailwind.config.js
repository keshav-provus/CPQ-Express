module.exports = {
  content: ["./main_content.html", "./main_content_lwc.html"],
  important: true,
  darkMode: "class",
  theme: {
      extend: {
          colors: {
              "tertiary-fixed": "#95f8a7",
              "secondary-container": "#d5e3fc",
              "inverse-surface": "#2d3133",
              "on-error": "#ffffff",
              "tertiary-container": "#117e3b",
              "on-tertiary-fixed": "#00210a",
              "on-surface-variant": "#434655",
              "surface-container-lowest": "#ffffff",
              "surface-container-highest": "#e0e3e5",
              "on-secondary-container": "#57657a",
              "on-primary-fixed": "#00174b",
              "error": "#ba1a1a",
              "primary-fixed": "#dbe1ff",
              "error-container": "#ffdad6",
              "on-primary-fixed-variant": "#003ea8",
              "primary-fixed-dim": "#b4c5ff",
              "primary-container": "#2563eb",
              "tertiary": "#00632b",
              "surface-container-high": "#e6e8ea",
              "primary": "#004ac6",
              "outline-variant": "#c3c6d7",
              "on-surface": "#191c1e",
              "inverse-primary": "#b4c5ff",
              "secondary": "#515f74",
              "on-tertiary-fixed-variant": "#005323",
              "surface-variant": "#e0e3e5",
              "surface-dim": "#d8dadc",
              "outline": "#737686",
              "on-primary-container": "#eeefff",
              "surface-container-low": "#f2f4f6",
              "surface-bright": "#f7f9fb",
              "inverse-on-surface": "#eff1f3",
              "on-secondary-fixed-variant": "#3a485b",
              "surface-container": "#eceef0",
              "on-primary": "#ffffff",
              "background": "#f7f9fb",
              "surface": "#f7f9fb",
              "on-tertiary-container": "#c4ffc9",
              "on-tertiary": "#ffffff",
              "secondary-fixed-dim": "#b9c7df",
              "on-secondary": "#ffffff",
              "tertiary-fixed-dim": "#79db8d",
              "on-secondary-fixed": "#0d1c2e",
              "surface-tint": "#0053db",
              "secondary-fixed": "#d5e3fc",
              "on-error-container": "#93000a",
              "on-background": "#191c1e"
          },
          borderRadius: {
              "DEFAULT": "0.25rem",
              "lg": "1rem",
              "xl": "1.5rem",
              "full": "9999px"
          },
          fontFamily: {
              "headline": ["Manrope", "sans-serif"],
              "body": ["Inter", "sans-serif"],
              "label": ["Inter", "sans-serif"]
          }
      }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ]
}
