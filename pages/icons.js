window.templates.icon_card = `
<article class="overflow-hidden">
  <button class="flex h-full w-full flex-col items-center rounded-lg bg-gray-800">
    <img loading="lazy" class="w-3/4" />
    <span class="pointer-events-none m-1 mt-0 box-border line-clamp-2 inline-flex min-h-[2rem] items-center overflow-hidden text-ellipsis break-words text-xs leading-4 text-gray-300"></span>
  </button>
</article>
`;
window.templates.icon_detail = `
<div class="z-.1 event fixed inset-0 w-screen overflow-y-auto bg-gray-800 bg-opacity-50">
  <div id="modal" class="flex min-h-full items-start justify-center text-center">
    <div class="mx-6 my-8 w-full max-w-7xl transform rounded-xl bg-gray-900 p-8 text-left shadow-xl transition-all md:mx-auto md:w-[80vw]">
      <div>
        <button id="icon_name" class="group text-[2rem] font-bold text-white transition-colors hover:text-blue-400" aria-label="Copy Icon Name" data-balloon-pos="up"></button>
      </div>
      <div class="mt-12 flex flex-row flex-wrap gap-8">
        <div class="grow-0 basis-full xl:grow xl:basis-0">
          <div class="min-h-[3em] flex-col rounded-2xl bg-[#183153]">
            <div class="relative z-10 flex min-h-[20rem] flex-col items-center justify-center overflow-hidden py-8">
              <img id="preview" class="pointer-events-none flex grow" />
            </div>
          </div>
        </div>
        <div class="grow-0 basis-full xl:grow xl:basis-0">
          <div id="selector" class="flex h-full max-h-[20rem] flex-col justify-center gap-4 md:gap-8"></div>
        </div>
      </div>
      <div id="house" class="mt-8 pt-12 text-start">
        <div>
          <div role="tablist" class="flex flex-row flex-nowrap overflow-clip rounded-t-md bg-slate-800 text-sm font-bold text-white">
            <button role="tab" class="flex flex-row items-center bg-[#183153] px-5 py-3">HTML</button>
            <button role="tab" class="invisible flex flex-row items-center px-5 py-3">SVG</button>
          </div>
        </div>
        <div>
          <button role="tabpanel" id="" class="w-full rounded-b-md bg-[#183153] p-0 text-start [--balloon-color:#146ebe]" aria-label="Copy Code Snippet" data-balloon-pos="up">
            <div class="p-10" id="code"></div>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
`;
window.templates.icon_detail_selector = `<div class="child-first:rounded-l-2xl child-first:border-l-4 child-last:rounded-r-2xl child-last:border-r-4 flex h-full max-h-[50%] min-h-[1rem] flex-row"></div>`;
window.templates.icon_detail_selector_img = `<button class="flex w-full flex-1 grow items-center justify-center border-x-2 border-y-4 border-gray-800 transition-colors hover:bg-gray-800"><img class="max-h-full" width="100vh" /></button>`;

var icons_per_page = 200;
var icon_data;

$(function () {
	if (!window.getUrlParams('p')) window.setUrlParam('p', 1);
	if (!window.getUrlParams('s')) window.setUrlParam('s', '3d');
	if (!window.getUrlParams('c')) window.setUrlParam('c', 'medium');

	let p = window.getUrlParams('p');
	getIconData().then(data => {
		icon_data = data;
		data = data.slice(icons_per_page * (p - 1), icons_per_page * p);

		if (window.getUrlParams('view')) show_details(window.getUrlParams('view').split('-')[0]);

		let icon_container = $('#icon_container');
		data.forEach(icon => {
			icon_container.append(createIconArticle(icon));
		});
	});
});

async function getIconData() {
	const res = await fetch('https://malte9799.github.io/cdn/fluentui-emoji/list.json');
	if (!res.ok) throw new Error('Network response was not ok');
	const data = await res.json();
	return data;
}

function createIconArticle(icon) {
	let icon_name = icon.replace('-color', '');
	let hasColor = icon.includes('-color');

	let style = window.getUrlParams('s');
	let color = window.getUrlParams('c');

	let icon_style = hasColor ? `${style}_${color}` : style;

	const icon_card = $($.parseHTML(templates.icon_card.trim()));
	icon_card.attr('id', `fluentui-${icon_name}`);

	let btn = icon_card.find('button');
	let img = icon_card.find('img');
	let span = icon_card.find('span');

	btn.on('click', () => show_details(icon_name));
	img.attr('src', iconToUrl(`${icon_name}_${icon_style}`));
	span.text(icon_name.replace('_', '-'));

	return icon_card;
}

