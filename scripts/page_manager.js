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
	let section_old = $('section:not(.old)');
	let page = window.urlParam.get('page') || 'index';
	$.get(`/pages/${page}.html`, res => {
		let section_new = $.parseHTML(res.match(/<section.*>[\s\S]*<\/section>/gm)[0]);
		$(section_new).addClass('fullscreen');
		$('body').append(section_new);
		$('body')
			.find('a[link]')
			.on('click', e => {
				e.preventDefault();
				let page = $(e.target).attr('link');
				if ((window.urlParam.get('page') || 'index') == page) return;
				window.urlParam.set('page', page, true, true);
				loadPage();
			})
			.each((i, e) => {
				e.href = '?page=' + $(e).attr('link');
			});

		if (section_old.length) page_transition(section_old, $(section_new), overwriteMouse);

		let match = res.match(/<include>[\s\S]*<\/include>/);
		if (!match) return;
		let includes = $.parseHTML(match[0], true);
		loadScripts($(includes).find('script'));
		$(includes)
			.find('link')
			.each((i, e) => {
				$('head').append(`<link class="included" rel="stylesheet" href="${$(e).attr('href')}">`);
			});
	});
}

function loadScripts(scripts) {
	if (!scripts || scripts.length == 0) return;
	if (scripts.eq(0).prop('async')) {
		$.getScript(scripts.eq(0).attr('src')).done(() => {
			loadScripts(scripts.slice(1));
		});
	} else {
		$.getScript(scripts.eq(0).attr('src'));
		loadScripts(scripts.slice(1));
	}
}

function page_transition(section_old, section_new, overwriteMouse) {
	let x = overwriteMouse?.x || window.mousePos.x;
	let y = overwriteMouse?.y || window.mousePos.y;

	section_old.addClass('old', 'z-1');
	section_old.removeClass('z-3');
	section_new.addClass('z-3');

	let color_old = section_old.get(0).style.backgroundColor;
	let color_new = section_new.get(0).style.backgroundColor;
	let body_color = $('body').get(0).style.backgroundColor;

	if (!color_new) section_new.css('background-color', body_color);
	color_new = color_new || body_color;
	color_old = color_old || body_color;

	let transition_color = color_old == color_new ? changeColor(color_old) : averageRGB(color_old, color_new);

	let circle = $.parseHTML(`<div class="fullscreen z-2" style="clip-path:circle(0% at ${x}px ${y}px); background-color:${transition_color};"></div>`);
	$('body').append(circle);
	section_new.css('clip-path', `circle(0% at ${x}px ${y}px)`);

	sleep(50).then(() => {
		section_new.css('clip-path', `circle(150% at ${x}px ${y}px)`);
		$(circle).css('clip-path', `circle(300% at ${x}px ${y}px)`);
	});

	sleep(600).then(() => {
		section_new.css('clip-path', '');
		section_old.remove();
		$(circle).remove();
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
