import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { DOMAIN, EXTERNAL, HOST, LINKS, LXCS, STORAGE } from '../data/inventory';
import { Status, fmtBytes } from '../charts';
import { targetFromMapId } from '../data/actions';
import { ActionBar } from '../ui/Actions';
import Icon from '../ui/Icon';

const DOT = { running: 'good', degraded: 'warning', restarting: 'warning', starting: 'warning', stopped: 'critical' };

// Hand-tuned layout in SVG units. Columns follow the request path left → right:
// internet → caddy → media stack, with the LAN devices above the LXC they feed
// and the ZFS datasets underneath the LXCs that bind-mount them.
const W = 1280;
const H = 640;
const ROW = 34;
const HEAD = 48;
const LXC_POS = {
  100: { x: 250, y: 181, w: 190 },
  101: { x: 470, y: 130, w: 220, order: ['prowlarr', 'jellyfin', 'seerr', 'radarr', 'sonarr', 'qbit', 'bazarr'] },
  103: { x: 770, y: 130, w: 210 },
  102: { x: 1030, y: 130, w: 190 },
};
const EXT_POS = {
  clients: { x: 20, y: 60, w: 190 },
  dyndns: { x: 20, y: 140, w: 190 },
  router: { x: 20, y: 220, w: 190 },
  indexers: { x: 505, y: 22, w: 150 },
  'scanner-dev': { x: 800, y: 22, w: 150 },
  phone: { x: 1050, y: 22, w: 150 },
};
const DS_POS = {
  'tank/downloads': { x: 485, w: 95 },
  'tank/media': { x: 590, w: 95 },
  'tank/documents': { x: 785, w: 180 },
  'tank/photos': { x: 1045, w: 160 },
};
const DS_Y = 530;
const NODE_H = 52;
const CHIP_H = 28;

export const KIND = {
  web: { label: 'Public HTTPS', color: 'var(--series-1)' },
  lan: { label: 'LAN', color: 'var(--series-2)' },
  data: { label: 'Files / mounts', color: 'var(--series-3)' },
  api: { label: 'Internal API', color: 'var(--series-5)' },
};

function buildLayout() {
  const nodes = {};
  const boxes = [];
  for (const c of LXCS) {
    const p = LXC_POS[c.id];
    const svcs = p.order ? p.order.map(id => c.services.find(s => s.id === id)) : c.services;
    const h = HEAD + svcs.length * ROW + 8;
    boxes.push({ ...p, h, lxc: c });
    svcs.forEach((s, i) => {
      nodes[s.id] = { id: s.id, x: p.x + 10, y: p.y + HEAD + i * ROW, w: p.w - 20, h: CHIP_H, type: 'svc', svc: s, lxc: c };
    });
  }
  for (const e of EXTERNAL) nodes[e.id] = { id: e.id, ...EXT_POS[e.id], h: NODE_H, type: 'ext', ext: e };
  const datasets = STORAGE.flatMap(p => p.datasets.map(d => ({ ...d, pool: p })));
  for (const [id, p] of Object.entries(DS_POS)) {
    nodes[id] = { id, x: p.x, y: DS_Y, w: p.w, h: 44, type: 'ds', ds: datasets.find(d => d.id === id) };
  }

  const edges = [];
  const mounts = new Map();
  for (const l of LINKS) {
    const a = nodes[l.from];
    const b = nodes[l.to];
    if (b.type === 'ds') {
      // Files go through the LXC's bind mount, so draw one edge per LXC → dataset.
      const box = boxes.find(x => x.lxc === a.lxc);
      const key = `${a.lxc.id}>${l.to}`;
      if (!mounts.has(key)) {
        const cx = Math.min(Math.max(b.x + b.w / 2, box.x + 16), box.x + box.w - 16);
        mounts.set(key, { key, kind: 'data', from: `lxc${a.lxc.id}`, to: l.to, members: [], d: `M${cx},${box.y + box.h} L${cx},${b.y}`, mid: [cx, (box.y + box.h + b.y) / 2] });
      }
      mounts.get(key).members.push(l);
      continue;
    }
    edges.push({ key: `${l.from}>${l.to}`, ...l, ...route(a, b) });
  }
  return { nodes, boxes, edges: [...edges, ...mounts.values()] };
}

