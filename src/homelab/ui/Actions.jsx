import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GROUP_ORDER, actionsFor, allTargets, confirmOf, describeRequest, fieldsOf, findAction, requestsOf, resolve } from '../data/actions';
import { MODE, execute } from '../data/executor';
import { store } from '../data/simulator';
import { useLive } from '../useLive';
import Icon from './Icon';
import { EditorView, LogsView, OutputView, RequestView, TerminalView } from './Views';

const Ctx = createContext(null);
export const useActions = () => useContext(Ctx);

const VIA = { proxmox: 'PVE', api: 'API', shell: 'SH', link: '↗' };
let taskSeq = 0;

export function ActionsProvider({ children, onNavigate }) {
  const [dialog, setDialog] = useState(null); // { actionId, target }
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((text, level = 'good') => {
    const id = ++taskSeq;
    setToasts(t => [...t, { id, text, level }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  /** Execute for real (or mock). Returns { ok, lines }. */
  const run = useCallback(
    async (action, target, params) => {
      const e = resolve(target, store.getSnapshot());
      if (!e) return { ok: false, lines: ['Target is gone'] };
      const reqs = requestsOf(action, e, params);
      if (reqs.length && reqs.every(r => r.via === 'link')) {
        reqs.forEach(r => window.open(r.url, '_blank', 'noopener'));
        return { ok: true, lines: reqs.map(r => r.url) };
      }
      const id = ++taskSeq;
      const task = { id, label: action.label, title: e.title, status: 'running', t: Date.now(), requests: reqs.map(r => describeRequest(r, e)), lines: [] };
      setTasks(ts => [task, ...ts].slice(0, 40));
      let res;
      try {
        res = await execute(action, target, e, params);
      } catch (err) {
        res = { ok: false, lines: [String(err)] };
      }
      setTasks(ts => ts.map(x => (x.id === id ? { ...x, status: res.ok ? 'ok' : 'error', lines: res.lines, done: Date.now() } : x)));
      if (!action.view || action.view === 'request' || action.view === 'editor') toast(`${res.ok ? '✓' : '✕'} ${action.label} · ${e.title}`, res.ok ? 'good' : 'critical');
      return res;
    },
    [toast]
  );

  /** Entry point for every button/menu item: decides between run-now and a dialog. */
  const open = useCallback(
    (actionId, target) => {
      const a = findAction(actionId);
      if (!a) return;
      const e = resolve(target, store.getSnapshot());
      const reqs = requestsOf(a, e, {});
      const linkOnly = reqs.length && reqs.every(r => r.via === 'link');
      if (!a.view && !a.danger && !fieldsOf(a, e, store.getSnapshot()).length && !a.confirm) {
        run(a, target, {});
        return;
      }
      if (linkOnly && !a.view) {
        run(a, target, {});
        return;
      }
      setDialog({ actionId, target });
    },
    [run]
  );

  useEffect(() => {
    const onKey = ev => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        setPalette(p => !p);
      } else if (ev.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName)) {
        ev.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ open, run, setPalette, setDrawer, tasks, onNavigate }), [open, run, tasks, onNavigate]);
  return (
    <Ctx value={value}>
      {children}
      {dialog && <ActionDialog {...dialog} onClose={() => setDialog(null)} />}
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      {drawer && <TaskDrawer tasks={tasks} onClose={() => setDrawer(false)} onClear={() => setTasks(ts => ts.filter(t => t.status === 'running'))} />}
      <div className="hl-toasts" aria-live="polite">
        {toasts.map(t => (
          <button key={t.id} className={`hl-toast is-${t.level}`} onClick={() => setDrawer(true)}>
            {t.text}
          </button>
        ))}
      </div>
    </Ctx>
  );
}

// ---------- Menus & buttons ----------

function groupActions(list) {
  const groups = new Map();
  for (const a of list) {
    if (!groups.has(a.group)) groups.set(a.group, []);
    groups.get(a.group).push(a);
  }
  return [...groups.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]));
}

function viaOf(a, e) {
  try {
    const r = requestsOf(a, e, {})[0];
    return r ? VIA[r.via] : '';
  } catch {
    return '';
  }
}

