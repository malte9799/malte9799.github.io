var template__icon_card = /*html*/ `
<article class="overflow-hidden">
  <button class="flex h-full w-full flex-col items-center rounded-lg bg-gray-800">
    <img loading="lazy" class="w-3/4" />
    <span class="pointer-events-none m-1 mt-0 box-border line-clamp-2 inline-flex min-h-[2rem] items-center overflow-hidden text-ellipsis break-words text-xs leading-4 text-gray-300"></span>
  </button>
</article>`;

class IconCard {
	constructor(emoji) {
		this.emoji = emoji;

		return this.build_template();
	}

	build_template() {
		const icon_card = $($.parseHTML(template__icon_card.trim()));
		icon_card.attr('id', `${this.emoji.full}`);

		let btn = icon_card.find('button');
		let img = icon_card.find('img');
		let span = icon_card.find('span');

		// btn.on('click', () => show_details(emoji));
		img.attr('src', this.emoji.url);
		span.text(this.emoji.name);

		return icon_card;
	}
}