function route(a, b) {
  const ay = a.y + a.h / 2;
  const by = b.y + b.h / 2;
  // Same LXC: an arc in the gutter to the right of the box.
  if (a.lxc && a.lxc === b.lxc) {
    const x = a.x + a.w;
    const bulge = 14 + Math.abs(by - ay) * 0.22;
    return { d: `M${x},${ay} C${x + bulge},${ay} ${x + bulge},${by} ${x},${by}`, mid: [x + bulge * 0.75 + 4, (ay + by) / 2 + 5], anchor: 'start' };
  }
  // Coming from the top band: drop into the chip's top edge.
  if (a.type === 'ext' && a.y < 100) {
    const x = b.x + b.w / 2;
    return { d: `M${a.x + a.w / 2},${a.y + a.h} C${a.x + a.w / 2},${a.y + a.h + 40} ${x},${b.y - 40} ${x},${b.y}`, mid: [(a.x + a.w / 2 + x) / 2, (a.y + a.h + b.y) / 2] };
  }
  if (b.type === 'ext' && b.y < 100) {
    const x = a.x + a.w / 2;
    return { d: `M${x},${a.y} C${x},${a.y - 40} ${b.x + b.w / 2},${b.y + b.h + 40} ${b.x + b.w / 2},${b.y + b.h}`, mid: [(x + b.x + b.w / 2) / 2, (a.y + b.y + b.h) / 2] };
  }
  // Left column stacked vertically.
  if (a.type === 'ext' && b.type === 'ext') {
    const x = a.x + a.w / 2;
    return { d: `M${x},${a.y + a.h} L${x},${b.y}`, mid: [x, (a.y + a.h + b.y) / 2] };
  }
  const forward = b.x >= a.x + a.w;
  const x1 = forward ? a.x + a.w : a.x;
  const x2 = forward ? b.x : b.x + b.w;
  const dx = Math.max(30, Math.abs(x2 - x1) / 2) * (forward ? 1 : -1);
  return { d: `M${x1},${ay} C${x1 + dx},${ay} ${x2 - dx},${by} ${x2},${by}`, mid: [(x1 + x2) / 2, (ay + by) / 2] };
}

const LAYOUT = buildLayout();

function neighbours(id) {
  const set = new Set([id]);
  for (const e of LAYOUT.edges) {
    const ends = [e.from, e.to];
    if (e.members) e.members.forEach(m => ends.push(m.from));
    if (ends.includes(id)) ends.forEach(x => set.add(x));
  }
  const box = LAYOUT.boxes.find(b => `lxc${b.lxc.id}` === id);
  if (box) box.lxc.services.forEach(s => set.add(s.id));
  return set;
}

function edgeActivity(e, activity) {
  if (e.members) return Math.max(0, ...e.members.map(m => activity[`${m.from}>${m.to}`] || 0));
  return activity[e.key] || 0;
}

function Flow({ d, level, color, reduced }) {
  if (!level || reduced) return null;
  const n = level > 0.66 ? 3 : level > 0.33 ? 2 : 1;
  const dur = 2.6 - level * 1.2;
  return Array.from({ length: n }, (_, i) => (
    <circle key={i} r="3.5" fill={color} className="hl-flow-dot">
      <animateMotion dur={`${dur}s`} begin={`${(-dur * i) / n}s`} repeatCount="indefinite" path={d} />
    </circle>
  ));
}

