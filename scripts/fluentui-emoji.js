// Add this script to your website:  			<script src="https://cdn.jsdelivr.net/gh/malte9799/malte9799.github.io/scripts/fluentui-emoji.js"></script>
// Add a img tag with the fluentui attribute:   <img fluentui="{emoji_name}">
// Let the script do the rest
// Full list can be found at: 					https://malte9799.github.io/?page=icons

var img_not_found = 'https://cdn.jsdelivr.net/gh/malte9799/cdn/fluentui-emoji/not_found.png';

function iconToUrl(icon) {
	icon = icon.replace('pinata', 'piñata');

	const colors = { default: 'Default', light: 'Light', 'medium-light': 'Medium-Light', medium: 'Medium', 'medium-dark': 'Medium-Dark', dark: 'Dark' };
	const styles = { '3d': '3D', color: 'Color', flat: 'Flat', high_contrast: 'High Contrast' };
	let [_, name, rest] = icon.match(/(.*)(?=_3d|_color|_flat|_high_contrast)_(.*)/);

	icon = icon.replace('o_button_blood_type', 'o_button_(blood_type)');

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

document.querySelectorAll('img').forEach((img) => {
	if (!img.hasAttribute('fluentui')) return;
	let image = new Image();
	image.onload = () => (img.src = image.src);
	image.onerror = () => (img.src = img_not_found);
	image.src = iconToUrl(img.getAttribute('fluentui'));
});
