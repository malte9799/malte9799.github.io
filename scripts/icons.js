templates.icon_card = `
		<article class="overflow-hidden">
			<button class="flex flex-col items-center w-full h-full bg-gray-800 rounded-lg">
				<img loading="lazy" class="w-3/4"/>
				<span class="box-border inline-flex items-center m-1 mt-0 overflow-hidden text-xs leading-4 text-gray-300 break-words pointer-events-none min-h-[2rem] line-clamp-2 text-ellipsis"></span>
			</button>
		</article>`;

templates.icon_detail = `
<div class="fixed inset-0 z-10 w-screen overflow-y-auto bg-gray-800 bg-opacity-50 event">
	<div id="modal" class="flex items-start justify-center min-h-full text-center ">
		<div class="w-full p-8 mx-6 my-8 overflow-hidden text-left transition-all transform bg-gray-900 shadow-xl rounded-xl max-w-7xl md:w-[80vw] md:mx-auto">
			<div>
				<button id="icon_name" class="font-bold text-white text-[2rem]" id="modal-title"></button>
			</div>

			<div class="flex flex-row flex-wrap gap-8 mt-12">
				<div class="basis-full xl:basis-0 grow-0 xl:grow">
					<div class="flex-col bg-blue-950 rounded-2xl min-h-[3em]">
						<div class="relative z-10 flex-col py-8 min-h-[20rem]">
							<button class="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
								<img id="preview" />
							</button>
						</div>
					</div>
				</div>
				<div class="basis-full xl:basis-0 grow-0 xl:grow">
					<div id="selector" class="flex flex-col justify-center h-full gap-4 md:gap-8 min-h-[3em]">
					</div>
				</div>
			</div>
				
			<div class="flex flex-row flex-wrap gap-8 pt-12 mt-8 bg-slate-600"></div>
		</div>
	</div>
</div>
`;
templates.icon_detail_selector = `<div class="flex flex-row max-h-32 [&>*:first-child]:rounded-l-2xl [&>*:first-child]:border-l-4 [&>*:last-child]:rounded-r-2xl [&>*:last-child]:border-r-4"></div>`;
templates.icon_detail_selector_img = `<button class="flex flex-col items-center w-0 transition-colors border-gray-800 hover:bg-gray-800 border-x-2 border-y-4 grow"><img class="h-full" /></button>`;

icons_per_page = 200;

$(function () {
	style = getUrlParams('s') || '3d';
	color = getUrlParams('c') || 'medium';

	icon_container = $('#icon_container'); //document.querySelector('#icon_container');

	let p = getUrlParams('p') || 1;
	getEmojiData().then((data) => {
		data = data.slice(icons_per_page * (p - 1), icons_per_page * p);
		data.forEach((icon) => {
			icon_container.append(createIconArticle(icon));
		});
	});
});

function hashchange() {}

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
	let icon_style = hasColor ? `${style}_${color}` : style;

	const icon_card = $($.parseHTML(templates.icon_card.trim()));
	icon_card.attr('id', `fluentui-${icon_name}`);

	let btn = icon_card.find('button');
	let img = icon_card.find('img');
	let span = icon_card.find('span');

	btn.on('click', () => show_details(icon_name, style, hasColor ? color : undefined));

	img.attr('src', '/assets/images/loading.svg');
	let image = new Image();
	image.onload = () => img.attr('src', image.src);
	image.onerror = () => img.attr('src', img_not_found);
	image.src = iconToUrl(`${icon_name}_${icon_style}`);

	span.text(icon_name.replaceAll('_', '-'));

	return icon_card;
}

function show_details(icon, style, color = undefined) {
	let styles = ['3d', 'color', 'flat'];
	if (!color) styles.push('high_contrast');
	const colors = ['default', 'light', 'medium-light', 'medium', 'medium-dark', 'dark'];

	let temp = $($.parseHTML(templates.icon_detail.trim()));
	let selector = $($.parseHTML(templates.icon_detail_selector.trim()));
	let img = $($.parseHTML(templates.icon_detail_selector_img.trim()));

	temp.find('#icon_name').html(icon);
	temp.find('#preview').attr('src', iconToUrl(color ? `${icon}_${style}_${color}` : `${icon}_${style}`));

	if (color) {
		color_selector = selector.clone();
		color_selector.attr('id', 'color_selector');
		colors.forEach((c) => {
			let i = img
				.clone()
				.find('img')
				.attr('src', iconToUrl(`${icon}_${style}_${c}`));
			color_selector.append(i.prevObject);
		});
		temp.find('#selector').append(color_selector);
	}

	selector.attr('id', 'style_selector');
	styles.forEach((s) => {
		icon_style = color ? `${s}_${color}` : s;
		let i = img
			.clone()
			.find('img')
			.attr('src', iconToUrl(`${icon}_${icon_style}`));

		if (s == 'high_contrast') i.addClass('invert');
		selector.append(i.prevObject);
	});
	temp.find('#selector').append(selector);

	temp.hide().fadeIn(500);
	$('body').append(temp);

	$(window).on('click', (e) => {
		if (e.target.id == 'modal') {
			console.log($(e.target));
			$(e.target).parent().fadeOut(200, this.remove);
		}
	});
}
