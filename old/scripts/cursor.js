$(onLoad);
$(window).on('pagehide', onUnload);
$(document).on('mousemove', updateCursor);
$(document).on('scroll', updateCursor);
$(document).on('click', onClick);

let click = false;
let scale = 1;

function onLoad() {
	window.mousePos = JSON.parse(localStorage.getItem('mousePos')) || { x: innerWidth / 2, y: innerHeight / 2 };
	updateCursor();
	window.sleep(100).then(() => {
		$('#cursor-circle').css('transition', 'transform ease-out 0.1s');
	});
}

function onUnload() {
	localStorage.setItem('mousePos', JSON.stringify(window.mousePos));
}

function updateCursor(e = undefined) {
	let x = e && e.clientX ? e.clientX : window.mousePos.x;
	let y = e && e.clientY ? e.clientY : window.mousePos.y;
	window.mousePos = { x, y };

	if (!click) scale = 1;
	let target = document.elementFromPoint(x, y);
	if (!click && target?.matches('a,button,img,li,input')) scale = 3;

	$('#cursor-dot').css('transform', `translate(calc(${x}px - 50%), calc(${y}px - 50%))`);
	$('#cursor-circle').css('transform', `translate(calc(${x}px - 50%), calc(${y}px - 50%)) scale(${scale})`);
}
function onClick() {
	if ((scale == 3) == !click) {
		click = true;
		scale = 1;
		updateCursor();
		window.sleep(100).then(() => {
			scale = 3;
			updateCursor();
			click = false;
		});
	}
}
