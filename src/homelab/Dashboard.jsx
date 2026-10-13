import { useEffect, useState } from 'react';
import { store } from './data/simulator';
import { MODE } from './data/executor';
import { useLive } from './useLive';
import { ActionMenu, ActionsProvider, TasksButton, useActions } from './ui/Actions';
import Icon from './ui/Icon';
import { DISKS, DOMAIN, HOST, LXCS } from './data/inventory';
import { Status, fmtDuration } from './charts';
import { CpuCard, GpuCard, MemoryCard, NetworkCard } from './panels/Hardware';
import Topology, { NodeDetail } from './panels/Topology';
import { ImmichCard, MediaPipeline, ScanPipeline, StreamsCard } from './panels/Pipelines';
import { DisksCard, LxcGrid, StorageCard } from './panels/Services';
import Events from './panels/Events';

const SECTIONS = [
  ['system', 'System'],
  ['map', 'Map'],
  ['live', 'Pipelines'],
  ['services', 'Services'],
  ['storage', 'Storage'],
];

const goTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function Dashboard() {
  return (
    <ActionsProvider onNavigate={goTo}>
      <DashboardBody />
    </ActionsProvider>
  );
}

function SearchButton() {
  const { setPalette } = useActions();
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button className="hl-search-btn" onClick={() => setPalette(true)} aria-label="Search actions">
      <Icon name="search" />
      <span>Search actions</span>
      <kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  );
}

function DashboardBody() {
  const state = useLive();
  const [paused, setPaused] = useState(store.isPaused());
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const select = id => {
    setSelected(cur => (cur === id ? null : id));
    if (id) document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const allSvcs = LXCS.flatMap(c => c.services);
  const running = allSvcs.filter(s => state.services[s.id].status === 'running').length;
  const warnings = [
    ...LXCS.filter(c => state.lxc[c.id].status === 'stopped').map(c => `LXC ${c.id} ${c.name} stopped`),
    ...allSvcs.filter(s => state.services[s.id].status !== 'running' && !state.services[s.id].byLxc).map(s => `${s.name} ${state.services[s.id].status}`),
    ...(state.qbit.paused ? ['downloads paused'] : []),
    ...DISKS.filter(d => d.smart.health !== 'good').map(d => `${d.id}: ${d.smart.reallocated} reallocated sectors`),
  ];

  return (
    <div className="hl hl-app">
      <header className="hl-top">
        <div className="hl-top-inner">
          <div className="hl-brand">
            <span className="hl-brand-mark" aria-hidden="true" />
            <div>
              <h1>{HOST.name}</h1>
              <p>
                {HOST.os} · up {fmtDuration(state.uptime)}
              </p>
            </div>
          </div>
          <nav className="hl-tabs" aria-label="Sections">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="hl-top-right">
            <SearchButton />
            <TasksButton />
            {MODE === 'mock' && (
              <span className="hl-mock" title="No backend is connected — every number and action is simulated">
                Mock
              </span>
            )}
            <time className="hl-clock">{new Date(state.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time>
            <button
              className="hl-btn"
              onClick={() => {
                store.setPaused(!paused);
                setPaused(!paused);
              }}
              aria-pressed={paused}
            >
              {paused ? '▶ Resume' : '❚❚ Pause'}
            </button>
            <ActionMenu target={{ type: 'host', id: HOST.name }} />
          </div>
        </div>
      </header>

      <main className="hl-main">
        <section className="hl-hero">
          <div>
            <p className="hl-eyebrow">Homelab · {DOMAIN}</p>
            <h2 className="hl-hero-title">{warnings.length ? `${warnings.length} things need a look` : 'Everything is running'}</h2>
            <ul className="hl-warnings">
              {warnings.map(w => (
                <li key={w}>
                  <Status status="warning" label={w} />
                </li>
              ))}
            </ul>
          </div>
          <dl className="hl-hero-stats">
            <div>
              <dt>Services</dt>
              <dd>
                {running}/{allSvcs.length}
              </dd>
            </div>
            <div>
              <dt>LXCs</dt>
              <dd>{LXCS.length}</dd>
            </div>
            <div>
              <dt>Streams</dt>
              <dd>{state.streams.length}</dd>
            </div>
            <div>
              <dt>Power</dt>
              <dd>{state.power.watts.toFixed(0)} W</dd>
            </div>
          </dl>
        </section>

        <section id="system" className="hl-section">
          <h2 className="hl-h2">System</h2>
          <div className="hl-grid-4">
            <CpuCard cpu={state.cpu} />
            <GpuCard gpu={state.gpu} streams={state.streams} />
            <MemoryCard ram={state.ram} lxc={state.lxc} />
            <NetworkCard net={state.net} power={state.power} caddy={state.caddy} />
          </div>
        </section>

        <section id="map" className="hl-section">
          <h2 className="hl-h2">How it’s wired</h2>
          <div className="hl-map-layout">
            <div className="hl-card hl-map-card" onClick={() => setSelected(null)}>
              <Topology state={state} selected={selected} onSelect={select} />
            </div>
            <NodeDetail id={selected} state={state} onClose={() => setSelected(null)} />
          </div>
        </section>

        <section id="live" className="hl-section">
          <h2 className="hl-h2">Live pipelines</h2>
          <div className="hl-live-layout">
            <div className="hl-stack-col">
              <ScanPipeline jobs={state.scanJobs} paperless={state.paperless} onSelect={select} />
              <MediaPipeline jobs={state.mediaJobs} onSelect={select} qbit={state.qbit} />
              <div className="hl-grid-2">
                <StreamsCard streams={state.streams} />
                <ImmichCard immich={state.immich} />
              </div>
            </div>
            <Events events={state.events} />
          </div>
        </section>

        <section id="services" className="hl-section">
          <h2 className="hl-h2">Containers</h2>
          <LxcGrid state={state} onSelect={select} selected={selected} />
        </section>

        <section id="storage" className="hl-section">
          <h2 className="hl-h2">Storage</h2>
          <div className="hl-storage-layout">
            <StorageCard scrub={state.scrub} />
            <DisksCard disks={state.disks} tests={state.smartTests} />
          </div>
        </section>

        <footer className="hl-foot">
          Simulated data and actions. Press <kbd>/</kbd> or <kbd>Ctrl K</kbd> to search every action. Set <code>VITE_HOMELAB_API</code> to send actions to a backend instead.
        </footer>
      </main>
    </div>
  );
}
