class CursorElement extends HTMLElement {
	constructor() {
		super();

		const cursor = $('<div class="fixed z-inf mix-blend-difference"></div>');
		this.circle = $('<div class="pointer-events-none fixed h-5 w-5 rounded-full border"></div>');
		this.dot = $('<div class="pointer-events-none fixed h-1 w-1 rounded-full bg-white"></div>');

		cursor.append(this.circle);
		cursor.append(this.dot);

		$(this).replaceWith($(cursor));

		this.onClick = this.onClick.bind(this);
		this.updateCursor = this.updateCursor.bind(this);
		this.onLoad = this.onLoad.bind(this);
		this.onUnload = this.onUnload.bind(this);

		this.onLoad();
		$(window).on('pagehide', this.onUnload);
		$(document).on('mousemove', this.updateCursor);
		$(document).on('scroll', this.updateCursor);
		$(document).on('click', this.onClick);

		this.click = false;
		this.scale = 1;
	}

	connectedCallback() {
		this.updateCursor();
	}

	onLoad() {
		window.mousePos = JSON.parse(localStorage.getItem('mousePos')) || { x: innerWidth / 2, y: innerHeight / 2 };
		this.updateCursor();
		window.sleep(100).then(() => {
			this.circle.css('transition', 'transform ease-out 0.1s');
		});
	}

	onUnload() {
		localStorage.setItem('mousePos', JSON.stringify(window.mousePos));
	}

	updateCursor(e = undefined) {
		let x = e && e.clientX ? e.clientX : window.mousePos.x;
		let y = e && e.clientY ? e.clientY : window.mousePos.y;
		window.mousePos = { x, y };

		if (!this.click) this.scale = 1;
		let target = document.elementFromPoint(x, y);
		if (!this.click && target?.matches('a,button,img,li,input')) this.scale = 3;

		this.dot.css('transform', `translate(calc(${x}px - 50%), calc(${y}px - 50%)`);
		this.circle.css('transform', `translate(calc(${x}px - 50%), calc(${y}px - 50%)) scale(${this.scale})`);
	}

	onClick() {
		if ((this.scale == 3) == !this.click) {
			this.click = true;
			this.scale = 1;
			this.updateCursor();
			window.sleep(100).then(() => {
				this.scale = 3;
				this.updateCursor();
				this.click = false;
			});
		}
	}
}

customElements.define('cursor-', CursorElement);
