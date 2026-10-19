import { useEffect, useRef } from 'react';

// Adapted from React Bits "Pixel Card": a canvas of tiny squares that grow in from the
// pointer on hover/focus and shimmer (growing near the cursor), then shrink away on leave.
const RADIUS = 110;

class Pixel {
  constructor(ctx, x, y, color, speed, delay, w, h) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = Math.random() * 0.8 * speed + 0.1 * speed;
    this.size = 0;
    this.sizeStep = Math.random() * 0.4;
    this.minSize = 0.5;
    this.maxSizeInteger = 2;
    this.maxSize = Math.random() * (this.maxSizeInteger - this.minSize) + this.minSize;
    this.delay = delay;
    this.counter = 0;
    this.counterStep = Math.random() * 4 + (w + h) * 0.01;
    this.isIdle = false;
    this.isReverse = false;
    this.isShimmer = false;
    this.boost = 0; // 0..1, how close the pointer is
  }

  draw() {
    const size = this.size * (1 + this.boost * 2.2);
    const offset = this.maxSizeInteger * 0.5 - size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + offset, this.y + offset, size, size);
  }

  appear() {
    this.isIdle = false;
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) this.isShimmer = true;
    if (this.isShimmer) this.shimmer();
    else this.size += this.sizeStep;
    this.draw();
  }

  disappear() {
    this.isShimmer = false;
    this.counter = 0;
    if (this.size <= 0) {
      this.isIdle = true;
      return;
    }
    this.size -= 0.1;
    this.draw();
  }

  shimmer() {
    if (this.size >= this.maxSize) this.isReverse = true;
    else if (this.size <= this.minSize) this.isReverse = false;
    this.size += this.isReverse ? -this.speed : this.speed;
  }
}

export default function PixelCard({ colors = '#3a3a48,#55557a,#7c75e6', gap = 7, speed = 0.04, className = '', children }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const pixels = useRef([]);
  const raf = useRef(0);
  const last = useRef(0);
  const mode = useRef('disappear');
  const pointer = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const el = wrap.current;
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    const palette = colors.split(',');

    const init = () => {
      const { width, height } = el.getBoundingClientRect();
      const w = Math.floor(width);
      const h = Math.floor(height);
      cv.width = w;
      cv.height = h;
      pixels.current = [];
      for (let x = 0; x < w; x += gap) {
        for (let y = 0; y < h; y += gap) {
          const color = palette[Math.floor(Math.random() * palette.length)];
          const dx = x - w / 2;
          const dy = y - h / 2;
          pixels.current.push(new Pixel(ctx, x, y, color, speed, Math.sqrt(dx * dx + dy * dy), w, h));
        }
      }
    };

    const frame = now => {
      raf.current = requestAnimationFrame(frame);
      if (now - last.current < 1000 / 60) return;
      last.current = now;
      ctx.clearRect(0, 0, cv.width, cv.height);
      let idle = true;
      const pt = pointer.current;
      for (const p of pixels.current) {
        const want = pt && mode.current === 'appear' ? Math.max(0, 1 - Math.hypot(p.x - pt.x, p.y - pt.y) / RADIUS) : 0;
        p.boost += (want - p.boost) * 0.18;
        p[mode.current]();
        if (!p.isIdle) idle = false;
      }
      if (idle && mode.current === 'disappear') {
        for (const p of pixels.current) p.boost = 0;
        cancelAnimationFrame(raf.current);
        raf.current = 0;
      }
    };
    const play = name => {
      mode.current = name;
      if (!raf.current) raf.current = requestAnimationFrame(frame);
    };

    const place = e => {
      const r = el.getBoundingClientRect();
      pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    // The reveal ripples out from wherever the pointer entered.
    const enter = e => {
      if (e.type === 'pointerenter') {
        place(e);
        for (const p of pixels.current) {
          p.delay = Math.hypot(p.x - pointer.current.x, p.y - pointer.current.y);
          p.counter = 0;
        }
      }
      play('appear');
    };
    const leave = () => {
      pointer.current = null;
      play('disappear');
    };
    init();
    const ro = new ResizeObserver(init);
    ro.observe(el);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointermove', place);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focusin', enter);
    el.addEventListener('focusout', leave);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      ro.disconnect();
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointermove', place);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('focusin', enter);
      el.removeEventListener('focusout', leave);
    };
  }, [colors, gap, speed]);

  return (
    <div ref={wrap} className={`pixel-card ${className}`}>
      <canvas ref={canvas} className="pixel-card-canvas" aria-hidden="true" />
      {children}
    </div>
  );
}