function show_details(icon) {
	let style, color;
	if (window.getUrlParams('view')) {
		[style, ...color] = window.getUrlParams('view').split('-').slice(1);
		color = color.join('-');
	} else {
		style = window.getUrlParams('s');
		color = icon_data.includes(icon + '-color') ? window.getUrlParams('c') : undefined;
	}

	let icon_style = color ? `${style}-${color}` : style;
	window.setUrlParam('view', `${icon}-${icon_style}`);
	icon_style = icon_style.replace('-', '_');

	let styles = ['3d', 'color', 'flat'];
	const colors = ['default', 'light', 'medium-light', 'medium', 'medium-dark', 'dark'];
	if (!color) styles.push('high_contrast');

	let temp = $($.parseHTML(window.templates.icon_detail.trim()));
	let selector = $($.parseHTML(window.templates.icon_detail_selector.trim()));
	let img = $($.parseHTML(window.templates.icon_detail_selector_img.trim()));

	temp.find('#icon_name').html(`${icon}<span id="icon_style" class="pointer-events-none text-lg text-gray-500 transition-colors group-hover:text-blue-400">_${icon_style}</span>`);
	temp.find('#icon_name').on('click', e => {
		window.copyToClipboard(window.getUrlParams('view').replace('-', '_'));
		$(e.target).attr('aria-label', 'Copied');
		window.sleep(2000).then(() => $(e.target).attr('aria-label', 'Copy Icon Name'));
	});
	temp.find('#preview').attr('src', iconToUrl(`${icon}_${icon_style}`));

	if (color) {
		color_selector = selector.clone();
		color_selector.attr('id', 'color_selector');
		colors.forEach(c => {
			let button = img.clone();
			button.on('click', () => update_details('color', c));
			let i = button.find('img').attr('src', iconToUrl(`${icon}_${style}_${c}`));
			color_selector.append(i.prevObject);
		});
		temp.find('#selector').append(color_selector);
	}

	selector.attr('id', 'style_selector');
	styles.forEach(s => {
		let icon_style = color ? `${s}_${color}` : s;
		let button = img.clone();
		button.on('click', () => update_details('style', s));
		let i = button.find('img').attr('src', iconToUrl(`${icon}_${icon_style}`));
		if (s == 'high_contrast') i.addClass('invert');
		selector.append(i.prevObject);
	});
	temp.find('#selector').append(selector);

	temp.find('#code').html(Prism.highlight(`<img fluentui="${icon}_${icon_style}">`, Prism.languages.markup, 'html'));

	temp.hide();
	$('section').append(temp);
	temp.fadeIn(200);

	$(window).on('click.temp', e => {
		if (e.target.id == 'modal') {
			close_details();
		}
	});
	$(document).on('keydown.temp', e => {
		if (e.key == 'Escape') {
			close_details();
		}
	});
}

function close_details() {
	window.removeUrlParam('view');
	$(window).off('click.temp');
	$(document).off('keydown.temp');

	const modal = $('#modal').parent();
	$(modal).fadeOut(200, () => {
		modal.remove();
	});
}

function update_details(type, value) {
	const styles = ['3d', 'color', 'flat', 'high_contrast'];
	const colors = ['default', 'light', 'medium-light', 'medium', 'medium-dark', 'dark'];

	let icon = $('#modal').find('#icon_name').html().split('<')[0];
	let [style, ...color] = window.getUrlParams('view').split('-').slice(1);
	color = color.join('-');
	if (type == 'style') style = value;
	if (type == 'color') color = value;
	let icon_style_ = color ? `${style}-${color}` : style;
	let icon_style = icon_style_.replace('-', '_');
	window.setUrlParam('view', `${icon}-${icon_style_}`);

	const modal = $('#modal');
	modal.find('#icon_style').html('_' + icon_style);
	modal.find('#preview').attr('src', iconToUrl(`${icon}_${icon_style}`));
	if (icon_style.includes('high_contrast')) modal.find('#preview:not(.invert)').addClass('invert');
	else modal.find('#preview.invert').removeClass('invert');

	modal.find('#code').html(Prism.highlight(`<img fluentui="${icon}_${icon_style}">`, Prism.languages.markup, 'html'));

	if (type == 'style') {
		$('#color_selector')
			.children()
			.each((i, e) => {
				let img = $(e).children();
				img.attr('src', iconToUrl(`${icon}_${style}_${colors[i]}`));
			});
	} else if (type == 'color') {
		$('#style_selector')
			.children()
			.each((i, e) => {
				let img = $(e).children();
				img.attr('src', iconToUrl(`${icon}_${styles[i]}_${color}`));
			});
	}
}
