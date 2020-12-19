$(document).ready(() => {
	// initialize page on first load
	if (localStorage.getItem('darkmode') == "false") {
		$("body").removeClass("active")
		$(".dark-layer").removeClass("active")
		$(".dark-layer-button").removeClass("active")
	}

	if (!this.location.hash) $("#index").addClass("current")
	$(this.location.hash).addClass("current")

	window.onhashchange = function() {
		$(".current").removeClass("current")
		if (!this.location.hash) $("#index").addClass("current")
		$(this.location.hash).addClass("current")
	}

	// switch dark/light mode
	$(".dark-button").click(() => {
		$("body").toggleClass("active")
		$(".dark-layer").toggleClass("active")
		$(".dark-layer-button").toggleClass("active")

		localStorage.setItem('darkmode', $("body").hasClass("active"));
	});

	// switch page on click
	$("a.link").click((e) => {
		$(".current").removeClass("current")
		$(e.target.hash).addClass("current")
	})
});
