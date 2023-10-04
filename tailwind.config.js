/** @type {import('tailwindcss').Config} */

module.exports = {
	content: ['./index.html', './pages/*.{html,js}', './scripts/*.js'],
	theme: {
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
		},
	},
	plugins: [],
};
