let curveXExact = 0;
let curveYExact = 0;
let targetX = 0;
let xIteration = 0;
let yIteration = 0;

$(function () {
	$('.menu-inner').on('mouseenter', function () {
		$('#menu').addClass('expanded');
	});
	$('.menu-inner').on('mouseleave', function () {
		$('#menu').removeClass('expanded');
	});

	curveYExact = window.mousePos.y;

	window.requestAnimationFrame(svgCurve);
});

function easeOutExpo(currentIteration, startValue, changeInValue, totalIterations) {
	return changeInValue * (-Math.pow(2, (-10 * currentIteration) / totalIterations) + 1) + startValue;
}

function svgCurve() {
	const x = window.mousePos.x;
	const y = window.mousePos.y;
	const hoverZone = 150;
	const expandAmount = 20;

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
	let curveX = Math.round(curveXExact * 100) / 100;
	let curveY = Math.round(curveYExact * 100) / 100;

	const anchorDistance = 200;
	const curviness = 50;
	const height = window.innerHeight;

	const newCurve = `M60,${height}H0V0h60v${curveY - anchorDistance}c0,${anchorDistance - curviness},${curveX},${
		anchorDistance - curviness
	},${curveX},${anchorDistance}S60,${curveY + curviness},60,${curveY + anchorDistance}V${height}z`;

	$('#blob-path').attr('d', newCurve);
	$('#blob').width(curveX + 60);
	$('.hamburger').css('transform', `translate(${curveX}px, ${curveY}px)`);

	window.requestAnimationFrame(svgCurve);
}