/** "⋯" button that lists every action for a target. */
export function ActionMenu({ target, label, className = '', exclude = [] }) {
  const state = useLive();
  const { open } = useActions();
  const [rect, setRect] = useState(null);
  const btn = useRef(null);
  const e = resolve(target, state);
  const list = actionsFor(e, state).filter(a => !exclude.includes(a.id));
  if (!e || !list.length) return null;

  const toggle = ev => {
    ev.stopPropagation();
    setRect(r => (r ? null : btn.current.getBoundingClientRect()));
  };

  return (
    <>
      <button ref={btn} className={`hl-icon-btn ${label ? 'has-label' : ''} ${className}`} onClick={toggle} aria-haspopup="menu" aria-expanded={!!rect} aria-label={label ?? `Actions for ${e.title}`} title={label ? undefined : 'Actions'}>
        <Icon name="more" />
        {label && <span>{label}</span>}
      </button>
      {rect && (
        <Popover rect={rect} onClose={() => setRect(null)}>
          <div className="hl-menu-head">
            <b>{e.title}</b>
            <span>{e.sub}</span>
          </div>
          {groupActions(list).map(([g, items]) => (
            <div key={g} className="hl-menu-group" role="group" aria-label={g}>
              <div className="hl-menu-label">{g}</div>
              {items.map(a => (
                <button
                  key={a.id}
                  role="menuitem"
                  className={`hl-menu-item${a.danger ? ' is-danger' : ''}`}
                  onClick={ev => {
                    ev.stopPropagation();
                    setRect(null);
                    open(a.id, target);
                  }}
                >
                  <Icon name={a.icon} />
                  <span>
                    {a.label}
                    {(a.fields || a.view === 'request') && '…'}
                  </span>
                  <em>{viaOf(a, e)}</em>
                </button>
              ))}
            </div>
          ))}
        </Popover>
      )}
    </>
  );
}

function Popover({ rect, onClose, children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: rect.bottom + 6, left: rect.right - 280, visibility: 'hidden' });
  useLayoutEffect(() => {
    const el = ref.current;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    const below = window.innerHeight - rect.bottom - 12;
    const top = h > below && rect.top > below ? Math.max(8, rect.top - h - 6) : rect.bottom + 6;
    const left = Math.min(Math.max(8, rect.right - w), window.innerWidth - w - 8);
    setPos({ top, left });
  }, [rect]);
  useEffect(() => {
    const close = ev => !ref.current?.contains(ev.target) && onClose();
    const key = ev => ev.key === 'Escape' && (ev.stopPropagation(), onClose());
    const t = setTimeout(() => document.addEventListener('pointerdown', close));
    window.addEventListener('keydown', key, true);
    window.addEventListener('scroll', onClose, { passive: true });
    window.addEventListener('resize', onClose);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);
  useEffect(() => ref.current?.querySelector('button')?.focus(), []);
  return createPortal(
    <div ref={ref} className="hl hl-menu" role="menu" style={{ position: 'fixed', ...pos }} onClick={ev => ev.stopPropagation()}>
      {children}
    </div>,
    document.body
  );
}

/** The few most useful actions as buttons, plus a "More" menu with the rest. */
export function ActionBar({ target, max = 3 }) {
  const state = useLive();
  const { open } = useActions();
  const e = resolve(target, state);
  const list = actionsFor(e, state);
  const primary = list.filter(a => a.primary).slice(0, max);
  return (
    <div className="hl-actionbar">
      {primary.map(a => (
        <button key={a.id} className={`hl-btn${a.danger ? ' is-danger' : ''}`} onClick={() => open(a.id, target)}>
          <Icon name={a.icon} />
          {a.label}
        </button>
      ))}
      {list.length > primary.length && <ActionMenu target={target} label="More" exclude={primary.map(a => a.id)} />}
    </div>
  );
}

// ---------- Dialog ----------

