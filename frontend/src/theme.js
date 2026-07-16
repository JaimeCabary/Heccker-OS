import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

// Heccker-OS Minimalist flat design system
// Typography: Cera Round Pro (exact Hugeicons font)
// Pure flat, solid backgrounds, thin 1px borders, zero shadows, zero glassmorphism

const config = defineConfig({
  globalCss: {
    "*, *::before, *::after": { boxSizing: "border-box", margin: 0 },
    html: { height: "100%", overflow: "hidden" },
    body: {
      height: "100%",
      overflow: "hidden",
      fontFamily: "'Cera Round Pro', -apple-system, sans-serif",
      bg: "#FAFAFA",
      color: "#18181B",
      WebkitFontSmoothing: "antialiased",
    },
    "#root": { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" },
    "::-webkit-scrollbar": { width: "4px" },
    "::-webkit-scrollbar-track": { background: "transparent" },
    "::-webkit-scrollbar-thumb": { background: "#E4E4E7", borderRadius: "2px" },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: "'Cera Round Pro', sans-serif" },
        body:    { value: "'Cera Round Pro', sans-serif" },
        mono:    { value: "'SF Mono', Monaco, Consolas, monospace" },
      },
      colors: {
        // Flat Pastel Yellow
        yellow: {
          50:  { value: "#FFFDF6" },
          100: { value: "#FEF9E7" },
          200: { value: "#FFF3CD" },
          500: { value: "#FDE2B5" },
        },
        // Flat Pastel Pink
        pink: {
          50:  { value: "#FFF8FA" },
          100: { value: "#FFF0F3" },
          200: { value: "#FFCCD5" },
          500: { value: "#FFB3C6" },
        },
        // Flat Pastel Green
        green: {
          50:  { value: "#F5FDFB" },
          100: { value: "#E8F8F5" },
          200: { value: "#D1F2EB" },
          500: { value: "#A3E4D7" },
        },
        // Flat Pastel Blue
        blue: {
          50:  { value: "#F5FAFD" },
          100: { value: "#EBF5FB" },
          200: { value: "#D4E6F1" },
          500: { value: "#AED6F1" },
        },
        // Flat Pastel Orange
        orange: {
          100: { value: "#FEF5E7" },
          200: { value: "#FDEBD0" },
          500: { value: "#F8C471" },
        },
        // Flat Pastel Red
        red: {
          100: { value: "#FDEDEC" },
          200: { value: "#FADBD8" },
          500: { value: "#F1948A" },
        },
        // Neutral zinc palette
        zinc: {
          50:  { value: "#FAFAFA" },
          100: { value: "#F4F4F5" },
          200: { value: "#E4E4E7" },
          300: { value: "#D4D4D8" },
          500: { value: "#71717A" },
          900: { value: "#18181B" },
        },
        border: { DEFAULT: { value: "#E4E4E7" } },
      },
      radii: {
        sm:  { value: "6px" },
        md:  { value: "8px" },
        lg:  { value: "10px" },
        xl:  { value: "12px" },
        full: { value: "9999px" },
      },
      shadows: {
        xs:  { value: "none" },
        sm:  { value: "none" },
        md:  { value: "none" },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
