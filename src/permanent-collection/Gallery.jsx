import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { PRODUCTS } from './items';
import { useLang } from './i18n';

const PER_RING = 10;
const RINGS = 5;
const TILE_W = 300;
const TILE_H = 390;
const ROW_H = 500;
const RADIUS = 800;
const PERSPECTIVE = 520; // camera sits in the middle of the cylinder; on-screen scale = PERSPECTIVE / RADIUS
const STEP = 360 / PER_RING;
const LOOK = 36; // degrees of camera turn across the screen before the first drag
const EDGE = 0.07; // outer share of the screen width (each side) that turns the room
const EDGE_SPEED = 45; // degrees per second at the very edge
const FREE_EDGE_SPEED_Y = 220; // pixels per second, up and down
const KEY_SPEED = 70; // degrees per second with WASD / arrow keys
const KEY_SPEED_Y = 520; // pixels per second
const LOOK_Y = 800; // pixels of vertical camera travel across the screen before the first drag

const wrapAngle = a => ((((a + 180) % 360) + 360) % 360) - 180;

function Tile({ item, angle, row, rotation }) {
  // 0° = straight ahead; tiles fade out towards the sides
  const opacity = useTransform(rotation, r => Math.max(0, Math.cos((wrapAngle(angle + r) * Math.PI) / 180)) ** 1.5);
  return (
    <motion.a
      href={`#/product/${item.slug}`}
      className="tile"
      draggable={false}
      style={{
        opacity,
        width: TILE_W,
        height: TILE_H,
        marginLeft: -TILE_W / 2,
        marginTop: -TILE_H / 2 + row * ROW_H,
        transform: `rotateY(${angle}deg) translateZ(${-RADIUS}px)`,
      }}
    >
      <motion.figure className="tile-inner" whileHover={{ scale: 1.08 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
        <img src={item.src} alt={item.name} width={TILE_W} height={TILE_H} draggable={false} />
        <figcaption>{item.name}</figcaption>
      </motion.figure>
    </motion.a>
  );
}

export default function Gallery() {
  const { t } = useLang();
  const stage = useRef(null);
  const targetRot = useMotionValue(-50);
  const targetY = useMotionValue(0);
  const rotation = useSpring(targetRot, { stiffness: 70, damping: 24 });
  const y = useSpring(targetY, { stiffness: 70, damping: 24 });
  const [started, setStarted] = useState(false);
  // the title stays put and turns to face the cursor
  const lookY = useSpring(0, { stiffness: 120, damping: 20 });
  const lookX = useSpring(0, { stiffness: 120, damping: 20 });
  const transform = useTransform([rotation, y], ([r, py]) => `translateY(${-py}px) translateZ(${PERSPECTIVE}px) rotateY(${r}deg)`);

  useEffect(() => {
    document.documentElement.classList.add('no-scroll');
    const intro = animate(targetRot, 0, { duration: 2.4, ease: [0.22, 1, 0.36, 1] });
    const el = stage.current;
    const limit = ROW_H * (RINGS - 1) * 0.5;
    const pan = (dx, dy) => {
      targetRot.set(targetRot.get() + dx * 0.12);
      targetY.set(Math.max(-limit, Math.min(limit, targetY.get() + dy)));
    };
    // until the first drag the camera follows the cursor and the title turns to it
    let free = false;
    const begin = () => {
      if (free) return;
      free = true;
      leave();
      intro.stop();
      setStarted(true);
    };
    const wheel = e => {
      e.preventDefault();
      begin();
      pan(e.deltaX * 0.6, e.deltaY * 0.6);
    };
    // WASD and arrow keys
    const KEYMAP = { a: 'right', arrowleft: 'right', d: 'left', arrowright: 'left', w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down' };
    const keys = new Set();
    const keydown = e => {
      const k = KEYMAP[e.key.toLowerCase()];
      if (!k || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      e.preventDefault();
      keys.add(k);
    };
    const keyup = e => keys.delete(KEYMAP[e.key.toLowerCase()]);
    const blur = () => keys.clear();
    addEventListener('keydown', keydown);
    addEventListener('keyup', keyup);
    addEventListener('blur', blur);
    let base = 0;
    let cursorX = 0;
    let edgeSpeed = 0;
    let edgeSpeedY = 0;
    let prev = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!free && edgeSpeed) {
        base += edgeSpeed * dt;
        targetRot.set(base + cursorX * LOOK);
      }
      const kx = (keys.has('left') ? 1 : 0) - (keys.has('right') ? 1 : 0);
      const ky = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
      if (kx || ky) {
        begin();
        targetRot.set(targetRot.get() + kx * KEY_SPEED * dt);
        targetY.set(Math.max(-limit, Math.min(limit, targetY.get() + ky * KEY_SPEED_Y * dt)));
      }
      if (free && !last && !kx && !ky) {
        if (edgeSpeed) targetRot.set(targetRot.get() + edgeSpeed * dt);
        if (edgeSpeedY) targetY.set(Math.max(-limit, Math.min(limit, targetY.get() + edgeSpeedY * dt)));
      }
      raf = requestAnimationFrame(tick);
    });
    const leave = () => {
      edgeSpeed = 0;
      edgeSpeedY = 0;
    };
    // how far into the outer edge zone (0..1) a normalised cursor offset is
    const depthOf = n => Math.max(0, (Math.abs(n) - (0.5 - EDGE)) / EDGE);
    let last = null;
    let origin = null;
    let dragging = false;
    const down = e => {
      leave();
      last = origin = [e.clientX, e.clientY];
      dragging = false;
    };
    const move = e => {
      if (free && !last) {
        // title gone: the edges turn the room and move it up and down
        const nx = e.clientX / el.clientWidth - 0.5;
        const ny = e.clientY / el.clientHeight - 0.5;
        const dx = depthOf(nx);
        const dy = depthOf(ny);
        edgeSpeed = dx ? Math.sign(nx) * (0.25 + 0.75 * Math.min(dx, 1)) * EDGE_SPEED : 0;
        edgeSpeedY = dy ? Math.sign(ny) * (0.25 + 0.75 * Math.min(dy, 1)) * FREE_EDGE_SPEED_Y : 0;
        return;
      }
      if (!free && !last) {
        const nx = e.clientX / el.clientWidth - 0.5;
        const ny = e.clientY / el.clientHeight - 0.5;
        intro.stop();
        cursorX = nx;
        // near the left/right edge the room keeps turning that way
        const depth = depthOf(nx);
        edgeSpeed = depth > 0 ? Math.sign(nx) * (0.25 + 0.75 * Math.min(depth, 1)) * EDGE_SPEED : 0;
        targetRot.set(base + nx * LOOK);
        targetY.set(ny * LOOK_Y);
        lookY.set(nx * 36);
        lookX.set(-ny * 26);
        return;
      }
      if (!last) return;
      // a click on a photo opens it; only a real drag turns the room
      if (!dragging && Math.hypot(e.clientX - origin[0], e.clientY - origin[1]) < 5) return;
      if (!dragging) {
        dragging = true;
        begin();
        el.setPointerCapture(e.pointerId);
        el.classList.add('grabbing');
      }
      pan(-(e.clientX - last[0]) * 1.4, -(e.clientY - last[1]));
      last = [e.clientX, e.clientY];
    };
    const up = () => {
      last = null;
      dragging = false;
      el.classList.remove('grabbing');
    };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', keydown);
      removeEventListener('keyup', keyup);
      removeEventListener('blur', blur);
      el.removeEventListener('pointerleave', leave);
      document.documentElement.classList.remove('no-scroll');
      intro.stop();
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [targetRot, targetY, lookX, lookY]);

  return (
    <main className="stage" ref={stage}>
      <motion.div className="ring" style={{ transform }}>
        {PRODUCTS.map((item, i) => (
          <Tile key={item.slug} item={item} angle={(i % PER_RING) * STEP} row={Math.floor(i / PER_RING) - (RINGS - 1) / 2} rotation={rotation} />
        ))}
      </motion.div>
      <motion.h1
        className="title"
        style={{ rotateY: lookY, rotateX: lookX, transformPerspective: 700 }}
        animate={{ opacity: started ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        {t('gallery.title1')}
        <br />
        {t('gallery.title2')}
      </motion.h1>
      <p className="hint">{t('gallery.hint')}</p>
    </main>
  );
}
