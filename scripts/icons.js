style = '3d';
color = 'medium';
fluentui_emoji_list = undefined;
icons_per_page = 200;

$(function () {
	window.addEventListener('hashchange', hashchange());

	icon_container = document.querySelector('.container');

	let p = getUrlParams('p') || 1;
	getEmojiData().then((data) => {
		data = data.slice(icons_per_page * (p - 1), icons_per_page * p);
		data.forEach((icon) => {
			icon_container.appendChild(createIconArticle(icon));
		});
	});
});

const hashchange = () => {};

function getEmojiData() {
	if (fluentui_emoji_list) {
		return fluentui_emoji_list;
	}
	return fetch('https://cdn.jsdelivr.net/gh/malte9799/cdn@main/fluentui-emoji-list.json')
		.then((res) => {
			if (!res.ok) throw new Error('Network response was not ok');

			return res.json();
		})
		.then((data) => {
			fluentui_emoji_list = data;
			return data;
		});
}

const createIconArticle = (icon) => {
	let icon_name = icon.replace('-color', '');
	let hasColor = icon.includes('-color');
	let icon_style = hasColor ? `${style}_${color}` : style;

	const article = document.createElement('article');
	article.id = `fluentui-${icon_name}`;

	const button = document.createElement('button');
	button.addEventListener('click', (e) => {
		console.log(`${icon_name}_${icon_style}`);
	});

	const img = document.createElement('img');
	img.src = iconToUrl(`${icon_name}_${icon_style}`);

	const span = document.createElement('span');
	span.textContent = icon_name.replaceAll('_', '-');

	button.appendChild(img);
	button.appendChild(span);
	article.appendChild(button);

	return article;
};
