// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  // [수정] content 경로를 hellopiggy 프로젝트 구조에 맞게 수정
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}