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
	],
};
