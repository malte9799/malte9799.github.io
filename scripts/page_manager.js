$(loadPage);

function averageRGB(color1, color2) {
	const regex = /rgb\((\d+), (\d+), (\d+)\)/;
	const match1 = color1.match(regex).slice(1);
	const match2 = color2.match(regex).slice(1);

	const average = match1.map((value, index) => {
		return Math.round((Number(value) + Number(match2[index])) / 2);
	});

	return `rgb(${average.join(', ')})`;
}

function changeColor(color) {
	let colorObj = new Color(color);
	let [h, s, l] = colorObj.get('hsl', false);
	l = l <= 25 ? (l += 5) : (l -= 5);
	colorObj.update('hsl', h, s, l);
	return colorObj.get();
}

function loadPage() {
	$('#menu').removeClass('expanded');
	$('.included').addClass('old');
	let section_old = $('section:not(.old)');
	$.get(`/pages/${getUrlParams('page') || 'index'}.html`, (res) => {
		let section_new = $.parseHTML(res.match(/<section.*>[\s\S]*<\/section>/gm)[0]);
		$(section_new).addClass('fullscreen');
		$('body').append(section_new);
		$('body')
			.find('a[link]')
			.on('click', (e) => {
				let page = $(e.target).attr('link');
				if ((getUrlParams('page') || 'index') == page) return;
				window.history.replaceState(null, null, '?page=' + page);
				loadPage(page);
			});

		if (section_old.length) page_transition(section_old, $(section_new));

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

function page_transition(section_old, section_new) {
	section_old.addClass('old', 'z-[1]');
	section_old.removeClass('z-[3]');
	section_new.addClass('z-[3]');

	let color_old = section_old.get(0).style.backgroundColor;
	let color_new = section_new.get(0).style.backgroundColor;
	let body_color = $('body').get(0).style.backgroundColor;

	if (!color_new) section_new.css('background-color', body_color);
	color_new = color_new || body_color;
	color_old = color_old || body_color;

	let transition_color = color_old == color_new ? changeColor(color_old) : averageRGB(color_old, color_new);

	let circle = $.parseHTML(`<div class="fullscreen z-[2]" style="clip-path:circle(0% at ${window.mousePos.x}px ${window.mousePos.y}px); background-color:${transition_color}; z-index:2"></div>`);
	$('body').append(circle);
	section_new.css('clip-path', `circle(0% at ${window.mousePos.x}px ${window.mousePos.y}px)`);

	sleep(50).then(() => {
		section_new.css('clip-path', `circle(150% at ${window.mousePos.x}px ${window.mousePos.y}px)`);
		$(circle).css('clip-path', `circle(300% at ${window.mousePos.x}px ${window.mousePos.y}px)`);
	});

	sleep(600).then(() => {
		section_new.css('clip-path', '');
		section_old.remove();
		$(circle).remove();
		$('.included.old').remove();
	});
}
