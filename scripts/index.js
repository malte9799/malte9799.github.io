// G
window.sleep = (time) => {
	return new Promise((resolve) => setTimeout(resolve, time));
};
window.getUrlParams = (search = undefined) => {
	let params = {};
	decodeURIComponent(window.location.search).replace(/[?&]+([^=&]+)=([^&]*)/g, (m, key, value) => (params[key] = value));
	return search ? params[search] : params;
};

import '/scripts/cursor.js';
import '/scripts/page_manager.js';
