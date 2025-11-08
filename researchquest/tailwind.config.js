/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: {
				DEFAULT: '1rem',
				sm: '1rem',
				md: '1.5rem',
				lg: '2rem',
				xl: '2rem',
			},
			screens: {
				sm: '640px',
				md: '768px',
				lg: '1024px',
				xl: '1280px',
				'2xl': '1440px',
			},
		},
		extend: {
			colors: {
				// Primary brand colors
				primary: {
					50: '#E6F0FF',
					100: '#CCE0FF',
					500: '#0066FF',
					600: '#0052CC',
					900: '#003D99',
				},
				// Background layers
				'bg-base': 'var(--bg-base)',
				'bg-surface': 'var(--bg-surface)',
				'bg-elevated': 'var(--bg-elevated)',
				'bg-layer-3': 'var(--bg-layer-3)',
				// Text colors
				'text-primary': 'var(--text-primary)',
				'text-secondary': 'var(--text-secondary)',
				'text-tertiary': 'var(--text-tertiary)',
				// Border colors
				'border-subtle': 'var(--border-subtle)',
				'border-moderate': 'var(--border-moderate)',
				'border-strong': 'var(--border-strong)',
				// Semantic colors
				success: {
					DEFAULT: 'var(--success)',
					bg: 'var(--success-bg)',
				},
				warning: {
					DEFAULT: 'var(--warning)',
					bg: 'var(--warning-bg)',
				},
				purple: {
					DEFAULT: 'var(--purple)',
					bg: 'var(--purple-bg)',
				},
			},
			fontFamily: {
				sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
				mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
			},
			fontSize: {
				hero: ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
				title: ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
				subtitle: ['1.5rem', { lineHeight: '1.3' }],
				'body-lg': ['1.125rem', { lineHeight: '1.6' }],
				body: ['1rem', { lineHeight: '1.5' }],
				small: ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],
				caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
				code: ['0.875rem', { lineHeight: '1.4' }],
			},
			// 8-point spacing system
			spacing: {
				'0.5': '0.125rem', // 2px - micro adjustments
				'1': '0.25rem',    // 4px - optical fine-tuning
				'2': '0.5rem',     // 8px - base unit
				'3': '0.75rem',    // 12px - intermediate
				'4': '1rem',       // 16px - standard spacing
				'5': '1.25rem',    // 20px - intermediate
				'6': '1.5rem',     // 24px - section spacing
				'8': '2rem',       // 32px - large spacing
				'10': '2.5rem',    // 40px
				'12': '3rem',      // 48px - extra large
				'16': '4rem',      // 64px - page-level rhythm
				'20': '5rem',      // 80px
				'24': '6rem',      // 96px - major sections
				'32': '8rem',      // 128px
				// Layout-specific widths
				'70': '17.5rem',   // 280px - left sidebar
				'80': '20rem',     // 320px - right sidebar
			},
			borderRadius: {
				sm: '0.5rem',      // 8px
				md: '0.75rem',     // 12px
				lg: '1rem',        // 16px
				xl: '1.5rem',      // 24px
				full: '9999px',
			},
			boxShadow: {
				sm: 'var(--shadow-sm)',
				md: 'var(--shadow-md)',
				lg: 'var(--shadow-lg)',
				hover: 'var(--shadow-hover)',
			},
			animation: {
				'fade-in': 'fadeIn 150ms ease-out',
				'slide-in': 'slideIn 250ms ease-out',
				'xp-gain': 'xpGain 600ms ease-in-out',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
				slideIn: {
					'0%': { transform: 'translateY(0.5rem)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' },
				},
				xpGain: {
					'0%': { transform: 'translateY(0)', opacity: '1' },
					'100%': { transform: 'translateY(-1.25rem)', opacity: '0' },
				},
			},
			// Modern viewport units support
			height: {
				'screen-dynamic': '100dvh',
				'screen-large': '100lvh',
				'screen-small': '100svh',
			},
			minHeight: {
				'screen-dynamic': '100dvh',
				'screen-large': '100lvh',
				'screen-small': '100svh',
			},
		},
	},
	plugins: [
		require('tailwindcss-animate'), 
		require('@tailwindcss/typography'),
	],
}
