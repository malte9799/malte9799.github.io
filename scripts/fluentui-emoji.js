// Usage:   <img fluentui="{emoji_name}">

function iconToUrl(icon) {
	icon = icon.replace('pinata', 'piñata');
	const colors = { default: 'Default', light: 'Light', 'medium-light': 'Medium-Light', medium: 'Medium', 'medium-dark': 'Medium-Dark', dark: 'Dark' };
	const styles = { '3d': '3D', color: 'Color', flat: 'Flat', high_contrast: 'High Contrast' };
	let [_, name, rest] = icon.match(/(.*)(?=_3d|_color|_flat|_high_contrast)_(.*)/);
	name = name.charAt(0).toUpperCase() + name.slice(1);
	name = name.split('_').join('%20');
	let ending = icon.includes('3d') ? '.png' : '.svg';
	let param;

	if (rest.includes('_') && rest != 'high_contrast') {
		let [_, style, color] = rest.match(/(.*)\_(.*)/);
		param = `${colors[color]}/${styles[style]}`;
	} else {
		param = styles[rest];
	}

	return 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji/assets/' + `${name}/${param}/${icon + ending}`;
}

(function () {
	document.querySelectorAll('img').forEach((img) => {
		if (!img.hasAttribute('fluentui')) return;
		img.src = iconToUrl(img.getAttribute('fluentui'));
	});
})();
