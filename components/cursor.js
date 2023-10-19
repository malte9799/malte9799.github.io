class CursorElement extends HTMLElement {
	constructor() {
		super();

		$(this).addClass('fixed z-inf mix-blend-difference');

		this.circle = $('<div class="pointer-events-none fixed h-5 w-5 rounded-full border"></div>');
		$(this).append(this.circle);

		this.dot = $('<div class="pointer-events-none fixed h-1 w-1 rounded-full bg-white"></div>');
		$(this).append(this.dot);

		$(window).on('pagehide', this.onUnload.bind(this));
		$(document).on('mousemove', this.updateCursor.bind(this));
		$(document).on('scroll', this.updateCursor.bind(this));
		$(document).on('click', this.onClick.bind(this));

		this.click = false;
		this.scale = 1;
	}

	connectedCallback() {
		window.mousePos = JSON.parse(localStorage.getItem('mousePos')) || { x: innerWidth / 2, y: innerHeight / 2 };
		this.updateCursor();
		window.sleep(100).then(() => {
			this.circle.css('transition', 'transform ease-out 0.1s');
			this.updateCursor();
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
