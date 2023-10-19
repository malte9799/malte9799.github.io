// Global functions and variables
window.sleep = time => {
	return new Promise(resolve => setTimeout(resolve, time));
};

window.urlParam = {
	get: (search = undefined) => {
		let params = {};
		decodeURIComponent(window.location.search).replace(/[?&]+([^=&]+)=([^&]*)/g, (m, key, value) => (params[key] = value));
		return search ? params[search] : params;
	},
	set: (key, value, pushState = false, clearOld = false) => {
		let current = clearOld ? [] : window.urlParam.get();
		current[key] = value;

		let newParams = '';
		Object.keys(current).forEach(key => {
			let prefix = newParams == '' ? '?' : '&';
			newParams += prefix + key + '=' + current[key];
		});
		if (pushState) history.pushState(null, '', newParams);
		else history.replaceState(null, '', newParams);
	},
	remove: (key, pushState = false) => {
		let current = window.urlParam.get();
		delete current[key];

		let newParams = '';
		Object.keys(current).forEach(key => {
			let prefix = newParams == '' ? '?' : '&';
			newParams += prefix + key + '=' + current[key];
		});
		if (pushState) history.pushState(null, '', newParams);
		else history.replaceState(null, '', newParams);
	},
};

window.copyToClipboard = (input, isElement = false) => {
	var $temp = $('<input>');
	$('body').append($temp);
	if (isElement) $temp.val($(input).text()).select();
	else $temp.val(input).select();
	document.execCommand('copy');
	$temp.remove();
};

window.templates = {};
window.isMobile = window.matchMedia('only screen and (max-width: 760px)').matches;

window.img_not_found = 'https://malte9799.github.io/cdn/fluentui-emoji/not_found.png';

window.rgb = {
	fromString: string => {
		return string.match(/rgb\((\d+), (\d+), (\d+)\)/).slice(1);
	},
	toString: (r, g, b) => {
		if (Array.isArray(r)) [r, g, b] = r;
		return `rgb(${r}, ${g}, ${b})`;
	},
	toHSL: (r, g, b, asString = false) => {
		if (typeof r == 'string') [r, g, b] = window.rgb.fromString(r);
		else if (Array.isArray(r)) [r, g, b] = r;

		r /= 255;
		g /= 255;
		b /= 255;
		let l = Math.max(r, g, b);
		let s = l - Math.min(r, g, b);
		let h = s ? (l === r ? (g - b) / s : l === g ? 2 + (b - r) / s : 4 + (r - g) / s) : 0;
		[h, s, l] = [60 * h < 0 ? 60 * h + 360 : 60 * h, 100 * (s ? (l <= 0.5 ? s / (2 * l - s) : s / (2 - (2 * l - s))) : 0), (100 * (2 * l - s)) / 2];
		if (asString) return window.hsl.toString(h, s, l);
		return [h, s, l];
	},
};

window.hsl = {
	fromString: string => {
		return string.match(/hsl\((\d+), (\d+), (\d+)\)/).slice(1);
	},
	toString: (h, s, l) => {
		if (Array.isArray(h)) [h, s, l] = h;
		return `hsl(${h}, ${s}, ${l})`;
	},
	toRGB: (h, s, l, asString = false) => {
		if (typeof h == 'string') [h, s, l] = window.hsl.fromString(h);
		else if (Array.isArray(h)) [h, s, l] = h;
		s /= 100;
		l /= 100;
		const k = n => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		let [r, g, b] = [255 * f(0), 255 * f(8), 255 * f(4)];
		if (asString) return window.rgb.toString(r, g, b);
		return [r, g, b];
	},
};

Number.prototype.round = function (places) {
	return +(Math.round(this + 'e+' + places) + 'e-' + places);
};
