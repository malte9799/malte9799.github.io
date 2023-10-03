// Global functions and variables
window.sleep = (time) => {
	return new Promise((resolve) => setTimeout(resolve, time));
};
window.getUrlParams = (search = undefined) => {
	let params = {};
	decodeURIComponent(window.location.search).replace(/[?&]+([^=&]+)=([^&]*)/g, (m, key, value) => (params[key] = value));
	return search ? params[search] : params;
};
window.templates = {};
window.isMobile = window.matchMedia('only screen and (max-width: 760px)').matches;

window.img_not_found = 'https://cdn.jsdelivr.net/gh/malte9799/cdn/fluentui-emoji/not_found.png';

import '/scripts/color.js';
import '/scripts/cursor.js';
import '/scripts/page_manager.js';
import '/scripts/navbar.js';
