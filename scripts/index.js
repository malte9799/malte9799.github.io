const doc = document;
const cursor_circle = doc.querySelector('.cursor-circle');
const cursor_dot = doc.querySelector('.cursor-dot');
const root = doc.querySelector(':root');

window.addEventListener('unload', (e) => onUnload(e));
window.addEventListener('load', (e) => onLoad(e));
window.addEventListener('hashchange', (e) => loadPage());
doc.addEventListener('mousemove', (e) => updateCursor(e));
doc.addEventListener('scroll', (e) => updateCursor(e));

const sleep = (time) => {
	return new Promise((resolve) => setTimeout(resolve, time));
};
const htmlToElement = (html) => {
	if (!html) return undefined;
	let template = document.createElement('template');
	html = html[0].trim();
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
const updateCursor = (e = undefined) => {
	let x = e ? e.clientX : lastPos.x;
	let y = e ? e.clientY : lastPos.y;
	lastPos = { x, y };

	if (!click) scale = 1;
	let target = document.elementFromPoint(x, y);
	if (!click && target.matches('a,span,[onclick],img,video,i')) {
		scale = 3;
	}

	root.style.setProperty('--mouseX', x);
	root.style.setProperty('--mouseY', y);
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
const circleAnimation = (section_old, section_new) => {
	section_old.classList.add('old');

	let circle = doc.createElement('div');
	circle.className = 'fullscreen';
	doc.body.appendChild(circle);
	circle.style.zIndex = 2;

	let color_old = section_old.style.backgroundColor;
	let color_new = section_new.style.backgroundColor;
	circle.style.backgroundColor = color_old == color_new ? color_old : averageRGB(color_old, color_new);

	circle.style.clipPath = `circle(0% at ${lastPos.x}px ${lastPos.y}px)`;
	section_new.style.clipPath = `circle(0% at ${lastPos.x}px ${lastPos.y}px)`;

	sleep(100).then(() => {
		section_new.style.clipPath = `circle(150% at ${lastPos.x}px ${lastPos.y}px)`;
		circle.style.clipPath = `circle(300% at ${lastPos.x}px ${lastPos.y}px)`;
	});

	sleep(500).then(() => updateCursor());
	sleep(600).then(() => {
		section_old.remove();
		circle.remove();
	});
};

const onUnload = (e) => {
	localStorage.setItem('cursorPos', JSON.stringify(lastPos));
};

const onLoad = (e) => {
	// Load Next Page in Style
	if (localStorage.getItem('cursorPos')) lastPos = JSON.parse(localStorage.getItem('cursorPos'));
	loadPage();
	sleep(100).then(() => (cursor_circle.style.transition = 'transform ease-out 0.1s'));
};

const loadPage = (page = undefined) => {
	doc.querySelectorAll('.included').forEach((e) => e.remove());

	let section_old = doc.querySelector('section:not(.old)');
	page = page || getUrlParams('page') || 'index';
	fetch(`./pages/${page}.html`)
		.then((res) => res.text())
		.then((text) => {
			let section_new = htmlToElement(text.match(/<section[\s\S]*?>[\s\S]*<\/section>/gm));
			section_new.className = 'fullscreen';
			doc.body.appendChild(section_new);
			loadIncludes(htmlToElement(text.match(/<include[\s\S]*?>[\s\S]*<\/include>/gm)));

			updateCursor();

			if (section_old) {
				clickAnimation();
				circleAnimation(section_old, section_new);
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

const loadIncludes = (dom) => {
	if (!dom) return;
	dom.querySelectorAll('script').forEach((e) => {
		$.getScript(e.attributes.src.nodeValue);
	});
	dom.querySelectorAll('link').forEach((e) => {
		let link = doc.createElement('link');
		link.classList.add('included');
		link.setAttribute('rel', e.attributes.rel.nodeValue);
		link.setAttribute('href', e.attributes.href.nodeValue);
		doc.head.appendChild(link);
	});
};
