// Mock live feed. Produces one snapshot per second with the same shape a real
// collector (Proxmox API + node_exporter + service webhooks) would deliver, so
// swapping it out later means replacing this file only.

import { DISKS, HOST, LXCS, MEDIA_STAGES, SCAN_STAGES } from './inventory';

const TICK_MS = 1000;
export const HISTORY = 120; // samples kept per series (2 min at 1 s)

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Mean-reverting random walk: drifts toward `target`, jitters by `vol`.
const walk = (v, target, vol, lo, hi, pull = 0.12) => clamp(v + (target - v) * pull + rand(-vol, vol), lo, hi);
const push = (arr, v) => {
  const next = arr.length >= HISTORY ? arr.slice(1) : arr.slice();
  next.push(v);
  return next;
};

const MOVIES = ['Dune: Part Two', 'Arrival', 'The Holdovers', 'Past Lives', 'Oppenheimer', 'Perfect Days', 'Aftersun', 'Anatomy of a Fall'];
const SERIES = ['Severance S02E07', 'Shōgun S01E04', 'The Bear S03E02', 'Andor S02E01', 'Slow Horses S04E05', 'Dark S01E01'];
const VIEWERS = [
  { user: 'malte', device: 'LG webOS TV' },
  { user: 'malte', device: 'iPhone · Swiftfin' },
  { user: 'lena', device: 'Chrome · Windows' },
  { user: 'papa', device: 'Fire TV Stick' },
];
const DOC_NAMES = ['Rechnung Stadtwerke', 'Kontoauszug 09/2026', 'Arztbrief', 'Lohnabrechnung', 'Versicherungsschein', 'Mietvertrag Nachtrag', 'Garantie Waschmaschine', 'Steuerbescheid 2025'];
const DOC_TAGS = ['Rechnung', 'Bank', 'Gesundheit', 'Arbeit', 'Versicherung', 'Wohnung', 'Garantie', 'Steuer'];

const SCAN_DURATION = {
  scan: j => j.pages * 3.5,
  inbox: () => 2,
  convert: j => 3 + j.pages * 2.5,
  consume: () => 3,
  ingest: () => 7,
  done: () => 25,
};
const MEDIA_DURATION = {
  request: () => 3,
  search: () => rand(4, 8),
  download: j => j.size / j.speed,
  import: () => 5,
  done: () => 30,
};

let seq = 0;
const nextId = p => `${p}${++seq}`;

export function newScanJob(t) {
  const i = Math.floor(Math.random() * DOC_NAMES.length);
  return { id: nextId('scan'), name: DOC_NAMES[i], tag: DOC_TAGS[i], pages: Math.ceil(rand(1, 6)), stage: 0, progress: 0, stageAt: t, startedAt: t };
}
export function newMediaJob(t) {
  const movie = Math.random() < 0.55;
  const size = movie ? rand(4, 22) : rand(1.2, 4.5); // GB
  return {
    id: nextId('media'),
    title: movie ? pick(MOVIES) : pick(SERIES),
    type: movie ? 'movie' : 'series',
    by: pick(['malte', 'lena', 'papa']),
    size,
    speed: rand(0.12, 0.35), // GB/s on the simulated clock (faster than life, so it moves)
    stage: 0,
    progress: 0,
    stageAt: t,
  };
}
function newStream() {
  const v = pick(VIEWERS);
  const transcode = Math.random() < 0.6;
  return {
    id: nextId('stream'),
    ...v,
    title: Math.random() < 0.5 ? pick(MOVIES) : pick(SERIES),
    transcode,
    codec: transcode ? 'HEVC → H.264 (QSV)' : 'Direct play · HEVC',
    res: pick(['2160p', '1080p', '1080p', '720p']),
    bitrate: transcode ? rand(6, 14) : rand(12, 40),
    progress: rand(0.02, 0.7),
    paused: false,
  };
}

