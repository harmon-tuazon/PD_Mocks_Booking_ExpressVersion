/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // PrepDoctors Brand Colors
        primary: {
          50: '#e8f2ff',
          100: '#d1e6ff',
          200: '#a3ccff',
          300: '#75b3ff',
          400: '#4799ff',
          500: '#0660B2', // Primary Blue
          600: '#054E91', // Secondary Blue (hover states)
          700: '#043d73',
          800: '#032b55',
          900: '#02376D', // Navy Blue (dark backgrounds)
        },
        secondary: {
          50: '#e8f2ff',
          100: '#d1e6ff',
          200: '#a3ccff',
          300: '#75b3ff',
          400: '#4799ff',
          500: '#054E91', // Secondary Blue
          600: '#044085',
          700: '#043369',
          800: '#03254d',
          900: '#02376D', // Navy Blue
        },
        navy: {
          50: '#e6f0ff',
          100: '#cce0ff',
          200: '#99c2ff',
          300: '#66a3ff',
          400: '#3385ff',
          500: '#0066cc',
          600: '#0052a3',
          700: '#003d7a',
          800: '#002952',
          900: '#02376D', // Navy Blue
        },
        teal: {
          50: '#ecfdf9',
          100: '#d1faf2',
          200: '#a7f3e6',
          300: '#6ee7d7',
          400: '#44D3BB', // Teal (success states, available slots)
          500: '#20c997',
          600: '#18a57a',
          700: '#148862',
          800: '#116a4e',
          900: '#0f5d42',
        },
        coral: {
          50: '#fef5f5',
          100: '#fde8e8',
          200: '#fcd4d4',
          300: '#f9b0b0',
          400: '#f67d7d',
          500: '#F45E56', // Coral (warnings, limited availability)
          600: '#e93d35',
          700: '#d32f2f',
          800: '#b71c1c',
          900: '#8e0000',
        },
        success: {
          50: '#ecfdf9',
          100: '#d1faf2',
          200: '#a7f3e6',
          300: '#6ee7d7',
          400: '#44D3BB', // Teal for success states
          500: '#20c997',
          600: '#18a57a',
          700: '#148862',
          800: '#116a4e',
          900: '#0f5d42',
        },
        warning: {
          50: '#fef5f5',
          100: '#fde8e8',
          200: '#fcd4d4',
          300: '#f9b0b0',
          400: '#f67d7d',
          500: '#F45E56', // Coral for warnings
          600: '#e93d35',
          700: '#d32f2f',
          800: '#b71c1c',
          900: '#8e0000',
        },
        error: {
          50: '#fef5f5',
          100: '#fde8e8',
          200: '#fcd4d4',
          300: '#f9b0b0',
          400: '#f67d7d',
          500: '#F45E56', // Coral for errors
          600: '#e93d35',
          700: '#d32f2f',
          800: '#b71c1c',
          900: '#8e0000',
        },
        // PrepDoctors Brand Greys
        'light-grey': '#EFEFEF', // Backgrounds
        'cool-grey': '#E6E6E6',  // Cards, dividers
        'warm-grey': '#E0DDD1',  // Supporting backgrounds
        gray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#EFEFEF', // Light Grey
          300: '#E6E6E6', // Cool Grey
          400: '#E0DDD1', // Warm Grey
          500: '#a3a3a3',
          600: '#737373',
          700: '#525252',
          800: '#404040',
          900: '#262626',
        }
      },
      // PrepDoctors Typography System
      fontFamily: {
        // Headlines: 'Museo' with Arial fallback
        'headline': ['Museo', 'Arial', 'sans-serif'],
        // Subheadings: 'Montserrat' with Helvetica fallback
        'subheading': ['Montserrat', 'Helvetica', 'Arial', 'sans-serif'],
        // Body text: 'Karla' with Segoe UI fallback
        'body': ['Karla', 'Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
        // Keep existing sans for backward compatibility
        sans: ['Karla', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      // PrepDoctors Font Sizes
      fontSize: {
        'xs': '13px',     // Small text
        'sm': '13px',     // Small text
        'base': '15px',   // Body text minimum
        'lg': '17px',     // Large body text
        'xl': '20px',     // Large text
        '2xl': '24px',    // H3
        '3xl': '30px',    // Medium headings
        '4xl': '36px',    // H2
        '5xl': '48px',    // H1
        '6xl': '60px',    // Extra large headings
        // Brand-specific sizes
        'h1': '48px',     // H1
        'h2': '36px',     // H2
        'h3': '24px',     // H3
        'body': '15px',   // Body minimum
        'small': '13px',  // Small text
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}