// Add this script to your website:  									<script src="https://malte9799.github.io/cdn/fluentui-emoji/fluentui-emoji.js"></script>
// Add a fluent-emoji tag with the emoji name:				<fluent-emoji name="{emoji_name}"></fluent-emoji>
// You can also add all attributes that apply to normal images like: width, style, loading, ismap etc..
// The Alt attributes is set automatically to the emoji name. But you can also set it yourself
// You can also add an image_not_found image by setting window.image_not_found to the image url
// Thats it!
// Full Emoji list can be found at: 									https://malte9799.github.io/?page=icons

const img_not_found = 'https://malte9799.github.io/cdn/fluentui-emoji/not_found.png';
const base_url = 'https://malte9799.github.io/cdn/fluentui-emoji/Emojis/';
class FluentEmojiElement extends HTMLElement {
	constructor() {
		super();
		this.emoji = this.getAttribute('name');
		this.alt = this.getAttribute('alt');

		const img = document.createElement('img');
		if (!this.emoji) {
			img.alt = this.alt || 'Image not found';
			img.src = window.img_not_found || img_not_found;
			this.parentNode.replaceChild(img, this);
			return;
		}

		img.alt = this.emoji;

		for (const attr of this.attributes) {
			if (attr.name !== 'name') {
				img.setAttribute(attr.name, attr.value);
			}
		}

		this.emojiPath = this.emoji.replaceAll('-', '/');
		this.extension = this.emoji.includes('3d') || this.emoji.includes('animated') ? '/256.png' : '.svg';
		img.src = base_url + this.emojiPath + this.extension;
		if (this.extension.includes('.png')) img.srcset = `${base_url}${this.emojiPath}/256.png 256w, ${base_url}${this.emojiPath}/128.png 128w, ${base_url}${this.emojiPath}/64.png 64w, ${base_url}${this.emojiPath}/32.png 32w`;

		this.parentNode.replaceChild(img, this);
	}
}

customElements.define('fluent-emoji', FluentEmojiElement);