export default function Topology({ state, selected, onSelect }) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(null);
  const focus = hover ?? selected;
  const lit = useMemo(() => (focus ? neighbours(focus) : null), [focus]);
  const isLit = id => !lit || lit.has(id);

  return (
    <div className="hl-topo">
      <div className="hl-topo-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="hl-topo-svg" role="group" aria-label="Service topology">
          <rect x="230" y="100" width={W - 240} height={H - 110} rx="20" className="hl-host-frame" />
          <text x="248" y="124" className="hl-host-label">
            {HOST.name} · {HOST.os} · {HOST.ip}
          </text>

          <rect x="470" y="512" width="750" height="94" rx="14" className="hl-pool-frame" />
          <text x="1206" y="596" textAnchor="end" className="hl-pool-label">
            tank · ZFS mirror · bind mounts
          </text>
          <g className="hl-pool-note">
            <rect x="250" y="530" width="190" height="44" rx="10" />
            <text x="262" y="549">
              rpool · NVMe
            </text>
            <text x="262" y="565" className="hl-sub">
              LXC root disks · vzdump → backup
            </text>
          </g>

          {LAYOUT.boxes.map(b => {
            const id = `lxc${b.lxc.id}`;
            const live = state.lxc[b.lxc.id];
            return (
              <g key={id} className={`hl-lxc${isLit(id) || b.lxc.services.some(s => isLit(s.id)) ? '' : ' is-dim'}`} onClick={() => onSelect(id)} onPointerEnter={() => setHover(id)} onPointerLeave={() => setHover(null)}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="14" className={`hl-lxc-box${selected === id ? ' is-selected' : ''}`} />
                <text x={b.x + 12} y={b.y + 20} className="hl-lxc-title">
                  <tspan className="hl-lxc-id">{b.lxc.id}</tspan> {b.lxc.name}
                </text>
                <text x={b.x + 12} y={b.y + 36} className="hl-sub">
                  {live.status === 'stopped' ? 'stopped' : `${b.lxc.ip} · ${live.cpu.toFixed(0)}% · ${fmtBytes(live.mem)}`}
                </text>
                {b.lxc.gpu && (
                  <g transform={`translate(${b.x + b.w - 44} ${b.y + 10})`}>
                    <rect width="34" height="18" rx="9" className="hl-badge" />
                    <text x="17" y="12.5" textAnchor="middle" className="hl-badge-text">
                      GPU
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {LAYOUT.edges.map(e => {
            const lvl = edgeActivity(e, state.activity);
            const on = !lit || (lit.has(e.from) && lit.has(e.to)) || (e.members && e.members.some(m => lit.has(m.from)) && lit.has(e.to));
            return (
              <g key={e.key} className={`hl-edge is-${e.kind}${lvl ? ' is-active' : ''}${on ? '' : ' is-dim'}`} style={{ '--edge': KIND[e.kind].color }}>
                <path d={e.d} />
                <Flow d={e.d} level={on ? lvl : 0} color={KIND[e.kind].color} reduced={reduced} />
                {e.label && lit && on && (
                  <text x={e.mid[0]} y={e.mid[1] - 5} textAnchor={e.anchor ?? 'middle'} className="hl-edge-label">
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}

          {Object.values(LAYOUT.nodes).map(n => (
            <Node key={n.id} n={n} state={state} dim={!isLit(n.id)} selected={selected === n.id} onSelect={onSelect} setHover={setHover} />
          ))}
        </svg>
      </div>
      <ul className="hl-legend hl-topo-legend">
        {Object.values(KIND).map(k => (
          <li key={k.label}>
            <span className="hl-key is-line" style={{ background: k.color }} />
            {k.label}
          </li>
        ))}
        <li>
          <span className="hl-key is-dot" />
          moving dots = traffic right now
        </li>
      </ul>
    </div>
  );
}

function Node({ n, state, dim, selected, onSelect, setHover }) {
  const common = {
    className: `hl-node is-${n.type}${dim ? ' is-dim' : ''}${selected ? ' is-selected' : ''}`,
    onClick: e => {
      e.stopPropagation();
      onSelect(n.id);
    },
    onPointerEnter: () => setHover(n.id),
    onPointerLeave: () => setHover(null),
    tabIndex: 0,
    role: 'button',
    onKeyDown: e => (e.key === 'Enter' || e.key === ' ') && onSelect(n.id),
  };
  if (n.type === 'svc') {
    const live = state.services[n.id];
    const busy = Math.min(1, live.cpu / 40);
    return (
      <g {...common} aria-label={`${n.svc.name}, ${live.status}`}>
        <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8" className="hl-chip" />
        <rect x={n.x + 1} y={n.y + n.h - 3} width={(n.w - 2) * busy} height="2" rx="1" className="hl-chip-load" />
        <circle cx={n.x + 12} cy={n.y + n.h / 2} r="3.5" className={`hl-dot is-${DOT[live.status]}`} />
        <text x={n.x + 22} y={n.y + n.h / 2} dy="0.34em" className="hl-chip-name">
          {n.svc.name}
        </text>
        <text x={n.x + n.w - 8} y={n.y + n.h / 2} dy="0.34em" textAnchor="end" className="hl-chip-meta">
          {n.svc.kind === 'docker' ? '◆' : n.svc.kind === 'systemd' ? '⚙' : '●'} {n.svc.port ? `:${n.svc.port}` : ''}
        </text>
      </g>
    );
  }
  if (n.type === 'ds') {
    return (
      <g {...common} aria-label={n.ds.label}>
        <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="10" className="hl-ds" />
        <text x={n.x + 10} y={n.y + 18} className="hl-chip-name">
          {n.id.split('/')[1]}
        </text>
        <text x={n.x + 10} y={n.y + 34} className="hl-sub">
          {n.ds.used >= 1000 ? `${(n.ds.used / 1000).toFixed(1)} TB` : `${n.ds.used} GB`}
        </text>
      </g>
    );
  }
  return (
    <g {...common} aria-label={n.ext.label}>
      <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="12" className="hl-ext" />
      <ExtIcon kind={n.ext.icon} x={n.x + 12} y={n.y + 16} />
      <text x={n.x + 40} y={n.y + 22} className="hl-chip-name">
        {n.ext.label === DOMAIN ? DOMAIN : n.ext.label}
      </text>
      <text x={n.x + 40} y={n.y + 38} className="hl-sub">
        {n.ext.sub}
      </text>
    </g>
  );
}

function ExtIcon({ kind, x, y }) {
  const p = {
    globe: 'M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-8.5 8.5h17M10 1.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5Z',
    dns: 'M3 4h14v4H3zM3 12h14v4H3zM6 6h.01M6 14h.01',
    router: 'M2 12h16v5H2zM6 14.5h.01M10 12V6M6 6.5a5.5 5.5 0 0 1 8 0M4 4a9 9 0 0 1 12 0',
    phone: 'M6 1.5h8v17H6zM9 16h2',
    scanner: 'M2 9h16v6H2zM4 9l2-6h8l2 6M5 12h6',
    cloud: 'M6 16h9a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 5 9a3.5 3.5 0 0 0 1 7Z',
  }[kind];
  return (
    <path d={p} transform={`translate(${x} ${y})`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="hl-ext-icon" />
  );
}

/** Side panel for whatever is selected on the map. */
export function NodeDetail({ id, state, onClose }) {
  if (!id) return null;
  const n = LAYOUT.nodes[id];
  const box = id.startsWith('lxc') ? LAYOUT.boxes.find(b => `lxc${b.lxc.id}` === id) : null;
  const links = LINKS.filter(l => l.from === id || l.to === id || (box && box.lxc.services.some(s => s.id === l.from || s.id === l.to)));
  const name = id => LAYOUT.nodes[id]?.svc?.name ?? LAYOUT.nodes[id]?.ext?.label ?? id;
  const events = state.events.filter(e => (n?.svc && (e.source === n.svc.name || e.source === n.svc.id)) || (box && box.lxc.services.some(s => s.name === e.source))).slice(0, 4);

  let title;
  let sub;
  let rows = [];
  if (box) {
    const live = state.lxc[box.lxc.id];
    title = `LXC ${box.lxc.id} · ${box.lxc.name}`;
    sub = box.lxc.role;
    rows = [
      ['IP', box.lxc.ip],
      ['Resources', `${box.lxc.cores} cores · ${fmtBytes(box.lxc.ram)} RAM · ${box.lxc.disk} GB disk`],
      ['CPU / RAM now', `${live.cpu.toFixed(1)}% · ${fmtBytes(live.mem)}`],
      ['Mounts', box.lxc.mounts?.join(', ') ?? '—'],
      ['GPU', box.lxc.gpu ? `/dev/dri passthrough (${HOST.gpu.model})` : '—'],
    ];
  } else if (n.type === 'svc') {
    const live = state.services[id];
    title = n.svc.name;
    sub = n.svc.detail;
    rows = [
      ['Runs in', `LXC ${n.lxc.id} · ${n.lxc.name} (${n.svc.kind})`],
      ['Address', n.svc.port ? `${n.lxc.ip}:${n.svc.port}` : 'no listening port'],
      ...(n.svc.public ? [['Public', `https://${n.svc.public}`]] : []),
      ...(n.svc.image ? [['Image', n.svc.image]] : []),
      ['CPU / RAM now', `${live.cpu.toFixed(1)}% · ${fmtBytes(live.mem)}`],
    ];
  } else if (n.type === 'ds') {
    title = n.id;
    sub = n.ds.label;
    rows = [
      ['Pool', `${n.ds.pool.id} · ${n.ds.pool.layout}`],
      ['Used', `${n.ds.used} GB`],
    ];
  } else {
    title = n.ext.label;
    sub = n.ext.sub;
  }
  const status = n?.type === 'svc' ? state.services[id].status : 'running';

  return (
    <aside className="hl-detail">
      <header>
        <div>
          <h3>{title}</h3>
          <p>{sub}</p>
        </div>
        <button className="hl-btn is-ghost" onClick={onClose} aria-label="Close details">
          ✕
        </button>
      </header>
      {n?.type === 'svc' && <Status status={DOT[status]} label={status} />}
      {box && <Status status={state.lxc[box.lxc.id].status === 'stopped' ? 'critical' : 'good'} label={state.lxc[box.lxc.id].status} />}
      <ActionBar key={id} target={targetFromMapId(id)} />
      <dl className="hl-kv">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {links.length > 0 && (
        <>
          <h4>Connections</h4>
          <ul className="hl-conn">
            {links.map(l => (
              <li key={l.from + l.to}>
                <span className="hl-key is-line" style={{ background: KIND[l.kind].color }} />
                {name(l.from)} → {name(l.to)}
                {l.label && <em>{l.label}</em>}
                {state.activity[`${l.from}>${l.to}`] > 0 && <span className="hl-live">live</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {events.length > 0 && (
        <>
          <h4>Recent</h4>
          <ul className="hl-mini-log">
            {events.map(e => (
              <li key={e.id}>
                <time>{new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time> {e.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

/** The map's how-to, tucked behind an "i" button next to the heading. */
export function MapInfo() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = ev => !ref.current?.contains(ev.target) && setOpen(false);
    const key = ev => ev.key === 'Escape' && (ev.stopPropagation(), setOpen(false));
    document.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key, true);
    };
  }, [open]);
  return (
    <span className="hl-info" ref={ref}>
      <button className="hl-icon-btn" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="How to use the map">
        <Icon name="info" />
      </button>
      {open && (
        <div className="hl-info-pop" role="dialog" aria-label="How to use the map">
          <p>Click a container, LXC, device or dataset to see how it is wired up and what you can do with it. Hover to highlight its connections.</p>
          <p className="hl-note">
            Public entry: <b>jellyfin.{DOMAIN}</b> and <b>seerr.{DOMAIN}</b> → router :443 → Caddy (LXC 100). Everything else is LAN-only.
          </p>
        </div>
      )}
    </span>
  );
}
