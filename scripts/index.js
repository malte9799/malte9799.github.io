const doc = document;
const cursor_circle = doc.querySelector('.cursor-circle');
const cursor_dot = doc.querySelector('.cursor-dot');

window.addEventListener('unload', (e) => onUnload(e));
window.addEventListener('load', (e) => onLoad(e));
window.addEventListener('hashchange', (e) => loadPage());
doc.addEventListener('mousemove', (e) => updateCursor(e));
doc.addEventListener('scroll', (e) => updateCursor(e));

const sleep = (time) => {
	return new Promise((resolve) => setTimeout(resolve, time));
};
const htmlToElement = (html) => {
	let template = document.createElement('template');
	html = html.trim();
	template.innerHTML = html;
	return template.content.firstChild;
};
const averageRGB = (color1, color2) => {
	const regex = /rgb\((\d+), (\d+), (\d+)\)/;
	const match1 = color1.match(regex).slice(1);
	const match2 = color2.match(regex).slice(1);

	const average = match1.map((value, index) => {
		return Math.round((Number(value) + Number(match2[index])) / 2);
	});

	return `rgb(${average.join(', ')})`;
};
const getUrlParams = (search = undefined) => {
	let params = {};
	decodeURIComponent(window.location.search).replace(/[?&]+([^=&]+)=([^&]*)/g, (m, key, value) => (params[key] = value));
	return search ? params[search] : params;
};

let lastPos = { x: 0, y: 0 };
let click = false;
let scale = 1;
const updateCursor = (e = lastPos) => {
	let { clientX: x, clientY: y } = e;
	x = x || lastPos.x;
	y = y || lastPos.y;
	lastPos = { x, y };

	if (!click) scale = 1;
	let target = document.elementFromPoint(x, y);
	if (!click && target.matches('a,span,[onclick],img,video,i')) {
		scale = 3;
	}

	cursor_dot.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
	cursor_circle.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) scale(${scale})`;
};
const clickAnimation = () => {
	click = true;
	scale = 1;
	updateCursor();
	sleep(100).then(() => {
		scale = 3;
		updateCursor();
		click = false;
	});
};

const onUnload = (e) => {
	localStorage.setItem('cursorPos', JSON.stringify(lastPos));
};

const onLoad = (e) => {
	// Load Next Page in Style
	lastPos = JSON.parse(localStorage.getItem('cursorPos'));
	loadPage();
	sleep(100).then(() => (cursor_circle.style.transition = 'transform ease-out 0.1s'));
};

const loadPage = (page = undefined) => {
	let content_old = doc.querySelector('content:not(.old)');
	page = page || getUrlParams('page') || 'main';
	fetch(`./${page}.html`)
		.then((res) => res.text())
		.then((text) => {
			content_new = htmlToElement(text.match(/<content[\s\S]*?>[\s\S]*<\/content>/gm)[0]);
			content_new.className = 'fullscreen';
			doc.body.appendChild(content_new);
			updateCursor();

			if (content_old) {
				clickAnimation();
				content_old.classList.add('old');
				let circle = doc.createElement('div');
				circle.className = 'fullscreen';
				doc.body.appendChild(circle);
				circle.style.zIndex = 2;
				let color_old = content_old.style.backgroundColor;
				let color_new = content_new.style.backgroundColor;
				let color;
				if (color_old == color_new) color = color_new;
				else color = averageRGB(color_old, color_new);
				circle.style.backgroundColor = color;

				circle.style.clipPath = `circle(0% at ${lastPos.x}px ${lastPos.y}px`;
				content_new.style.clipPath = `circle(0% at ${lastPos.x}px ${lastPos.y}px`;

				sleep(100).then(() => {
					content_new.style.clipPath = `circle(150% at ${lastPos.x}px ${lastPos.y}px`;
					circle.style.clipPath = `circle(300% at ${lastPos.x}px ${lastPos.y}px`;
				});

				sleep(500).then(() => updateCursor());
				sleep(650).then(() => {
					content_old.remove();
					circle.remove();
				});
			}
		})
		.then(() => {
			doc.querySelectorAll('a').forEach((item) => {
				if (item.getAttribute('link')) {
					item.addEventListener('click', (e) => {
						let page = e.target.attributes.link.nodeValue;
						if (getUrlParams('page') == page) return;
						window.history.replaceState(null, null, '?page=' + page);
						loadPage(page);
					});
				}
			});
		})
		.catch((e) => console.error(e));
};
