// initialize page on first load
if (localStorage.getItem('darkmode') == "false") {
	$("body").removeClass("active")
}

if (!this.location.hash) $("#index").addClass("current")
$(this.location.hash).addClass("current")

window.onhashchange = () => {
	console.log(document.querySelectorAll('.current'));
	document.getElementsByClassName('current')[0].classList.remove('current')
	if (!this.location.hash) document.getElementById('index').classList.add('current')
	// if (!this.location.hash) $("#index").addClass("current")
	document.getElementById(this.location.hash).classList.add('current')
	// $(this.location.hash).addClass("current")
}

// switch dark/light mode
//document.getElementByClassName("dark-button").addEventListener("click", () => {

//});
$(".dark-button").click(() => {
	document.body.classList.toggle("active")

	localStorage.setItem('darkmode', $("body").hasClass("active"));
});
