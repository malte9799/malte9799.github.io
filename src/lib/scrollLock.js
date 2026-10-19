// Freeze or release page scrolling (e.g. while a dialog is open). A smooth-scroll
// library can register its own handler; without one the page just gets overflow:hidden.
let handler = null;

export const setScrollLockHandler = fn => {
  handler = fn;
};

export function setScrollLocked(locked) {
  if (handler) handler(locked);
  else document.documentElement.style.overflow = locked ? 'hidden' : '';
}
