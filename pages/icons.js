window.templates.icon_card = `
<article class="overflow-hidden">
	<button class="flex flex-col items-center w-full h-full bg-gray-800 rounded-lg">
		<img loading="lazy" class="w-3/4"/>
		<span class="box-border inline-flex items-center m-1 mt-0 overflow-hidden text-xs leading-4 text-gray-300 break-words pointer-events-none min-h-[2rem] line-clamp-2 text-ellipsis"></span>
	</button>
</article>`;

window.templates.icon_detail = `
<div class="fixed inset-0 w-screen overflow-y-auto bg-gray-800 bg-opacity-50 z-.1 event">
   <div id="modal" class="flex items-start justify-center min-h-full text-center ">
      <div class="w-full p-8 mx-6 my-8 text-left transition-all transform bg-gray-900 shadow-xl rounded-xl max-w-7xl md:w-[80vw] md:mx-auto">
         <div>
            <button id="icon_name" class="font-bold text-white transition-colors text-[2rem] hover:text-blue-400 group" aria-label="Copy Icon Name" data-balloon-pos="up"></button>
         </div>
         <div class="flex flex-row flex-wrap gap-8 mt-12">
            <div class="basis-full xl:basis-0 grow-0 xl:grow">
               <div class="flex-col bg-[#183153] rounded-2xl min-h-[3em]">
                  <div class="relative z-10 flex flex-col items-center justify-center py-8 overflow-hidden min-h-[20rem]">
                     <img id="preview" class="flex pointer-events-none grow"/>
                  </div>
               </div>
            </div>
            <div class="basis-full xl:basis-0 grow-0 xl:grow">
               <div id="selector" class="flex flex-col justify-center h-full gap-4 md:gap-8 max-h-[20rem]">
               </div>
            </div>
         </div>
         <div id="house" class="pt-12 mt-8 text-start">
            <div>
               <div role="tablist" class="flex flex-row text-sm font-bold text-white flex-nowrap overflow-clip bg-slate-800 rounded-t-md">
                  <button role="tab" class="flex flex-row items-center px-5 py-3 bg-[#183153]">
                  HTML
                  </button>
                  <button role="tab" class="flex flex-row items-center invisible px-5 py-3">
                  SVG
                  </button>
               </div>
            </div>
            <div>
               <button role="tabpanel" id="" class="p-0 bg-[#183153] rounded-b-md w-full text-start [--balloon-color:#146ebe]"  aria-label="Copy Code Snippet" data-balloon-pos="up">
                	<div class="p-10" id="code"></div>
               </button>
            </div>
         </div>
      </div>
   </div>
</div>`;

window.templates.icon_detail_selector = `<div class="flex flex-row h-full max-h-[50%] min-h-[1rem] child-first:rounded-l-2xl child-first:border-l-4 child-last:rounded-r-2xl child-last:border-r-4"></div>`;
window.templates.icon_detail_selector_img = `<button class="flex items-center justify-center flex-1 w-full transition-colors border-gray-800 hover:bg-gray-800 border-x-2 border-y-4 grow"><img class="max-h-full" width="100vh"/></button>`;

var icons_per_page = 200;
var icon_data;

$(function () {
	if (!window.getUrlParams('p')) window.setUrlParam('p', 1);
	if (!window.getUrlParams('s')) window.setUrlParam('s', '3d');
	if (!window.getUrlParams('c')) window.setUrlParam('c', 'medium');

	let p = window.getUrlParams('p');
	getEmojiData().then((data) => {
		icon_data = data;
		data = data.slice(icons_per_page * (p - 1), icons_per_page * p);

		if (window.getUrlParams('view')) show_details(window.getUrlParams('view').split('-')[0]);

		let icon_container = $('#icon_container');
		data.forEach((icon) => {
			icon_container.append(createIconArticle(icon));
		});
	});
});

function getEmojiData() {
	return fetch('https://cdn.jsdelivr.net/gh/malte9799/cdn/fluentui-emoji/list.json')
		.then((res) => {
			if (!res.ok) throw new Error('Network response was not ok');
			return res.json();
		})
		.then((data) => {
			return data;
		});
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

	btn.off('click.show_details').on('click.show_details', () => show_details(icon_name));
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

	temp.find('#icon_name').html(`${icon}<span id="icon_style" class="text-lg text-gray-500 transition-colors pointer-events-none group-hover:text-blue-400">_${icon_style}</span>`);
	temp.find('#icon_name').on('click', (e) => {
		window.copyToClipboard(window.getUrlParams('view').replace('-', '_'));
		$(e.target).attr('aria-label', 'Copied');
		window.sleep(2000).then(() => $(e.target).attr('aria-label', 'Copy Icon Name'));
	});
	temp.find('#preview').attr('src', iconToUrl(`${icon}_${icon_style}`));

	if (color) {
		color_selector = selector.clone();
		color_selector.attr('id', 'color_selector');
		colors.forEach((c) => {
			let button = img.clone();
			button.on('click', () => update_details('color', c));
			let i = button.find('img').attr('src', iconToUrl(`${icon}_${style}_${c}`));
			color_selector.append(i.prevObject);
		});
		temp.find('#selector').append(color_selector);
	}

	selector.attr('id', 'style_selector');
	styles.forEach((s) => {
		let icon_style = color ? `${s}_${color}` : s;
		let button = img.clone();
		button.on('click', () => update_details('style', s));
		let i = button.find('img').attr('src', iconToUrl(`${icon}_${icon_style}`));
		if (s == 'high_contrast') i.addClass('invert');
		selector.append(i.prevObject);
	});
	temp.find('#selector').append(selector);

	temp.find('#code').html(Prism.highlight(`<img fluentui="${icon}_${icon_style}">`, Prism.languages.markup, 'html'));

	temp.hide().fadeIn(500);
	$('section').append(temp);

	$(window)
		.off('click.hide_details')
		.off('popstate.icons')
		.on('click.hide_details', (e) => {
			if (e.target.id == 'modal') {
				window.removeUrlParam('view');
				$(e.target)
					.parent()
					.fadeOut(200, () => {
						$('#modal').parent().remove();
						$(window).off('click.hide_details').off('pagehide.icons');
					});
			}
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
