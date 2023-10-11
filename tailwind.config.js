/** @type {import('tailwindcss').Config} */

module.exports = {
	content: ['./index.html', './pages/*.{html,js}', './scripts/*.js'],
	theme: {
		extend: {
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
	plugins: [
		require('tailwindcss-3d'),
		require('tailwindcss-debug-screens'),
		require('tailwindcss-easing'),

		// child-*
		function ({ addVariant, e }) {
			addVariant('child', '& > *');
			addVariant('child-first', '& > *:first-child');
			addVariant('child-last', '& > *:last-child');
			addVariant('child-even', '& > *:nth-child(even)');
			addVariant('child-odd', '& > *:nth-child(odd)');
		},
	],
};
