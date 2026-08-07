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
				// Luxe Scholar Brand Colors
				primary: {
					50: 'var(--primary-50)',
					100: 'var(--primary-100)',
					500: 'var(--primary-500)',
					600: 'var(--primary-600)',
					900: 'var(--primary-900)',
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
					hover: 'var(--success-hover)',
					foreground: 'var(--success-foreground)',
				},
				warning: {
					DEFAULT: 'var(--warning)',
					bg: 'var(--warning-bg)',
					hover: 'var(--warning-hover)',
					foreground: 'var(--warning-foreground)',
				},
				purple: {
					DEFAULT: 'var(--purple)',
					bg: 'var(--purple-bg)',
					hover: 'var(--purple-hover)',
					foreground: 'var(--purple-foreground)',
				},
				stage: {
					seed: {
						DEFAULT: 'var(--stage-seed)',
						bg: 'var(--stage-seed-bg)',
						hover: 'var(--stage-seed-hover)',
						foreground: 'var(--stage-seed-foreground)',
					},
					developing: {
						DEFAULT: 'var(--stage-developing)',
						bg: 'var(--stage-developing-bg)',
						hover: 'var(--stage-developing-hover)',
						foreground: 'var(--stage-developing-foreground)',
					},
					supported: {
						DEFAULT: 'var(--stage-supported)',
						bg: 'var(--stage-supported-bg)',
						hover: 'var(--stage-supported-hover)',
						foreground: 'var(--stage-supported-foreground)',
					},
					mature: {
						DEFAULT: 'var(--stage-mature)',
						bg: 'var(--stage-mature-bg)',
						hover: 'var(--stage-mature-hover)',
						foreground: 'var(--stage-mature-foreground)',
					},
				},
				priority: {
					high: {
						DEFAULT: 'var(--priority-high)',
						bg: 'var(--priority-high-bg)',
						hover: 'var(--priority-high-hover)',
						foreground: 'var(--priority-high-foreground)',
					},
					medium: {
						DEFAULT: 'var(--priority-medium)',
						bg: 'var(--priority-medium-bg)',
						hover: 'var(--priority-medium-hover)',
						foreground: 'var(--priority-medium-foreground)',
					},
					low: {
						DEFAULT: 'var(--priority-low)',
						bg: 'var(--priority-low-bg)',
						hover: 'var(--priority-low-hover)',
						foreground: 'var(--priority-low-foreground)',
					},
					overdue: {
						DEFAULT: 'var(--priority-overdue)',
						bg: 'var(--priority-overdue-bg)',
						hover: 'var(--priority-overdue-hover)',
						foreground: 'var(--priority-overdue-foreground)',
					},
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					bg: 'var(--destructive-bg)',
					hover: 'var(--destructive-hover)',
					foreground: 'var(--destructive-foreground)',
				},
				info: {
					DEFAULT: 'var(--info)',
					bg: 'var(--info-bg)',
					hover: 'var(--info-hover)',
					foreground: 'var(--info-foreground)',
				},
				focus: 'var(--focus)',
				overlay: 'var(--overlay)',
			},
			fontFamily: {
				sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
				mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
				serif: ['Playfair Display', 'Merriweather', 'Georgia', 'Times New Roman', 'serif'], // Added serif for Luxe Scholar
			},
			fontSize: {
				hero: ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
				title: ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
				subtitle: ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
				'body-lg': ['1.125rem', { lineHeight: '1.65' }],
				body: ['1rem', { lineHeight: '1.6' }],
				small: ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],
				caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
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
				// Sharper borders for editorial feel
				sm: '0.125rem',      // 2px
				md: '0.25rem',       // 4px
				lg: '0.375rem',      // 6px
				xl: '0.5rem',        // 8px
				control: '0.25rem',
				surface: '0.5rem',
				full: '9999px',
			},
			zIndex: {
				base: '0',
				dropdown: '40',
				overlay: '50',
				modal: '50',
				'modal-stacked': '70',
				tooltip: '60',
				'skip-link': '100',
			},
			boxShadow: {
				sm: 'var(--shadow-sm)',
				md: 'var(--shadow-md)',
				lg: 'var(--shadow-lg)',
				hover: 'var(--shadow-hover)',
			},
			animation: {
				'fade-in': 'fadeIn 200ms ease-out',
				'slide-in': 'slideIn 300ms cubic-bezier(0.16, 1, 0.3, 1)',
				'xp-gain': 'xpGain 600ms ease-in-out',
			},
			transitionDuration: {
				fast: '200ms',
				theme: '300ms',
			},
			transitionTimingFunction: {
				'editorial-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
				slideIn: {
					'0%': { transform: 'translateY(0.75rem)', opacity: '0' },
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
