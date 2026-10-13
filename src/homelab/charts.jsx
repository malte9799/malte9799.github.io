import { useLayoutEffect, useRef, useState } from 'react';

export const STATUS_LABEL = { good: 'OK', warning: 'Warning', serious: 'High', critical: 'Critical', idle: 'Idle' };

export const level = (v, warn, crit) => (v >= crit ? 'critical' : v >= warn ? 'warning' : 'good');

export const fmtBytes = mib => (mib >= 1024 ? `${(mib / 1024).toFixed(1)} GiB` : `${Math.round(mib)} MiB`);
export const fmtGB = gb => (gb >= 1000 ? `${(gb / 1000).toFixed(2)} TB` : `${Math.round(gb)} GB`);
export const fmtRate = mbit => (mbit >= 1000 ? `${(mbit / 1000).toFixed(2)} Gb/s` : `${mbit.toFixed(mbit < 10 ? 1 : 0)} Mb/s`);
export const fmtDuration = sec => {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Status pill: color never carries meaning alone — always icon + label. */
export function Status({ status, label }) {
  return (
    <span className={`hl-status is-${status}`}>
      <StatusIcon status={status} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

export function StatusIcon({ status }) {
  const common = { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true, className: 'hl-status-icon' };
  if (status === 'good')
    return (
      <svg {...common}>
        <path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === 'idle')
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  if (status === 'warning' || status === 'serious')
    return (
      <svg {...common}>
        <path d="M6 1.6 11 10.4H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M6 5v2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Horizontal meter; fill color carries severity, track is a quiet step of the same tone. */
export function Meter({ value, max = 100, warn = 75, crit = 90, label, thin }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const s = level(pct, warn, crit);
  return (
    <div className={`hl-meter is-${s}${thin ? ' is-thin' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label}>
      <div className="hl-meter-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Arc gauge for a single headline value (usage %, temperature). */
export function Gauge({ value, max = 100, warn, crit, label, display, sub }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const s = level(value, warn, crit);
  const r = 42;
  const len = Math.PI * 1.5 * r; // 270° arc
  return (
    <div className={`hl-gauge is-${s}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <g transform="rotate(135 50 50)">
          <circle cx="50" cy="50" r={r} className="hl-gauge-track" strokeDasharray={`${len} 999`} />
          <circle cx="50" cy="50" r={r} className="hl-gauge-fill" strokeDasharray={`${len * pct} 999`} />
        </g>
      </svg>
      <div className="hl-gauge-text">
        <span className="hl-gauge-value">{display}</span>
        <span className="hl-gauge-label">{label}</span>
        {sub && <span className="hl-gauge-sub">{sub}</span>}
      </div>
    </div>
  );
}

/** Tiny trend line, no axes, no hover — a decoration next to a number. */
export function Sparkline({ data, max, color = 'var(--series-1)', height = 28 }) {
  const [ref, w] = useWidth();
  const m = max ?? Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / m) * (height - 4)).toFixed(1)}`).join(' ');
  return (
    <div ref={ref} className="hl-spark" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} aria-hidden="true">
          <polygon points={`0,${height} ${pts} ${w},${height}`} fill={color} opacity="0.1" />
          <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

/**
 * Time-series line chart with one shared y-axis, crosshair and tooltip.
 * series: [{ key, label, color, data }]
 */
export function LineChart({ series, max, height = 150, format = v => v.toFixed(0), unit = '', seconds = 1, ariaLabel }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 34, r: 8, t: 8, b: 20 };
  const n = Math.max(...series.map(s => s.data.length));
  const peak = Math.max(1, ...series.flatMap(s => s.data));
  const top = max ?? niceCeil(peak * 1.15);
  const iw = Math.max(0, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const x = i => pad.l + (n > 1 ? (i / (n - 1)) * iw : 0);
  const y = v => pad.t + ih - (Math.min(v, top) / top) * ih;
  const ticks = [0, top / 2, top];

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - pad.l) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <div ref={ref} className="hl-chart" style={{ height }} role="img" aria-label={ariaLabel}>
      {w > 0 && (
        <svg width={w} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'hl-axis' : 'hl-grid'} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="hl-tick">
                {compact(t)}
              </text>
            </g>
          ))}
          <text x={pad.l} y={height - 4} className="hl-tick">
            −{Math.round((n * seconds) / 60)} min
          </text>
          <text x={w - pad.r} y={height - 4} textAnchor="end" className="hl-tick">
            now
          </text>
          {series.map(s => {
            const pts = s.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
            return (
              <g key={s.key}>
                {series.length === 1 && <polygon points={`${x(0)},${y(0)} ${pts} ${x(s.data.length - 1)},${y(0)}`} fill={s.color} opacity="0.1" />}
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(s.data.length - 1)} cy={y(s.data.at(-1) ?? 0)} r="4" fill={s.color} className="hl-ring" />
              </g>
            );
          })}
          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="hl-crosshair" />
              {series.map(s => (
                <circle key={s.key} cx={x(hover)} cy={y(s.data[hover] ?? 0)} r="4" fill={s.color} className="hl-ring" />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover != null && w > 0 && (
        <div className="hl-tooltip" style={{ left: Math.min(x(hover) + 10, w - 150), top: 4 }}>
          <div className="hl-tooltip-time">{Math.round((n - 1 - hover) * seconds)} s ago</div>
          {series.map(s => (
            <div key={s.key} className="hl-tooltip-row">
              <span className="hl-key" style={{ background: s.color }} />
              <span>{s.label}</span>
              <b>
                {format(s.data[hover] ?? 0)}
                {unit}
              </b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <ul className="hl-legend">
      {items.map(i => (
        <li key={i.label}>
          <span className="hl-key" style={{ background: i.color }} />
          {i.label}
          {i.value != null && <b>{i.value}</b>}
        </li>
      ))}
    </ul>
  );
}

/** Part-to-whole bar with 2px surface gaps and per-segment hover. */
export function StackBar({ segments, total, format = v => v }) {
  const [hover, setHover] = useState(null);
  const used = segments.reduce((a, s) => a + s.value, 0);
  const free = Math.max(0, total - used);
  return (
    <div className="hl-stack-wrap">
      <div className="hl-stack" onPointerLeave={() => setHover(null)}>
        {segments.map(s => (
          <div key={s.label} className="hl-stack-seg" style={{ flexGrow: s.value, background: s.color }} onPointerEnter={() => setHover(s)} />
        ))}
        <div className="hl-stack-seg is-free" style={{ flexGrow: free }} onPointerEnter={() => setHover({ label: 'Free', value: free })} />
      </div>
      {hover && (
        <div className="hl-stack-tip">
          {hover.color && <span className="hl-key" style={{ background: hover.color }} />}
          {hover.label} · <b>{format(hover.value)}</b> · {((hover.value / total) * 100).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

/** One bar per CPU thread; height = utilization. */
export function CoreBars({ cores }) {
  const [hover, setHover] = useState(null);
  return (
    <div className="hl-cores" onPointerLeave={() => setHover(null)}>
      {cores.map((c, i) => (
        <div key={i} className="hl-core" onPointerEnter={() => setHover(i)} aria-label={`Thread ${i}: ${c.toFixed(0)}%`}>
          <div className={`hl-core-fill is-${level(c, 75, 92)}`} style={{ height: `${Math.max(3, c)}%` }} />
        </div>
      ))}
      <div className="hl-cores-cap">{hover != null ? `Thread ${hover} · ${cores[hover].toFixed(0)}%` : `${cores.length} threads`}</div>
    </div>
  );
}

function niceCeil(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
function compact(v) {
  if (v >= 1000) return `${+(v / 1000).toFixed(1)}K`;
  return `${+v.toFixed(v < 10 && v % 1 ? 1 : 0)}`;
}
