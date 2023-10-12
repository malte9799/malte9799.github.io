const hoverZone = 125;
const expandAmount = 50;
const anchorDist = 200;
const curviness = 50;

const navbarWidth = 64;

let curveXExact = 0;
let curveYExact = 0;
let targetX = 0;
let xIteration = 0;
let yIteration = 0;

let animating = false;

$(function () {
	$('#menu-inner').on('mouseenter', function () {
		$('#menu').addClass('expanded');
	});
	$('#menu-inner').on('mouseleave', function () {
		$('#menu').removeClass('expanded');
	});
	$(window).on('mousemove', mouseMove);
});

function mouseMove() {
	const x = window.mousePos.x;
	if (!animating && x <= hoverZone) {
		curveYExact = 32;
		$('#hamburger').removeClass('transition-all');
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
			if (x <= hoverZone) {
				targetX = -(((navbarWidth + expandAmount) / 100) * (x - hoverZone));
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

	const newCurve = `M${navbarWidth},${height}H0V0h${navbarWidth}v${(curveY - anchorDist).round(2)}c0,${anchorOffset.round(2)},${curveX},${anchorOffset.round(2)},${curveX},${anchorDist}S${navbarWidth},${(curveY + curviness).round(2)},${navbarWidth},${(curveY + anchorDist).round(2)}z`;

	$('#blob-path').attr('d', newCurve);
	$('#blob').width(curveX + navbarWidth);
	$('#hamburger').css('translate', `${curveX}px ${curveY}px`);

	if (targetX > 0 || curveX > 1) window.requestAnimationFrame(svgCurve);
	else {
		$('#hamburger').addClass('transition-all');
		$('#hamburger').removeAttr('style');
		$('#blob-path').removeAttr('d');
		animating = false;
	}
}
