/** @type {import('tailwindcss').Config} */

const transform3DImp = `
translate3d(var(--tw-translate-x), var(--tw-translate-y), var(--tw-translate-z)) 
rotateX(var(--tw-rotate-x)) rotateY(var(--tw-rotate-y)) rotateZ(var(--tw-rotate-z)) 
scale3d(var(--tw-scale-x), var(--tw-scale-y), var(--tw-scale-z))
skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) !important`;
const transform2D = `
translate(var(--tw-translate-x), var(--tw-translate-y))
rotate(var(--tw-rotate-x))
scale(var(--tw-scale-x), var(--tw-scale-y))
skew(var(--tw-skew-x), var(--tw-skew-y))
`;

module.exports = {
	content: ['./index.html', './pages/*.{html,js}', './scripts/*.js'],
	theme: {
		backface: {
			visible: 'visible',
			hidden: 'hidden',
			inherit: 'inherit',
			initial: 'initial',
			revert: 'revert',
			'revert-layer': 'revert-layer',
			unset: 'unset',
		},
		extend: {
			colors: {
				navy: {
					100: '#f0f1f3',
					200: '#e0e2e8',
					300: '#c3c6d1',
					400: '#a5abbb',
					500: '#616d8a',
					600: '#515e7b',
					700: '#364767',
					800: '#183153',
					900: '#001c40',
				},
			},
			zIndex: {
				1: '1',
				2: '2',
				3: '3',
				4: '4',
				5: '5',
				6: '6',
				7: '7',
				8: '8',
				9: '9',
				inf: '1000000',
			},
		},
	},
	corePlugins: {
		translate: false,
		rotate: false,
		scale: false,
	},
	plugins: [
		// Default Values
		function ({ addBase }) {
			const base = { '--tw-translate-x': '0', '--tw-translate-y': '0', '--tw-translate-z': '0', '--tw-rotate-x': '0', '--tw-rotate-y': '0', '--tw-rotate-z': '0', '--tw-scale-x': '1', '--tw-scale-y': '1', '--tw-scale-z': '1' };
			addBase({ '::backdrop': base });
			addBase({ '*, ::before, ::after': base });
		},

		// child-*
		function ({ addVariant, e }) {
			addVariant('child', '& > *');
			addVariant('child-first', '& > *:first-child');
			addVariant('child-last', '& > *:last-child');
			addVariant('child-even', '& > *:nth-child(even)');
			addVariant('child-odd', '& > *:nth-child(odd)');
		},

		// 3D: Translate | Rotate | Scale
		function ({ matchUtilities, theme }) {
			// Translate XYZ
			matchUtilities(
				{
					'translate-x': (value) => ({
						'--tw-translate-x': value,
						transform: transform2D,
					}),
				},
				{ values: theme('translate'), supportsNegativeValues: true }
			);
			matchUtilities(
				{
					'translate-y': (value) => ({
						'--tw-translate-y': value,
						transform: transform2D,
					}),
				},
				{ values: theme('translate'), supportsNegativeValues: true }
			);
			matchUtilities(
				{
					'translate-z': (value) => ({
						'--tw-translate-z': value,
						transform: transform3DImp,
					}),
				},
				{ values: theme('translate'), supportsNegativeValues: true }
			);
			// Rotate XYZ
			matchUtilities(
				{
					'rotate-x': (value) => ({
						'--tw-rotate-x': value,
						transform: transform2D,
					}),
				},
				{ values: theme('rotate'), supportsNegativeValues: true }
			);
			matchUtilities(
				{
					'rotate-y': (value) => ({
						'--tw-rotate-y': value,
						transform: transform3DImp,
					}),
				},
				{ values: theme('rotate'), supportsNegativeValues: true }
			);
			matchUtilities(
				{
					'rotate-z': (value) => ({
						'--tw-rotate-z': value,
						transform: transform3DImp,
					}),
				},
				{ values: theme('rotate'), supportsNegativeValues: true }
			);
			// Scale XYZ
			matchUtilities(
				{
					'scale-x': (value) => ({
						'--tw-scale-x': value,
						transform: transform2D,
					}),
				},
				{ values: theme('scale'), supportsNegativeValues: true }
			);
			matchUtilities(
				{
					'scale-y': (value) => ({
						'--tw-scale-y': value,
						transform: transform2D,
					}),
				},
				{ values: theme('scale'), supportsNegativeValues: true }
			);
			matchUtilities(
				{
					'scale-z': (value) => ({
						'--tw-scale-z': value,
						transform: transform3DImp,
					}),
				},
				{ values: theme('scale'), supportsNegativeValues: true }
			);
		},

		// Randoms
		function ({ matchUtilities, theme }) {
			// Backface
			matchUtilities(
				{
					backface: (value) => ({
						'backface-visibility': value,
					}),
				},
				{ values: theme('backface') }
			);
		},

		function ({ addUtilities }) {
			// transform-3d
			addUtilities({
				'.transform-3d': {
					transform: transform3DImp,
				},
			});

			// preserve-3d
			addUtilities({
				'.preserve-3d': {
					'transform-style': 'preserve-3d',
				},
			});
		},
		function ({ addUtilities }) {
			const timings = {
				css: 'ease',
				'css-in': 'ease-in',
				'css-out': 'ease-out',
				'css-in-out': 'ease-in-out',
				'in-sine': 'cubic-bezier(0.12, 0, 0.39, 0)',
				'out-sine': 'cubic-bezier(0.61, 1, 0.88, 1)',
				'in-out-sine': 'cubic-bezier(0.37, 0, 0.63, 1)',
				'in-quad': 'cubic-bezier(0.11, 0, 0.5, 0)',
				'out-quad': 'cubic-bezier(0.5, 1, 0.89, 1)',
				'in-out-quad': 'cubic-bezier(0.45, 0, 0.55, 1)',
				'in-cubic': 'cubic-bezier(0.32, 0, 0.67, 0)',
				'out-cubic': 'cubic-bezier(0.33, 1, 0.68, 1)',
				'in-out-cubic': 'cubic-bezier(0.65, 0, 0.35, 1)',
				'in-quart': 'cubic-bezier(0.5, 0, 0.75, 0)',
				'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
				'in-out-quart': 'cubic-bezier(0.76, 0, 0.24, 1)',
				'in-quint': 'cubic-bezier(0.64, 0, 0.78, 0)',
				'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
				'in-out-quint': 'cubic-bezier(0.83, 0, 0.17, 1)',
				'in-expo': 'cubic-bezier(0.7, 0, 0.84, 0)',
				'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
				'in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
				'in-circ': 'cubic-bezier(0.55, 0, 1, 0.45)',
				'out-circ': 'cubic-bezier(0, 0.55, 0.45, 1)',
				'in-out-circ': 'cubic-bezier(0.85, 0, 0.15, 1)',
				'in-back': 'cubic-bezier(0.36, 0, 0.66, -0.56)',
				'out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
				'in-out-back': 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
			};

			for (let timing in timings) {
				addUtilities({ [`.ease-${timing}`]: { 'transition-timing-function': timings[timing] } });
				addUtilities({ [`.animation-ease-${timing}`]: { 'animation-timing-function': timings[timing] } });
			}
		},
	],
};
