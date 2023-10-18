$(loadPage);
$(window).on('popstate ', () => loadPage({ x: innerWidth / 2, y: innerHeight / 2 }));

function averageRGB(color1, color2) {
	const rgb1 = window.rgb.fromString(color1);
	const rgb2 = window.rgb.fromString(color2);

	const average = rgb1.map((value, index) => {
		return Math.round((parseInt(value) + parseInt(rgb2[index])) / 2);
	});
	return window.rgb.toString(average);
}

function changeColor(color) {
	let [h, s, l] = window.rgb.toHSL(color);
	l = l <= 25 ? (l += 5) : (l -= 5);
	return window.hsl.toRGB(h, s, l, true);
}

function loadPage(overwriteMouse = undefined) {
	removeOldEventListeners();
	$('#menu').removeClass('expanded');
	$('.included').addClass('old');
	const $page_old = $('main:not(.old)');
	let page = window.urlParam.get('page') || 'index';
	$.getScript(`/pages/${page}.js`, res => {
		const $page_new = $(getPageContent());
		$page_new
			.find('a[link]')
			.each((i, e) => {
				e.href = '?page=' + $(e).attr('link');
			})
			.on('click', e => {
				e.preventDefault();
				let page = $(e.target).attr('link');
				if ((window.urlParam.get('page') || 'index') == page) return;
				window.urlParam.set('page', page, true, true);
				loadPage();
			});

		$('body').append($page_new);

		if ($page_old.length) page_transition($page_old, $page_new, overwriteMouse);
	});
}

function page_transition($page_old, $page_new, overwriteMouse) {
	const x = overwriteMouse?.x || window.mousePos.x;
	const y = overwriteMouse?.y || window.mousePos.y;
	const $body = $('body');

	$page_old.addClass('old z-1').removeClass('z-3');
	$page_new.addClass('z-3');

	const color_old = $page_old.get(0).style.backgroundColor || $body.get(0).style.backgroundColor;
	const color_new = $page_new.get(0).style.backgroundColor || $body.get(0).style.backgroundColor;
	const transition_color = color_old == color_new ? changeColor(color_old) : averageRGB(color_old, color_new);
	$page_new.css('background-color', color_new);

	const $circle = $(`<div class="fullscreen z-2" style="clip-path:circle(0% at ${x}px ${y}px); background-color:${transition_color};"></div>`);
	$body.append($circle);
	$page_new.css('clip-path', `circle(0% at ${x}px ${y}px)`);

	window.sleep(50).then(() => {
		$page_new.css('clip-path', `circle(150% at ${x}px ${y}px)`);
		$circle.css('clip-path', `circle(300% at ${x}px ${y}px)`);
	});

	sleep(600).then(() => {
		$page_new.css('clip-path', '');
		$page_old.remove();
		$circle.remove();
		$('.included.old').remove();
	});
}

function removeOldEventListeners() {
	Object.values($._data(window, 'events')).forEach(e => {
		if (e[0].namespace == 'temp') {
			$(window).off(`${e[0].type}.temp`);
		}
	});
	Object.values($._data(document, 'events')).forEach(e => {
		if (e[0].namespace == 'temp') {
			$(document).off(`${e[0].type}.temp`);
		}
	});
}
