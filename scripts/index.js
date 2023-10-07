// Global functions and variables
window.sleep = (time) => {
	return new Promise((resolve) => setTimeout(resolve, time));
};

window.getUrlParams = (search = undefined) => {
	let params = {};
	decodeURIComponent(window.location.search).replace(/[?&]+([^=&]+)=([^&]*)/g, (m, key, value) => (params[key] = value));
	return search ? params[search] : params;
};
window.setUrlParam = (key, value, pushState = false, replaceOld = false) => {
	let current = replaceOld ? [] : window.getUrlParams();
	current[key] = value;

	let newParams = '';
	Object.keys(current).forEach((key) => {
		let prefix = newParams == '' ? '?' : '&';
		newParams += prefix + key + '=' + current[key];
	});
	if (pushState) history.pushState(null, '', newParams);
	else history.replaceState(null, '', newParams);
};
window.removeUrlParam = (key, pushState = false) => {
	let current = window.getUrlParams();
	delete current[key];

	let newParams = '';
	Object.keys(current).forEach((key) => {
		let prefix = newParams == '' ? '?' : '&';
		newParams += prefix + key + '=' + current[key];
	});
	if (pushState) history.pushState(null, '', newParams);
	else history.replaceState(null, '', newParams);
};

window.copyToClipboard = (input, isElement = false) => {
	var $temp = $('<input>');
	$('body').append($temp);
	if (isElement) $temp.val($(input).text()).select();
	else $temp.val(input).select();
	document.execCommand('copy');
	$temp.remove();
};

window.templates = {};
window.isMobile = window.matchMedia('only screen and (max-width: 760px)').matches;

window.img_not_found = 'https://cdn.jsdelivr.net/gh/malte9799/cdn/fluentui-emoji/not_found.png';

import '/scripts/color.js';
import '/scripts/cursor.js';
import '/scripts/page_manager.js';
import '/scripts/navbar.js';
