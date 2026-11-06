// Pixel art — little sprites bobbing around the title (drawn from ASCII
// bitmaps as box-shadows), and card previews that are crunched down to a
// 150×90 grid and snapped to the 16-colour PICO-8 palette with ordered dither.

const _PX_PALETTE = [[0, 0, 0], [29, 43, 83], [126, 37, 83], [0, 135, 81], [171, 82, 54], [95, 87, 79], [194, 195, 199], [255, 241, 232],
  [255, 0, 77], [255, 163, 0], [255, 236, 39], [0, 228, 54], [41, 173, 255], [131, 118, 156], [255, 119, 168], [255, 204, 170]];
const _PX_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function _pxQuantize(src) {
  const tw = 150, th = 90;
  const tiny = document.createElement("canvas");
  tiny.width = tw; tiny.height = th;
  const t = tiny.getContext("2d", { willReadFrequently: true });
  t.imageSmoothingQuality = "high";
  t.drawImage(src, 0, 0, tw, th);
  const img = t.getImageData(0, 0, tw, th), d = img.data;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = (y * tw + x) * 4, b = (_PX_BAYER[(y & 3) * 4 + (x & 3)] - 7.5) * 1.1;
    const r = d[i] + b, g = d[i + 1] + b, bl = d[i + 2] + b;
    let best = 0, bd = 1e9;
    for (let k = 0; k < 16; k++) {
      const p = _PX_PALETTE[k], dr = r - p[0], dg = g - p[1], db = bl - p[2];
      const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (dist < bd) { bd = dist; best = k; }
    }
    const c = _PX_PALETTE[best];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  t.putImageData(img, 0, 0);
  const g = src.getContext("2d");
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, src.width, src.height);
  g.drawImage(tiny, 0, 0, src.width, src.height);
  g.restore();
}

function _pxSprite(rows, colors, size) {
  const sh = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== ".") sh.push(`${x * size}px ${y * size}px 0 0 ${colors[c]}`); }));
  const el = document.createElement("div");
  el.className = "px-sprite";
  el.style.setProperty("--p", size + "px");
  el.style.width = el.style.height = size + "px";
  el.style.boxShadow = sh.join(",");
  el.setAttribute("aria-hidden", "true");
  return el;
}

const _PX_SPRITES = {
  invader: { c: { "#": "#00e436" }, r: ["..#.....#..", "...#...#...", "..#######..", ".##.###.##.", "###########", "#.#######.#", "#.#.....#.#", "...##.##..."] },
  heart: { c: { "#": "#ff004d", w: "#fff1e8" }, r: [".##.##.", "#w#####", "#######", ".#####.", "..###..", "...#..."] },
  ghost: { c: { "#": "#ff77a8", w: "#fff1e8", b: "#29adff" }, r: ["..#####..", ".#######.", "#ww###ww#", "#wb###wb#", "#########", "#########", "#########", "#.#.#.#.#"] },
  coin: { c: { "#": "#ffec27", d: "#ffa300" }, r: ["..####..", ".##dd##.", "##d##d##", "##d##d##", "##d##d##", "##d##d##", ".##dd##.", "..####.."] },
};

DESIGN_FX.pixel = {
  enter() {
    const hero = document.querySelector("#home .hero");
    const made = [];
    if (hero && document.getElementById("home").style.display !== "none") {
      const place = (name, size, css) => {
        const s = _PX_SPRITES[name], el = _pxSprite(s.r, s.c, size);
        Object.assign(el.style, css);
        hero.appendChild(el); made.push(el);
      };
      place("invader", 7, { left: "2%", top: "8px" });
      place("ghost", 6, { right: "3%", top: "20px", animationDelay: "-0.3s" });
      place("heart", 7, { left: "10%", bottom: "-4px", animationDelay: "-0.5s" });
      place("coin", 6, { right: "12%", bottom: "6px", animationDelay: "-0.2s" });
    }
    return () => made.forEach((m) => m.remove());
  },

  card(el) { previewCanvas(el, _pxQuantize); },
};