function initialState(t) {
  const lxc = {};
  for (const c of LXCS) lxc[c.id] = { status: 'running', cpu: 2, mem: c.ram * 0.3, uptime: rand(3, 30) * 86400, rx: 0, tx: 0 };
  const services = {};
  for (const c of LXCS) for (const s of c.services) services[s.id] = { status: 'running', cpu: 0.5, mem: rand(40, 300) };
  services.bazarr.status = 'degraded'; // one thing to look at
  const disks = {};
  for (const d of DISKS) disks[d.id] = { temp: d.smart.temp, read: 0, write: 0, busy: 0, readHist: [], writeHist: [] };

  return {
    t,
    uptime: 23 * 86400 + 4 * 3600 + 17 * 60,
    cpu: { usage: 12, cores: Array.from({ length: HOST.cpu.threads }, () => rand(2, 20)), temp: 48, load: [1.2, 1.4, 1.3], hist: [], tempHist: [], freq: 3.8 },
    gpu: { util: 4, video: 0, render: 2, vram: 0.6, temp: 41, power: 9, fan: 0, hist: [], videoHist: [] },
    ram: { arc: 18_000, hist: [] },
    net: { rx: 4, tx: 2, rxHist: [], txHist: [] },
    power: { watts: 58, hist: [] },
    disks,
    lxc,
    services,
    streams: [newStream()],
    scanJobs: [{ ...newScanJob(t), stage: 2, progress: 0.4 }],
    mediaJobs: [{ ...newMediaJob(t), stage: 2, progress: 0.35 }],
    immich: { assets: 48_213, uploadsToday: 37, queue: { thumbnails: 0, metadata: 0, faces: 0, smartSearch: 0 } },
    paperless: { docs: 1_284, inbox: 3 },
    caddy: { rps: 2, certDays: 61 },
    qbit: { paused: false, altSpeed: false, limit: 0 },
    scrub: {},
    smartTests: {},
    events: [],
    activity: {},
  };
}

export function event(s, source, text, level = 'info') {
  s.events = [{ id: nextId('ev'), t: s.t, source, text, level }, ...s.events].slice(0, 60);
}

