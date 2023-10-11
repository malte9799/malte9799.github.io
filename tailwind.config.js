/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

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

		plugin(function ({ addComponents }) {
			const after_before = {
				content: "''",
				position: 'absolute',
				width: '100%',
				left: 0,
				'border-color': 'black',
				'border-radius': '0.375rem 0.375rem 0 0',
			};
			const label_before = {
				height: '100%',
				'box-shadow': '-1px 0 0 black',
				'border-left-width': '1px',
			};
			const label_after = {
				height: '50%',
				'box-shadow': '1px 0 0 black, 0 -1px 0 black',
				'border-width': '1px 1px 0 0',
			};
			addComponents({
				'.float-label-auto': {
					position: 'relative',
					display: 'flex',
					'align-items': 'center',
					'& > input': {
						position: 'absolute',
						inset: '0px',
						padding: '0 0.75rem 0 0.75rem',
					},
					'& > label': {
						'pointer-events': 'none',
						position: 'absolute',
						top: '0px',
						translate: '0 -50%',
						'border-radius': '0.375rem 0.375rem 0 0',
						padding: '0 0.75rem 0 0.75rem',
					},

					'& > input:placeholder-shown ~ label': {
						top: '50%',
						'background-color': 'transparent',
					},
				},
			});
			addComponents({
				'.float-label-border': {
					'& > label::after': after_before,
					'& > label::before': after_before,
					'& > input:focus-visible:not(:placeholder-shown) ~ label::before': label_before,
					'& > input:-webkit-autofill:focus ~ label::before': label_before,

					'& > input:focus-visible:not(:placeholder-shown) ~ label::after': label_after,
					'& > input:-webkit-autofill:focus ~ label::after': label_after,
				},
			});
		}),
	],
};
