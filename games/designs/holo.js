// Holographic — tracks the pointer over each card (and the game board) so the
// foil bands, glitter and 3D tilt follow it.
function _holoTrack(el, tilt) {
  const move = (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--px", (x * 100).toFixed(1) + "%");
    el.style.setProperty("--py", (y * 100).toFixed(1) + "%");
    el.style.setProperty("--bx", (x * 100).toFixed(1) + "%");
    if (tilt) {
      el.style.setProperty("--rx", ((0.5 - y) * 14).toFixed(2) + "deg");
      el.style.setProperty("--ry", ((x - 0.5) * 16).toFixed(2) + "deg");
    }
  };
  const leave = () => { ["--rx", "--ry"].forEach((k) => el.style.removeProperty(k)); };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); ["--px", "--py", "--bx", "--rx", "--ry"].forEach((k) => el.style.removeProperty(k)); };
}

DESIGN_FX.holo = {
  enter() {
    const wrap = document.querySelector("#canvas-wrap:not(.fs)");
    return wrap ? _holoTrack(wrap, false) : null;
  },
  card(el) { _holoTrack(el, matchMedia("(hover: hover)").matches); },
};
