window.Color = class Color {
	constructor(...args) {
		this.update(...args);
	}

	update(...args) {
		if (args.length == 1) {
			args = args[0];
			if (args.includes('rgb')) {
				[this.r, this.g, this.b] = args.match(/rgb\((\d+), (\d+), (\d+)\)/).slice(1);
			} else if (args.includes('hsl')) {
				[this.r, this.g, this.b] = this.hslToRgb(...args.match(/hsl\((\d+), (\d+)\%, (\d+)\%\)/).slice(1));
			} else {
				[this.r, this.g, this.b] = this.hexToRgb(args);
			}
		} else {
			if (args.includes('hsl')) {
				args.splice(args.indexOf('hsl'), 1);
				[this.r, this.g, this.b] = this.hslToRgb(...args);
			} else if (args.includes('hex')) {
				args.splice(args.indexOf('hsl'), 1);
				[this.r, this.g, this.b] = this.hexToRgb(args[0]);
			} else {
				let index = args.indexOf('rgb');
				if (index !== -1) {
					args.splice(index, 1);
				}
				[this.r, this.g, this.b] = args;
			}
		}
	}

	rgbToHsl(r, g, b) {
		r /= 255;
		g /= 255;
		b /= 255;
		const l = Math.max(r, g, b);
		const s = l - Math.min(r, g, b);
		const h = s ? (l === r ? (g - b) / s : l === g ? 2 + (b - r) / s : 4 + (r - g) / s) : 0;
		return [60 * h < 0 ? 60 * h + 360 : 60 * h, 100 * (s ? (l <= 0.5 ? s / (2 * l - s) : s / (2 - (2 * l - s))) : 0), (100 * (2 * l - s)) / 2];
	}
	hslToRgb(h, s, l) {
		s /= 100;
		l /= 100;
		const k = (n) => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		return [255 * f(0), 255 * f(8), 255 * f(4)];
	}
	rgbToHex(r, g, b) {
		// Ensure values are within the 0-255 range
		r = Math.max(0, Math.min(255, r));
		g = Math.max(0, Math.min(255, g));
		b = Math.max(0, Math.min(255, b));

		// Convert RGB values to a hex string
		const hex = ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);

		return '#' + hex;
	}
	hexToRgb(hex) {
		// Remove the hash (#) if it exists
		hex = hex.replace(/^#/, '');

		// Parse the hex string to RGB values
		const bigint = parseInt(hex, 16);
		const r = (bigint >> 16) & 255;
		const g = (bigint >> 8) & 255;
		const b = bigint & 255;

		return [r, g, b];
	}

	get(format = 'rgb', asString = true) {
		switch (format) {
			case 'hsl':
				const hsl = this.rgbToHsl(this.r, this.g, this.b);
				if (asString) return `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`;
				return hsl;
			case 'hex':
				return this.rgbToHex(this.r, this.g, this.b);
			default:
				const rgb = [this.r, this.g, this.b];
				if (asString) return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
				return rgb;
		}
	}
};