export function Modal({ title, sub, onClose, wide, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const key = ev => ev.key === 'Escape' && (ev.stopPropagation(), onClose());
    window.addEventListener('keydown', key, true);
    const prev = document.activeElement;
    ref.current?.querySelector('input, textarea, select, button.hl-btn')?.focus();
    return () => {
      window.removeEventListener('keydown', key, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <div className="hl hl-modal-backdrop" onPointerDown={ev => ev.target === ev.currentTarget && onClose()}>
      <div ref={ref} className={`hl-modal${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="hl-modal-head">
          <div>
            <h3>{title}</h3>
            {sub && <p>{sub}</p>}
          </div>
          <button className="hl-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="hl-modal-body">{children}</div>
        {footer && <footer className="hl-modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export function RequestPreview({ requests }) {
  return (
    <div className="hl-preview">
      {requests.map((r, i) => (
        <div key={i}>
          <span className="hl-preview-label">{r.label}</span>
          <pre>{r.text}</pre>
        </div>
      ))}
    </div>
  );
}

function ActionDialog({ actionId, target, onClose }) {
  const state = useLive();
  const a = findAction(actionId);
  // Freeze the entity when the dialog opens so a moving job doesn't change under the form.
  const [e] = useState(() => resolve(target, store.getSnapshot()));
  const props = { a, e, target, onClose, state };
  if (a.view === 'logs') return <LogsView {...props} />;
  if (a.view === 'terminal') return <TerminalView {...props} />;
  if (a.view === 'output') return <OutputView {...props} />;
  if (a.view === 'editor') return <EditorView {...props} />;
  if (a.view === 'request') return <RequestView {...props} />;
  return <FormView {...props} />;
}

function initialParams(fields) {
  return Object.fromEntries(fields.map(f => [f.name, typeof f.default === 'function' ? f.default() : f.default ?? (f.type === 'toggle' ? false : '')]));
}

function FormView({ a, e, target, onClose, state }) {
  const { run } = useActions();
  const [fields] = useState(() => fieldsOf(a, e, state));
  const [params, setParams] = useState(() => initialParams(fields));
  const [busy, setBusy] = useState(false);
  const reqs = requestsOf(a, e, params).map(r => describeRequest(r, e));
  const confirm = confirmOf(a, e);
  const invalid = fields.some(f => (f.pattern && !new RegExp(f.pattern).test(params[f.name])) || (f.type === 'file' && !params[f.name]));

  const submit = async ev => {
    ev?.preventDefault();
    setBusy(true);
    await run(a, target, params);
    onClose();
  };

  return (
    <Modal
      title={a.label}
      sub={e.title}
      onClose={onClose}
      footer={
        <>
          <span className="hl-mode">{MODE === 'mock' ? 'Mock — nothing is sent' : 'Runs on the server'}</span>
          <button className="hl-btn is-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={`hl-btn is-primary${a.danger ? ' is-danger' : ''}`} disabled={busy || invalid} onClick={submit}>
            {busy ? 'Running…' : a.danger === 2 ? `Yes, ${a.label.toLowerCase()}` : a.label}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="hl-form">
        {confirm && <p className={`hl-confirm${a.danger === 2 ? ' is-critical' : ''}`}>{confirm}</p>}
        {fields.map(f => (
          <Field key={f.name} f={f} value={params[f.name]} onChange={v => setParams(p => ({ ...p, [f.name]: v }))} />
        ))}
        <RequestPreview requests={reqs} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function Field({ f, value, onChange }) {
  const id = `f-${f.name}`;
  if (f.type === 'toggle')
    return (
      <label className="hl-field is-toggle">
        <input type="checkbox" checked={!!value} onChange={ev => onChange(ev.target.checked)} />
        <span className="hl-switch" aria-hidden="true" />
        {f.label}
      </label>
    );
  return (
    <label className="hl-field" htmlFor={id}>
      <span>
        {f.label}
        {f.type === 'range' && <b>{value}</b>}
      </span>
      {f.type === 'select' ? (
        <select id={id} value={value} onChange={ev => onChange(ev.target.value)}>
          {f.options.map(o => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : f.type === 'textarea' ? (
        <textarea id={id} rows={3} value={value} onChange={ev => onChange(ev.target.value)} />
      ) : f.type === 'range' ? (
        <input id={id} type="range" min={f.min} max={f.max} step={f.step} value={value} onChange={ev => onChange(Number(ev.target.value))} />
      ) : f.type === 'file' ? (
        <input id={id} type="file" onChange={ev => onChange(ev.target.files[0])} />
      ) : (
        <input id={id} type={f.type === 'number' ? 'number' : 'text'} value={value} pattern={f.pattern} onChange={ev => onChange(f.type === 'number' ? Number(ev.target.value) : ev.target.value)} />
      )}
    </label>
  );
}

// ---------- Command palette ----------

const SECTIONS = [
  ['system', 'System'],
  ['map', 'Map'],
  ['live', 'Pipelines'],
  ['services', 'Containers'],
  ['storage', 'Storage'],
];

function CommandPalette({ onClose }) {
  const state = useLive();
  const { open, onNavigate } = useActions();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const listRef = useRef(null);

  const all = useMemo(() => {
    const items = [];
    for (const t of allTargets(state)) {
      const e = resolve(t, state);
      if (!e) continue;
      for (const a of actionsFor(e, state)) items.push({ key: `${a.id}:${t.type}:${t.id}`, a, t, e, hay: `${a.label} ${e.title} ${e.sub ?? ''} ${a.group}`.toLowerCase() });
    }
    return items;
    // Recompute when the set of targets changes, not on every metric tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.streams.length, state.scanJobs.length, state.mediaJobs.length, Object.values(state.services).map(s => s.status).join()]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const nav = SECTIONS.filter(([, l]) => !words.length || words.every(w => `go ${l}`.toLowerCase().includes(w))).map(([id, l]) => ({ key: `nav:${id}`, nav: id, label: `Go to ${l}` }));
  const hits = (words.length ? all.filter(x => words.every(w => x.hay.includes(w))) : all.filter(x => x.a.primary)).slice(0, 60);
  const results = [...hits, ...nav];

  useEffect(() => setI(0), [q]);
  useEffect(() => listRef.current?.children[i]?.scrollIntoView({ block: 'nearest' }), [i]);

  const choose = r => {
    onClose();
    if (r.nav) {
      onNavigate?.(r.nav);
      return;
    }
    open(r.a.id, r.t);
  };

  return createPortal(
    <div className="hl hl-modal-backdrop is-top" onPointerDown={ev => ev.target === ev.currentTarget && onClose()}>
      <div className="hl-palette" role="dialog" aria-label="Command palette">
        <div className="hl-palette-input">
          <Icon name="search" />
          <input
            autoFocus
            value={q}
            placeholder={`Search ${all.length} actions — “restart jellyfin”, “snapshot 103”, “scrub”…`}
            onChange={ev => setQ(ev.target.value)}
            onKeyDown={ev => {
              if (ev.key === 'ArrowDown') (ev.preventDefault(), setI(x => Math.min(results.length - 1, x + 1)));
              else if (ev.key === 'ArrowUp') (ev.preventDefault(), setI(x => Math.max(0, x - 1)));
              else if (ev.key === 'Enter' && results[i]) choose(results[i]);
              else if (ev.key === 'Escape') (ev.stopPropagation(), onClose());
            }}
            aria-label="Search actions"
          />
          <kbd>esc</kbd>
        </div>
        <ul className="hl-palette-list" ref={listRef} role="listbox">
          {results.map((r, idx) => (
            <li key={r.key} role="option" aria-selected={idx === i} className={idx === i ? 'is-on' : ''} onPointerMove={() => setI(idx)} onClick={() => choose(r)}>
              <Icon name={r.nav ? 'up' : r.a.icon} />
              <span className="hl-palette-label">{r.nav ? r.label : r.a.label}</span>
              {!r.nav && <span className="hl-palette-ctx">{r.e.title}</span>}
              {!r.nav && r.a.danger ? <span className="hl-palette-danger">careful</span> : null}
            </li>
          ))}
          {results.length === 0 && <li className="hl-palette-empty">No action matches “{q}”.</li>}
        </ul>
        {!words.length && <div className="hl-palette-hint">Showing the most common actions. Type to search all of them.</div>}
      </div>
    </div>,
    document.body
  );
}

// ---------- Tasks ----------

export function TasksButton() {
  const { tasks, setDrawer } = useActions();
  const running = tasks.filter(t => t.status === 'running').length;
  return (
    <button className="hl-icon-btn has-label" onClick={() => setDrawer(true)} aria-label={`Tasks, ${running} running`}>
      <Icon name="tasks" />
      <span>{running ? `${running} running` : 'Tasks'}</span>
    </button>
  );
}

function TaskDrawer({ tasks, onClose, onClear }) {
  const [open, setOpen] = useState(tasks[0]?.id);
  useEffect(() => {
    const key = ev => ev.key === 'Escape' && (ev.stopPropagation(), onClose());
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  return createPortal(
    <div className="hl hl-modal-backdrop is-drawer" onPointerDown={ev => ev.target === ev.currentTarget && onClose()}>
      <aside className="hl-drawer" role="dialog" aria-label="Tasks">
        <header className="hl-modal-head">
          <div>
            <h3>Tasks</h3>
            <p>Everything you ran from this dashboard{MODE === 'mock' ? ' (simulated)' : ''}</p>
          </div>
          <div className="hl-actionbar">
            {tasks.length > 0 && (
              <button className="hl-btn is-ghost" onClick={onClear}>
                Clear
              </button>
            )}
            <button className="hl-icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
        </header>
        {tasks.length === 0 && <p className="hl-note hl-pad">Nothing yet. Every action you start shows up here with the exact request and its output.</p>}
        <ol className="hl-tasks">
          {tasks.map(t => (
            <li key={t.id} className={`is-${t.status}`}>
              <button className="hl-task-head" onClick={() => setOpen(o => (o === t.id ? null : t.id))} aria-expanded={open === t.id}>
                <span className={`hl-task-dot is-${t.status}`} aria-label={t.status} />
                <span className="hl-task-label">
                  <b>{t.label}</b>
                  <small>{t.title}</small>
                </span>
                <time>{new Date(t.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time>
              </button>
              {open === t.id && (
                <div className="hl-task-body">
                  <RequestPreview requests={t.requests} />
                  {t.lines.length > 0 && <pre className="hl-output">{t.lines.join('\n')}</pre>}
                </div>
              )}
            </li>
          ))}
        </ol>
      </aside>
    </div>,
    document.body
  );
}
