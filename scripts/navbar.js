const hoverZone = 150;
const expandAmount = 100;
const anchorDist = 200;
const curviness = 50;

let curveXExact = 0;
let curveYExact = 0;
let targetX = 0;
let xIteration = 0;
let yIteration = 0;

let animating = false;
let closing = false;

$(function () {
	$('#menu-inner').on('mouseenter', function () {
		$('#menu').addClass('expanded');
	});
	$('#blob').on('mouseenter', function () {
		if (!closing) $('#menu').addClass('expanded');
	});
	$('#menu-inner').on('mouseleave', function () {
		$('#menu').removeClass('expanded');
		closing = true;
		window.sleep(500).then(() => (closing = false));
	});

	$(window).on('mousemove', mouseMove);
});

function mouseMove() {
	const x = window.mousePos.x;
	if (!animating && x <= hoverZone && x > 0) {
		curveYExact = 32;
		$('#hamburger').removeClass('transition');
		window.requestAnimationFrame(svgCurve);
		animating = true;
	}
}

function easeOutExpo(currentIteration, startValue, changeInValue, totalIterations) {
	return changeInValue * (-Math.pow(2, (-10 * currentIteration) / totalIterations) + 1) + startValue;
}

function svgCurve() {
	const x = window.mousePos.x;
	const y = window.mousePos.y;

	if (Math.abs(curveXExact - x) < 1) {
		xIteration = 0;
	} else {
		xIteration = 1;

		if (!$('#menu').hasClass('expanded')) {
			if (x <= hoverZone && x > 0) {
				targetX = -(((60 + expandAmount) / 100) * (x - hoverZone));
			} else {
				targetX = 0;
			}
		}
	}

	yIteration = Math.abs(curveYExact - y) < 1 ? 0 : 1;

	curveXExact = easeOutExpo(xIteration, curveXExact, targetX - curveXExact, 100);
	curveYExact = easeOutExpo(yIteration, curveYExact, y - curveYExact, 100);
	let curveX = curveXExact.round(2) || 0;
	let curveY = curveYExact.round(2);

	const height = window.innerHeight;

	const anchorOffset = (anchorDist - curviness).round(2);

	// const path1 = `M60,${height}H0V0h60v${(curveY - anchorDist).round(2)}`;
	// const curve1 = `c0,${anchorOffset},${curveX},${anchorOffset},${curveX},${anchorDist}`;
	// const curve2 = `S60,${(curveY + curviness).round(2)},60,${(curveY + anchorDist).round(2)}`;
	// const newCurve = path1 + curve1 + curve2 + 'z';

	const newCurve = `M64,${height}H0V0h64v${(curveY - anchorDist).round(2)}c0,${anchorOffset.round(2)},${curveX},${anchorOffset.round(2)},${curveX},${anchorDist}S64,${(curveY + curviness).round(2)},64,${(curveY + anchorDist).round(2)}z`;

	$('#blob-path').attr('d', newCurve);
	$('#blob').width(curveX + 64);
	$('#hamburger').css('transform', `translate(${curveX}px, ${curveY}px)`);

	if (targetX > 0 || curveX > 1) window.requestAnimationFrame(svgCurve);
	else {
		$('#hamburger').addClass('transition');
		$('#hamburger').removeAttr('style');
		$('#blob-path').removeAttr('d');
		animating = false;
	}
}