function step(prev, t) {
  const s = { ...prev, t, uptime: prev.uptime + TICK_MS / 1000 };
  const dt = TICK_MS / 1000;

  // ---- Jellyfin streams ----
  const up = id => prev.services[id]?.status === 'running' || prev.services[id]?.status === 'degraded';
  let streams = (up('jellyfin') ? prev.streams : [])
    .map(st => ({ ...st, progress: st.paused ? st.progress : st.progress + dt / 2400, paused: Math.random() < 0.01 ? !st.paused : st.paused }))
    .filter(st => {
      if (st.progress < 1 && Math.random() > 0.004) return true;
      event(s, 'jellyfin', `${st.user} stopped “${st.title}”`);
      return false;
    });
  if (up('jellyfin') && streams.length < 3 && Math.random() < 0.012) {
    const st = newStream();
    streams = [...streams, st];
    event(s, 'jellyfin', `${st.user} started “${st.title}” on ${st.device}${st.transcode ? ' · transcoding' : ''}`);
  }
  s.streams = streams;
  const transcodes = streams.filter(x => x.transcode && !x.paused).length;
  const remote = streams.filter(x => !x.paused).length;

  // ---- Scanner pipeline ----
  let scanJobs = prev.scanJobs.map(j => ({ ...j }));
  for (const j of scanJobs) {
    const stage = SCAN_STAGES[j.stage];
    j.stalled = stage.where in prev.services && !up(stage.where);
    if (j.stalled) continue;
    j.progress += dt / SCAN_DURATION[stage.id](j);
    if (j.progress >= 1) {
      if (stage.id === 'done') {
        j.remove = true;
        continue;
      }
      j.stage += 1;
      j.progress = 0;
      j.stageAt = t;
      const now = SCAN_STAGES[j.stage].id;
      if (now === 'inbox') event(s, 'scanner', `scan_${j.id.slice(4).padStart(4, '0')}.jpg ×${j.pages} landed in /scans/inbox`);
      if (now === 'convert') event(s, 'scan-watcher', `merging ${j.pages} page${j.pages > 1 ? 's' : ''} → PDF, running OCR (deu+eng)`);
      if (now === 'consume') event(s, 'scan-watcher', `moved ${j.name}.pdf → paperless consume/`);
      if (now === 'ingest') event(s, 'paperless', `consuming ${j.name}.pdf`);
      if (now === 'done') {
        s.paperless = { ...s.paperless, docs: s.paperless.docs + 1, inbox: s.paperless.inbox + 1 };
        event(s, 'paperless', `archived “${j.name}” · tagged ${j.tag}`, 'good');
      }
    }
  }
  scanJobs = scanJobs.filter(j => !j.remove);
  if (scanJobs.filter(j => j.stage < 5).length === 0 && Math.random() < 0.035) {
    const j = newScanJob(t);
    scanJobs.push(j);
    event(s, 'scanner', `scan started · ${j.pages} page${j.pages > 1 ? 's' : ''}`);
  }
  s.scanJobs = scanJobs;
  const scanStage = id => scanJobs.some(j => SCAN_STAGES[j.stage].id === id);

  // ---- Media pipeline ----
  let mediaJobs = prev.mediaJobs.map(j => ({ ...j }));
  for (const j of mediaJobs) {
    const stage = MEDIA_STAGES[j.stage];
    j.stalled = (stage.where in prev.services && !up(stage.where)) || (stage.id === 'download' && prev.qbit.paused);
    if (j.stalled) continue;
    if (stage.id === 'download') j.speed = walk(j.speed, j.cap ?? (prev.qbit.altSpeed ? 0.05 : prev.qbit.limit ? Math.min(0.25, prev.qbit.limit / 1000) : 0.25), 0.04, 0.01, 0.5);
    j.progress += dt / MEDIA_DURATION[stage.id](j);
    if (j.progress >= 1) {
      if (stage.id === 'done') {
        j.remove = true;
        continue;
      }
      j.stage += 1;
      j.progress = 0;
      j.stageAt = t;
      const arr = j.type === 'movie' ? 'radarr' : 'sonarr';
      const now = MEDIA_STAGES[j.stage].id;
      if (now === 'search') event(s, arr, `searching indexers for “${j.title}”`);
      if (now === 'download') event(s, 'qbittorrent', `grabbed “${j.title}” · ${j.size.toFixed(1)} GB`);
      if (now === 'import') event(s, arr, `importing “${j.title}” → /media/${j.type === 'movie' ? 'movies' : 'tv'}`);
      if (now === 'done') event(s, 'jellyfin', `“${j.title}” added to library`, 'good');
    }
  }
  mediaJobs = mediaJobs.filter(j => !j.remove);
  if (mediaJobs.filter(j => j.stage < 4).length < 3 && Math.random() < 0.015) {
    const j = newMediaJob(t);
    mediaJobs.push(j);
    event(s, 'seerr', `${j.by} requested “${j.title}”`);
  }
  s.mediaJobs = mediaJobs;
  const mediaStage = id => mediaJobs.some(j => MEDIA_STAGES[j.stage].id === id);
  const dlSpeed = mediaJobs.filter(j => MEDIA_STAGES[j.stage].id === 'download' && !j.stalled).reduce((a, j) => a + j.speed * 8 * 100, 0); // Mbit/s

  // ---- Immich ----
  const q = { ...prev.immich.queue };
  let im = { ...prev.immich, queue: q };
  if (Math.random() < 0.02) {
    const n = Math.ceil(rand(3, 40));
    q.thumbnails += n;
    q.metadata += n;
    q.faces += n;
    q.smartSearch += n;
    im.assets += n;
    im.uploadsToday += n;
    event(s, 'immich', `${n} new asset${n > 1 ? 's' : ''} uploaded from iPhone`);
  }
  const working = name => up('immich-server') && !im.paused?.[name];
  if (working('thumbnails')) q.thumbnails = Math.max(0, q.thumbnails - Math.ceil(rand(0, 4)));
  if (working('metadata')) q.metadata = Math.max(0, q.metadata - Math.ceil(rand(0, 5)));
  if (working('faces') && up('immich-ml')) q.faces = Math.max(0, q.faces - (Math.random() < 0.5 ? 1 : 0));
  if (working('smartSearch') && up('immich-ml')) q.smartSearch = Math.max(0, q.smartSearch - (Math.random() < 0.6 ? 1 : 0));
  s.immich = im;
  const mlBusy = up('immich-ml') && q.faces + q.smartSearch > 0;

  // ---- Occasional background events ----
  if (Math.random() < 0.006) event(s, 'caddy', `GET jellyfin.${'malte.dydns.io'} ${pick(['200', '200', '200', '206', '304'])} · ${pick(['DE', 'DE', 'NL', 'AT'])}`);
  if (Math.random() < 0.002) event(s, 'ddns-updater', 'WAN IP unchanged · 84.1xx.xx.17');
  if (Math.random() < 0.0015) event(s, 'bazarr', 'OpenSubtitles rate limit hit, retrying in 10 min', 'warning');

  // ---- Hardware ----
  const cpuTarget = 6 + transcodes * 4 + (scanStage('convert') ? 18 : 0) + (scanStage('ingest') ? 9 : 0) + (mediaStage('import') ? 10 : 0) + (q.thumbnails > 0 ? 12 : 0) + dlSpeed / 80;
  const cores = prev.cpu.cores.map(c => walk(c, cpuTarget * rand(0.4, 1.8), 6, 0, 100, 0.3));
  const usage = cores.reduce((a, b) => a + b, 0) / cores.length;
  const temp = walk(prev.cpu.temp, 42 + usage * 0.42, 0.6, 35, 92, 0.08);
  const load = [walk(prev.cpu.load[0], (usage / 100) * 16, 0.12, 0, 16, 0.1), walk(prev.cpu.load[1], (usage / 100) * 16, 0.04, 0, 16, 0.03), walk(prev.cpu.load[2], (usage / 100) * 16, 0.02, 0, 16, 0.01)];
  s.cpu = { usage, cores, temp, load, freq: walk(prev.cpu.freq, 3.6 + usage / 80, 0.08, 1.4, 4.6, 0.3), hist: push(prev.cpu.hist, usage), tempHist: push(prev.cpu.tempHist, temp) };

  const video = clamp(transcodes * 22 + rand(-3, 3), 0, 100);
  const render = walk(prev.gpu.render, (mlBusy ? 38 : 1) + transcodes * 6, 3, 0, 100, 0.25);
  const util = Math.max(video, render);
  const gtemp = walk(prev.gpu.temp, 38 + util * 0.38, 0.5, 30, 90, 0.1);
  s.gpu = {
    util,
    video,
    render,
    vram: walk(prev.gpu.vram, 0.5 + transcodes * 0.42 + (mlBusy ? 1.6 : 0), 0.05, 0.3, HOST.gpu.vram, 0.2),
    temp: gtemp,
    power: walk(prev.gpu.power, 8 + util * 0.55, 1, 6, 75, 0.25),
    fan: gtemp > 55 ? Math.round(900 + (gtemp - 55) * 60) : 0,
    hist: push(prev.gpu.hist, util),
    videoHist: push(prev.gpu.videoHist, video),
  };

  const rx = walk(prev.net.rx, 3 + dlSpeed + (q.thumbnails > 0 ? 40 : 0), 2, 0, HOST.nic.speed, 0.3);
  const tx = walk(prev.net.tx, 2 + streams.reduce((a, x) => a + (x.paused ? 0 : x.bitrate), 0), 1.5, 0, HOST.nic.speed, 0.3);
  s.net = { rx, tx, rxHist: push(prev.net.rxHist, rx), txHist: push(prev.net.txHist, tx) };

  const watts = walk(prev.power.watts, 42 + usage * 0.7 + s.gpu.power * 0.9, 1.2, 30, 250, 0.2);
  s.power = { watts, hist: push(prev.power.hist, watts) };

  const lxc = {};
  const svcLoad = {
    caddy: 0.3 + remote * 0.6,
    ddclient: 0.05,
    jellyfin: 1 + transcodes * 18,
    seerr: 0.4 + (mediaStage('request') ? 4 : 0),
    radarr: 0.6 + (mediaStage('import') ? 12 : 0) + (mediaStage('search') ? 3 : 0),
    sonarr: 0.6 + (mediaStage('import') ? 6 : 0),
    prowlarr: 0.3 + (mediaStage('search') ? 9 : 0),
    qbit: 0.5 + dlSpeed / 40,
    bazarr: 0.2,
    'immich-server': 1 + (q.thumbnails > 0 ? 22 : 0),
    'immich-ml': mlBusy ? 30 : 0.2,
    'immich-db': 0.5 + (q.metadata > 0 ? 4 : 0),
    'immich-redis': 0.2,
    'smb-inbox': scanStage('inbox') || scanStage('scan') ? 3 : 0.05,
    'scan-watcher': scanStage('convert') ? 45 : scanStage('consume') ? 4 : 0.1,
    paperless: 1 + (scanStage('ingest') ? 30 : 0),
    'paperless-redis': 0.2,
    gotenberg: 0.1,
    tika: scanStage('ingest') ? 14 : 0.1,
  };
  const services = {};
  for (const c of LXCS) {
    let cpuSum = 0;
    let memSum = 60;
    for (const sv of c.services) {
      let p = prev.services[sv.id];
      if (p.until && t >= p.until) {
        if (p.status === 'restarting' || p.status === 'starting') event(s, sv.name, 'is up again', 'good');
        p = { ...p, status: p.next ?? 'running', until: null, next: null };
      }
      if (p.status === 'stopped') {
        services[sv.id] = { ...p, cpu: 0, mem: 0 };
        continue;
      }
      const boot = p.status === 'restarting' || p.status === 'starting';
      const cpu = walk(p.cpu, boot ? 35 : svcLoad[sv.id] ?? 0.3, 0.3, 0, 100, 0.35);
      const mem = walk(p.mem, (svcLoad[sv.id] ?? 0.3) * 8 + (sv.id === 'jellyfin' ? 900 : sv.id === 'immich-ml' ? 1400 : sv.id.includes('db') ? 380 : 140), 6, 20, c.ram, boot ? 0.05 : 0.12);
      services[sv.id] = { ...p, cpu, mem };
      cpuSum += cpu;
      memSum += mem;
    }
    let pl = prev.lxc[c.id];
    if (pl.until && t >= pl.until) pl = { ...pl, status: pl.next, until: null, next: null };
    const off = pl.status === 'stopped';
    lxc[c.id] = { ...pl, cpu: off ? 0 : clamp(cpuSum / c.cores, 0, 100), mem: off ? 0 : Math.min(memSum, c.ram), uptime: off ? 0 : pl.uptime + dt };
  }
  s.services = services;
  s.lxc = lxc;

  const arc = walk(prev.ram.arc, 20_000, 120, 8_000, 32_000, 0.02);
  const lxcMem = Object.values(lxc).reduce((a, x) => a + x.mem, 0);
  s.ram = { arc, hist: push(prev.ram.hist, lxcMem + arc + 2400) };

  const disks = {};
  for (const d of DISKS) {
    const p = prev.disks[d.id];
    const active =
      d.pool === 'tank'
        ? (remote ? 20 + remote * 15 : 0) + dlSpeed / 4 + (mediaStage('import') ? 180 : 0) + (q.thumbnails > 0 ? 25 : 0)
        : d.pool === 'rpool'
          ? 4 + usage / 3
          : 0;
    const read = walk(p.read, active * 0.6, 2, 0, d.kind === 'NVMe' ? 3000 : 260, 0.3);
    const write = walk(p.write, active * 0.4 + (scanStage('consume') && d.pool === 'tank' ? 20 : 0), 2, 0, d.kind === 'NVMe' ? 3000 : 260, 0.3);
    disks[d.id] = {
      temp: walk(p.temp, d.smart.temp + (read + write) / 60, 0.08, 20, 70, 0.05),
      read,
      write,
      busy: clamp((read + write) / (d.kind === 'NVMe' ? 20 : 2.6), 0, 100),
      readHist: push(p.readHist, read),
      writeHist: push(p.writeHist, write),
    };
  }
  s.disks = disks;
  const scrub = {};
  for (const [pool, sc] of Object.entries(prev.scrub)) {
    if (sc.done) {
      scrub[pool] = sc;
      continue;
    }
    const progress = Math.min(1, sc.progress + dt / 90);
    scrub[pool] = { ...sc, progress, done: progress >= 1 };
    if (progress >= 1) event(s, 'zfs', `scrub of ${pool} finished · 0 errors`, 'good');
  }
  s.scrub = scrub;
  s.caddy = { ...prev.caddy, rps: walk(prev.caddy.rps, 1 + remote * 6, 0.8, 0, 200, 0.3) };

  // ---- Which links carry traffic right now (0..1), used for the flow dots ----
  const a = {};
  const set = (from, to, v) => {
    if (v > 0) a[`${from}>${to}`] = Math.max(a[`${from}>${to}`] || 0, clamp(v, 0, 1));
  };
  const web = clamp(remote / 3 + 0.1, 0, 1);
  set('clients', 'dyndns', web);
  set('dyndns', 'router', web);
  set('router', 'caddy', web);
  set('caddy', 'jellyfin', remote ? remote / 3 : 0);
  set('jellyfin', 'tank/media', remote ? remote / 3 : 0);
  set('caddy', 'seerr', mediaStage('request') ? 0.8 : 0.08);
  set('seerr', 'radarr', mediaJobs.some(j => j.type === 'movie' && j.stage === 0) ? 0.8 : 0);
  set('seerr', 'sonarr', mediaJobs.some(j => j.type === 'series' && j.stage === 0) ? 0.8 : 0);
  set('radarr', 'prowlarr', mediaJobs.some(j => j.type === 'movie' && j.stage === 1) ? 0.8 : 0);
  set('sonarr', 'prowlarr', mediaJobs.some(j => j.type === 'series' && j.stage === 1) ? 0.8 : 0);
  set('prowlarr', 'indexers', mediaStage('search') ? 0.9 : 0);
  set('radarr', 'qbit', mediaJobs.some(j => j.type === 'movie' && j.stage === 2) ? 0.4 : 0);
  set('sonarr', 'qbit', mediaJobs.some(j => j.type === 'series' && j.stage === 2) ? 0.4 : 0);
  set('qbit', 'tank/downloads', clamp(dlSpeed / 300, 0, 1));
  set('radarr', 'tank/media', mediaJobs.some(j => j.type === 'movie' && j.stage === 3) ? 1 : 0);
  set('sonarr', 'tank/media', mediaJobs.some(j => j.type === 'series' && j.stage === 3) ? 1 : 0);
  set('phone', 'immich-server', q.thumbnails > 0 ? 0.9 : 0);
  set('immich-server', 'tank/photos', q.thumbnails > 0 ? 0.7 : 0);
  set('immich-server', 'immich-ml', mlBusy ? 0.7 : 0);
  set('immich-server', 'immich-db', q.metadata > 0 ? 0.5 : 0);
  set('immich-server', 'immich-redis', q.thumbnails + q.faces > 0 ? 0.4 : 0);
  set('scanner-dev', 'smb-inbox', scanStage('scan') ? 0.9 : 0);
  set('smb-inbox', 'scan-watcher', scanStage('inbox') ? 1 : 0);
  set('scan-watcher', 'paperless', scanStage('consume') ? 1 : 0);
  set('paperless', 'tika', scanStage('ingest') ? 0.8 : 0);
  set('paperless', 'paperless-redis', scanStage('ingest') ? 0.5 : 0);
  set('paperless', 'tank/documents', scanStage('done') && scanJobs.some(j => SCAN_STAGES[j.stage].id === 'done' && j.progress < 0.2) ? 1 : 0);
  s.activity = a;

  return s;
}

// ---- Store (useSyncExternalStore-compatible) ----

let state;
let timer = null;
let paused = false;
const listeners = new Set();

function warmUp() {
  const now = Date.now();
  state = initialState(now - HISTORY * TICK_MS);
  for (let i = HISTORY; i > 0; i--) state = step(state, now - (i - 1) * TICK_MS);
}

function tick() {
  if (paused) return;
  state = step(state, Date.now());
  for (const l of listeners) l();
}

export const store = {
  subscribe(l) {
    listeners.add(l);
    if (!timer) timer = setInterval(tick, TICK_MS);
    return () => {
      listeners.delete(l);
      if (!listeners.size) {
        clearInterval(timer);
        timer = null;
      }
    };
  },
  getSnapshot() {
    if (!state) warmUp();
    return state;
  },
  isPaused: () => paused,
  /** Apply a change (from an action) and notify immediately. `fn` gets a shallow copy. */
  mutate(fn) {
    if (!state) warmUp();
    const next = { ...state };
    fn(next);
    state = next;
    for (const l of listeners) l();
  },
  setPaused(v) {
    paused = v;
    for (const l of listeners) l();
  },
};
