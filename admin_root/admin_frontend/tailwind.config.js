/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', 'class'], // Enable class-based dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				'50': '#e8f2ff',
  				'100': '#d1e6ff',
  				'200': '#a3ccff',
  				'300': '#75b3ff',
  				'400': '#4799ff',
  				'500': '#0660B2',
  				'600': '#054E91',
  				'700': '#043d73',
  				'800': '#032b55',
  				'900': '#02376D',
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				'50': '#e8f2ff',
  				'100': '#d1e6ff',
  				'200': '#a3ccff',
  				'300': '#75b3ff',
  				'400': '#4799ff',
  				'500': '#054E91',
  				'600': '#044085',
  				'700': '#043369',
  				'800': '#03254d',
  				'900': '#02376D',
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			navy: {
  				'50': '#e6f0ff',
  				'100': '#cce0ff',
  				'200': '#99c2ff',
  				'300': '#66a3ff',
  				'400': '#3385ff',
  				'500': '#0066cc',
  				'600': '#0052a3',
  				'700': '#003d7a',
  				'800': '#002952',
  				'900': '#02376D'
  			},
  			teal: {
  				'50': '#ecfdf9',
  				'100': '#d1faf2',
  				'200': '#a7f3e6',
  				'300': '#6ee7d7',
  				'400': '#44D3BB',
  				'500': '#20c997',
  				'600': '#18a57a',
  				'700': '#148862',
  				'800': '#116a4e',
  				'900': '#0f5d42'
  			},
  			coral: {
  				'50': '#fef5f5',
  				'100': '#fde8e8',
  				'200': '#fcd4d4',
  				'300': '#f9b0b0',
  				'400': '#f67d7d',
  				'500': '#F45E56',
  				'600': '#e93d35',
  				'700': '#d32f2f',
  				'800': '#b71c1c',
  				'900': '#8e0000'
  			},
  			success: {
  				'50': '#ecfdf9',
  				'100': '#d1faf2',
  				'200': '#a7f3e6',
  				'300': '#6ee7d7',
  				'400': '#44D3BB',
  				'500': '#20c997',
  				'600': '#18a57a',
  				'700': '#148862',
  				'800': '#116a4e',
  				'900': '#0f5d42'
  			},
  			warning: {
  				'50': '#fef5f5',
  				'100': '#fde8e8',
  				'200': '#fcd4d4',
  				'300': '#f9b0b0',
  				'400': '#f67d7d',
  				'500': '#F45E56',
  				'600': '#e93d35',
  				'700': '#d32f2f',
  				'800': '#b71c1c',
  				'900': '#8e0000'
  			},
  			error: {
  				'50': '#fef5f5',
  				'100': '#fde8e8',
  				'200': '#fcd4d4',
  				'300': '#f9b0b0',
  				'400': '#f67d7d',
  				'500': '#F45E56',
  				'600': '#e93d35',
  				'700': '#d32f2f',
  				'800': '#b71c1c',
  				'900': '#8e0000'
  			},
  			'light-grey': '#EFEFEF',
  			'cool-grey': '#E6E6E6',
  			'warm-grey': '#E0DDD1',
  			gray: {
  				'50': '#fafafa',
  				'100': '#f5f5f5',
  				'200': '#EFEFEF',
  				'300': '#E6E6E6',
  				'400': '#E0DDD1',
  				'500': '#a3a3a3',
  				'600': '#737373',
  				'700': '#525252',
  				'800': '#404040',
  				'900': '#262626'
  			},
  			dark: {
  				bg: '#0f1419',
  				card: '#1a1f2e',
  				sidebar: '#0b0e11',
  				border: '#2a3441',
  				hover: '#242b3a'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			headline: [
  				'Museo',
  				'Arial',
  				'sans-serif'
  			],
  			subheading: [
  				'Montserrat',
  				'Helvetica',
  				'Arial',
  				'sans-serif'
  			],
  			body: [
  				'Karla',
  				'Segoe UI',
  				'Tahoma',
  				'Geneva',
  				'Verdana',
  				'sans-serif'
  			],
  			sans: [
  				'Karla',
  				'Segoe UI',
  				'system-ui',
  				'-apple-system',
  				'sans-serif'
  			]
  		},
  		fontSize: {
  			xs: '13px',
  			sm: '13px',
  			base: '15px',
  			lg: '17px',
  			xl: '20px',
  			'2xl': '24px',
  			'3xl': '30px',
  			'4xl': '36px',
  			'5xl': '48px',
  			'6xl': '60px',
  			h1: '48px',
  			h2: '36px',
  			h3: '24px',
  			body: '15px',
  			small: '13px'
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.3s ease-in-out',
  			'slide-up': 'slideUp 0.3s ease-out',
  			'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			slideUp: {
  				'0%': {
  					transform: 'translateY(10px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [
    function({ addComponents }) {
      addComponents({
        '.container-app': {
          '@apply mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl': {},
        },
      })
    },
      require("tailwindcss-animate")
],
}
