import { useEffect, useRef, useState } from 'react';
import { describeRequest, requestsOf } from '../data/actions';
import { MODE, shell } from '../data/executor';
import { mockLogLine } from '../data/mock-output';
import { newMediaJob, store } from '../data/simulator';
import { event } from '../data/simulator';
import { Modal, RequestPreview, useActions } from './Actions';
import Icon from './Icon';

const modeNote = <span className="hl-mode">{MODE === 'mock' ? 'Mock — nothing is sent' : 'Runs on the server'}</span>;

/** Runs immediately and shows what came back. */
export function OutputView({ a, e, target, onClose }) {
  const { run } = useActions();
  const [res, setRes] = useState(null);
  const go = () => {
    setRes(null);
    run(a, target, {}).then(setRes);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(go, []);
  return (
    <Modal
      title={a.label}
      sub={e.title}
      wide
      onClose={onClose}
      footer={
        <>
          {modeNote}
          <button className="hl-btn" onClick={go} disabled={!res}>
            <Icon name="refresh" /> Run again
          </button>
        </>
      }
    >
      <RequestPreview requests={requestsOf(a, e, {}).map(r => describeRequest(r, e))} />
      <pre className={`hl-output${res && !res.ok ? ' is-error' : ''}`}>{res ? res.lines.join('\n') : 'Running…'}</pre>
    </Modal>
  );
}

/** Follows a log stream (docker logs -f / journalctl -f). */
export function LogsView({ a, e, onClose }) {
  const key = e.type === 'svc' ? e.id : 'host';
  const [lines, setLines] = useState(() => Array.from({ length: 24 }, (_, i) => mockLogLine(key, Date.now() - (24 - i) * 4000)));
  const [follow, setFollow] = useState(true);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const box = useRef(null);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setLines(l => [...l.slice(-400), mockLogLine(key, Date.now())]), 700 + Math.random() * 900);
    return () => clearInterval(t);
  }, [key, paused]);
  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines, follow]);

  const shown = filter ? lines.filter(l => l.toLowerCase().includes(filter.toLowerCase())) : lines;
  const cmd = describeRequest(requestsOf(a, e, {})[0], e);
  return (
    <Modal
      title={`Logs · ${e.title}`}
      sub={cmd.text.replace(/^# /, '')}
      wide
      onClose={onClose}
      footer={
        <>
          {modeNote}
          <label className="hl-field is-toggle is-inline">
            <input type="checkbox" checked={follow} onChange={ev => setFollow(ev.target.checked)} />
            <span className="hl-switch" aria-hidden="true" />
            Follow
          </label>
          <button className="hl-btn" onClick={() => setPaused(p => !p)}>
            <Icon name={paused ? 'play' : 'pause'} /> {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="hl-btn is-ghost" onClick={() => setLines([])}>
            Clear
          </button>
        </>
      }
    >
      <input className="hl-input" placeholder="Filter lines…" value={filter} onChange={ev => setFilter(ev.target.value)} aria-label="Filter log lines" />
      <pre ref={box} className="hl-output is-logs" onScroll={ev => setFollow(ev.currentTarget.scrollHeight - ev.currentTarget.scrollTop - ev.currentTarget.clientHeight < 24)}>
        {shown.map((l, i) => (
          <div key={i} className={/warn|error|✗|unavailable|throttled/i.test(l) ? 'is-warn' : ''}>
            {l}
          </div>
        ))}
      </pre>
    </Modal>
  );
}

/** A line-based shell. The backend would run each line via `pct exec` / docker exec. */
export function TerminalView({ a, e, onClose }) {
  const where = e.type === 'host' ? 'host' : `lxc:${e.lxc.id}`;
  const inContainer = a.id === 'svc.exec';
  const prompt = inContainer ? `root@${e.svc.container ?? e.svc.name}:/#` : `root@${e.type === 'host' ? 'pve' : e.lxc.name}:~#`;
  const [hist, setHist] = useState([{ out: [`Connected to ${e.title}. Type “help” for what the mock understands.`] }]);
  const [line, setLine] = useState('');
  const [past, setPast] = useState([]);
  const [idx, setIdx] = useState(-1);
  const box = useRef(null);
  useEffect(() => {
    box.current.scrollTop = box.current.scrollHeight;
  }, [hist]);

  const submit = async ev => {
    ev.preventDefault();
    const cmd = line;
    setLine('');
    setIdx(-1);
    if (cmd.trim() === 'clear') return setHist([]);
    if (cmd.trim() === 'exit') return onClose();
    if (cmd.trim()) setPast(p => [cmd, ...p].slice(0, 50));
    setHist(h => [...h, { cmd }]);
    const out = await shell(where, cmd);
    setHist(h => [...h, { out }]);
  };

  return (
    <Modal title={a.label} sub={describeRequest(requestsOf(a, e, {})[0], e).text.replace(/^# /, '')} wide onClose={onClose} footer={modeNote}>
      <div className="hl-term" ref={box} onClick={() => box.current.querySelector('input')?.focus()}>
        {hist.map((h, i) =>
          h.cmd != null ? (
            <div key={i}>
              <span className="hl-term-prompt">{prompt}</span> {h.cmd}
            </div>
          ) : (
            <pre key={i}>{h.out.join('\n')}</pre>
          )
        )}
        <form onSubmit={submit} className="hl-term-line">
          <span className="hl-term-prompt">{prompt}</span>
          <input
            autoFocus
            value={line}
            onChange={ev => setLine(ev.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-label="Command"
            onKeyDown={ev => {
              if (ev.key === 'ArrowUp' && past.length) {
                ev.preventDefault();
                const n = Math.min(past.length - 1, idx + 1);
                setIdx(n);
                setLine(past[n]);
              } else if (ev.key === 'ArrowDown') {
                ev.preventDefault();
                const n = Math.max(-1, idx - 1);
                setIdx(n);
                setLine(n < 0 ? '' : past[n]);
              }
            }}
          />
        </form>
      </div>
    </Modal>
  );
}

/** Edit a config file, validate, save & apply. */
export function EditorView({ a, e, target, onClose }) {
  const { run } = useActions();
  const [file] = useState(() => a.file(e));
  const [text, setText] = useState(file.content);
  const [check, setCheck] = useState(null);
  const [step, setStep] = useState('edit'); // edit → confirm
  const [busy, setBusy] = useState(false);
  const dirty = text !== file.content;
  const lines = text.split('\n').length;

  const validate = async () => {
    setCheck({ running: true });
    await new Promise(r => setTimeout(r, 500));
    const bad = /\t\t\t\t|<<<<|>>>>/.test(text) || (file.path.endsWith('.yml') && /\t/.test(text));
    setCheck({ ok: !bad, text: bad ? 'Validation failed: tabs are not allowed in YAML / merge markers found' : `✓ ${file.validate ?? 'syntax'} passed` });
  };
  const save = async () => {
    setBusy(true);
    await run(a, target, { content: text });
    onClose();
  };

  return (
    <Modal
      title={file.path}
      sub={`${a.label} · ${e.title}`}
      wide
      onClose={onClose}
      footer={
        step === 'edit' ? (
          <>
            {check && !check.running && <span className={`hl-check ${check.ok ? 'is-good' : 'is-bad'}`}>{check.text}</span>}
            {!check && modeNote}
            {file.validate && (
              <button className="hl-btn" onClick={validate} disabled={check?.running}>
                <Icon name="check" /> Validate
              </button>
            )}
            <button className="hl-btn is-ghost" onClick={() => setText(file.content)} disabled={!dirty}>
              Revert
            </button>
            <button className="hl-btn is-primary" disabled={!dirty || check?.ok === false} onClick={() => setStep('confirm')}>
              Review & apply
            </button>
          </>
        ) : (
          <>
            {modeNote}
            <button className="hl-btn is-ghost" onClick={() => setStep('edit')}>
              Back
            </button>
            <button className="hl-btn is-primary is-danger" onClick={save} disabled={busy}>
              {busy ? 'Applying…' : 'Save & apply'}
            </button>
          </>
        )
      }
    >
      {step === 'edit' ? (
        <div className="hl-editor">
          <div className="hl-editor-gutter" aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            value={text}
            spellCheck={false}
            onChange={ev => {
              setText(ev.target.value);
              setCheck(null);
            }}
            onKeyDown={ev => {
              if (ev.key === 'Tab') {
                ev.preventDefault();
                const el = ev.currentTarget;
                const s = el.selectionStart;
                const ins = file.path.endsWith('.yml') ? '  ' : '\t';
                setText(text.slice(0, s) + ins + text.slice(el.selectionEnd));
                requestAnimationFrame(() => (el.selectionStart = el.selectionEnd = s + ins.length));
              }
            }}
            aria-label={`Contents of ${file.path}`}
          />
        </div>
      ) : (
        <>
          <Diff a={file.content} b={text} />
          <RequestPreview requests={requestsOf(a, e, { content: '…' }).map(r => describeRequest(r, e))} />
        </>
      )}
    </Modal>
  );
}

/** Line diff (LCS), fine for config files of a few hundred lines. */
function Diff({ a, b }) {
  const A = a.split('\n');
  const B = b.split('\n');
  const L = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) out.push([' ', A[i++], j++]);
    else if (L[i + 1][j] >= L[i][j + 1]) out.push(['-', A[i++]]);
    else out.push(['+', B[j++]]);
  }
  while (i < A.length) out.push(['-', A[i++]]);
  while (j < B.length) out.push(['+', B[j++]]);
  const changed = out.filter(l => l[0] !== ' ').length;
  return (
    <div>
      <p className="hl-note">{changed} line{changed === 1 ? '' : 's'} changed</p>
      <pre className="hl-output hl-diff">
        {out.map((l, k) => (
          <div key={k} className={l[0] === '+' ? 'is-add' : l[0] === '-' ? 'is-del' : ''}>
            {l[0]} {l[1]}
          </div>
        ))}
      </pre>
    </div>
  );
}

// ---- Request media (Seerr) ----

const CATALOG = [
  { tmdb: 693134, title: 'Dune: Part Two', year: 2024, type: 'movie', status: 'available', hue: 32 },
  { tmdb: 329865, title: 'Arrival', year: 2016, type: 'movie', status: 'available', hue: 200 },
  { tmdb: 840430, title: 'The Holdovers', year: 2023, type: 'movie', status: 'none', hue: 20 },
  { tmdb: 666277, title: 'Past Lives', year: 2023, type: 'movie', status: 'none', hue: 210 },
  { tmdb: 915935, title: 'Anatomy of a Fall', year: 2023, type: 'movie', status: 'requested', hue: 0 },
  { tmdb: 976893, title: 'Perfect Days', year: 2023, type: 'movie', status: 'none', hue: 120 },
  { tmdb: 965150, title: 'Aftersun', year: 2022, type: 'movie', status: 'available', hue: 190 },
  { tmdb: 1022789, title: 'Inside Out 2', year: 2024, type: 'movie', status: 'none', hue: 280 },
  { tmdb: 933260, title: 'The Substance', year: 2024, type: 'movie', status: 'none', hue: 340 },
  { tmdb: 95396, title: 'Severance', year: 2022, type: 'tv', seasons: 2, status: 'partial', hue: 180 },
  { tmdb: 126308, title: 'Shōgun', year: 2024, type: 'tv', seasons: 1, status: 'available', hue: 10 },
  { tmdb: 136315, title: 'The Bear', year: 2022, type: 'tv', seasons: 4, status: 'partial', hue: 45 },
  { tmdb: 83867, title: 'Andor', year: 2022, type: 'tv', seasons: 2, status: 'none', hue: 220 },
  { tmdb: 95480, title: 'Slow Horses', year: 2022, type: 'tv', seasons: 5, status: 'partial', hue: 90 },
  { tmdb: 70523, title: 'Dark', year: 2017, type: 'tv', seasons: 3, status: 'none', hue: 260 },
  { tmdb: 87108, title: 'Chernobyl', year: 2019, type: 'tv', seasons: 1, status: 'none', hue: 60 },
  { tmdb: 100088, title: 'The Last of Us', year: 2023, type: 'tv', seasons: 2, status: 'none', hue: 140 },
];
const STATUS = { available: 'In library', partial: 'Partly in library', requested: 'Requested', none: '' };

export function RequestView({ a, e, target, onClose }) {
  const { run } = useActions();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [pick, setPick] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [profile, setProfile] = useState('HD-1080p');
  const [busy, setBusy] = useState(false);

  const results = CATALOG.filter(m => (kind === 'all' || m.type === kind) && (!q || m.title.toLowerCase().includes(q.toLowerCase())));
  const choose = m => {
    setPick(m);
    setSeasons(m.type === 'tv' ? [m.seasons] : []);
  };
  const submit = async () => {
    setBusy(true);
    await run({ ...a, effect: undefined }, target, { media: pick, seasons, profile });
    // Mock: drop the request into the pipeline so it can be watched end to end.
    if (MODE === 'mock')
      store.mutate(s => {
        const job = { ...newMediaJob(s.t), title: pick.type === 'tv' ? `${pick.title} S${String(seasons.at(-1) ?? 1).padStart(2, '0')}` : pick.title, type: pick.type === 'tv' ? 'series' : 'movie', by: 'malte' };
        s.mediaJobs = [...s.mediaJobs, job];
        event(s, 'seerr', `malte requested “${job.title}” (${profile})`);
      });
    onClose();
  };

  return (
    <Modal
      title="Request media"
      sub="Search via Seerr → sent to Radarr / Sonarr"
      wide
      onClose={onClose}
      footer={
        pick ? (
          <>
            {modeNote}
            <button className="hl-btn is-ghost" onClick={() => setPick(null)}>
              Back
            </button>
            <button className="hl-btn is-primary" disabled={busy || (pick.type === 'tv' && !seasons.length) || pick.status === 'available'} onClick={submit}>
              {busy ? 'Requesting…' : pick.status === 'available' ? 'Already in library' : `Request ${pick.type === 'tv' ? `${seasons.length} season${seasons.length > 1 ? 's' : ''}` : 'movie'}`}
            </button>
          </>
        ) : (
          modeNote
        )
      }
    >
      {!pick ? (
        <>
          <div className="hl-request-bar">
            <input className="hl-input" autoFocus placeholder="Search movies and shows…" value={q} onChange={ev => setQ(ev.target.value)} aria-label="Search media" />
            <div className="hl-seg">
              {[
                ['all', 'All'],
                ['movie', 'Movies'],
                ['tv', 'Series'],
              ].map(([k, l]) => (
                <button key={k} className={kind === k ? 'is-on' : ''} onClick={() => setKind(k)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {!q && <p className="hl-note">Trending</p>}
          <ul className="hl-posters">
            {results.map(m => (
              <li key={m.tmdb}>
                <button onClick={() => choose(m)}>
                  <span className="hl-poster" style={{ '--h': m.hue }}>
                    <span>{m.title}</span>
                  </span>
                  <b>{m.title}</b>
                  <small>
                    {m.year} · {m.type === 'tv' ? 'Series' : 'Movie'}
                    {STATUS[m.status] && ` · ${STATUS[m.status]}`}
                  </small>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="hl-note">Nothing found for “{q}”.</li>}
          </ul>
        </>
      ) : (
        <div className="hl-request-pick">
          <span className="hl-poster is-big" style={{ '--h': pick.hue }}>
            <span>{pick.title}</span>
          </span>
          <div className="hl-form">
            <div>
              <h4 className="hl-request-title">{pick.title}</h4>
              <p className="hl-note">
                {pick.year} · {pick.type === 'tv' ? `${pick.seasons} seasons` : 'Movie'} · TMDB {pick.tmdb}
              </p>
            </div>
            {pick.type === 'tv' && (
              <fieldset className="hl-seasons">
                <legend>Seasons</legend>
                {Array.from({ length: pick.seasons }, (_, i) => i + 1).map(n => (
                  <label key={n} className="hl-chipbox">
                    <input type="checkbox" checked={seasons.includes(n)} onChange={ev => setSeasons(s => (ev.target.checked ? [...s, n].sort((x, y) => x - y) : s.filter(x => x !== n)))} />
                    <span>S{String(n).padStart(2, '0')}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <label className="hl-field">
              <span>Quality profile</span>
              <select value={profile} onChange={ev => setProfile(ev.target.value)}>
                {['HD-1080p', 'Ultra-HD', 'HD - 720p/1080p', 'Any'].map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <RequestPreview requests={requestsOf(a, e, { media: pick, seasons }).map(r => describeRequest(r, e))} />
          </div>
        </div>
      )}
    </Modal>
  );
}
