// Every action the dashboard can take, as data. Each entry says what it does,
// which target it applies to, which inputs it needs and — most importantly —
// the exact request it turns into: a Proxmox API call, a service API call, a
// shell command on the host (`pct exec` for LXCs) or a link to open.
//
// The frontend only ever sends `{ action, target, params }` to the backend.
// The backend looks the action up in this same file, builds the request with
// `request()` and executes it with its own tokens, so no secret reaches the
// browser. `effect()` is only used by the mock executor to make the simulated
// state react.

import { DISKS, DOMAIN, EXTERNAL, HOST, LXCS, STORAGE } from './inventory';
import { event, newMediaJob, newScanJob } from './simulator';

const NODE = HOST.name;

// ---- Request builders ----
const pve = (method, path, body) => ({ via: 'proxmox', method, url: `/api2/json${path}`, body });
const api = (service, method, path, body) => ({ via: 'api', service, method, url: path, body });
const host = cmd => ({ via: 'shell', target: 'host', cmd });
const inLxc = (lxc, cmd) => ({ via: 'shell', target: `lxc:${lxc.id}`, cmd: `pct exec ${lxc.id} -- ${cmd}` });
const link = url => ({ via: 'link', url });

const today = () => new Date().toISOString().slice(0, 10).replaceAll('-', '');
const svcUrl = e => (e.svc.public ? `https://${e.svc.public}` : `http://${e.lxc.ip}:${e.svc.port}`);
const lanUrl = (e, path = '') => `http://${e.lxc.ip}:${e.svc.port}${path}`;
const container = svc => svc.container ?? svc.name;
const compose = (lxc, args) => inLxc(lxc, `docker compose -f ${lxc.compose} ${args}`);

// ---- Target resolution ----

/** Turn `{ type, id }` into everything an action needs to know about it. */
export function resolve(target, state) {
  if (!target) return null;
  const { type, id } = target;
  if (type === 'host') return { type, id: NODE, title: `Host ${NODE}`, sub: HOST.os };
  if (type === 'lxc') {
    const lxc = LXCS.find(c => c.id === Number(id));
    return lxc && { type, id: lxc.id, lxc, live: state.lxc[lxc.id], title: `LXC ${lxc.id} · ${lxc.name}`, sub: lxc.role };
  }
  if (type === 'svc') {
    const lxc = LXCS.find(c => c.services.some(s => s.id === id));
    const svc = lxc?.services.find(s => s.id === id);
    return svc && { type, id, svc, lxc, live: state.services[id], title: svc.name, sub: `LXC ${lxc.id} · ${lxc.name}` };
  }
  if (type === 'stream') {
    const st = state.streams.find(s => s.id === id);
    return st && { type, id, stream: st, title: st.title, sub: `${st.user} · ${st.device}` };
  }
  if (type === 'scanJob') {
    const job = state.scanJobs.find(j => j.id === id);
    return job && { type, id, job, title: `Scan ${job.name}`, sub: `${job.pages} pages` };
  }
  if (type === 'mediaJob') {
    const job = state.mediaJobs.find(j => j.id === id);
    return job && { type, id, job, title: job.title, sub: `${job.type === 'movie' ? 'Radarr' : 'Sonarr'} · requested by ${job.by}` };
  }
  if (type === 'disk') {
    const disk = DISKS.find(d => d.id === id);
    return disk && { type, id, disk, title: `/dev/${disk.id}`, sub: disk.model };
  }
  if (type === 'pool') {
    const pool = STORAGE.find(p => p.id === id);
    return pool && { type, id, pool, title: `Pool ${pool.id}`, sub: pool.layout };
  }
  if (type === 'dataset') {
    const pool = STORAGE.find(p => p.datasets.some(d => d.id === id));
    const ds = pool?.datasets.find(d => d.id === id);
    return ds && { type, id, ds, pool, title: id, sub: ds.label };
  }
  if (type === 'ext') {
    const ext = EXTERNAL.find(x => x.id === id);
    return ext && { type, id, ext, title: ext.label, sub: ext.sub };
  }
  return null;
}

/** Map ids (as used by the topology) → action targets. */
export function targetFromMapId(id) {
  if (!id) return null;
  if (id.startsWith('lxc')) return { type: 'lxc', id: Number(id.slice(3)) };
  if (LXCS.some(c => c.services.some(s => s.id === id))) return { type: 'svc', id };
  if (EXTERNAL.some(x => x.id === id)) return { type: 'ext', id };
  if (STORAGE.some(p => p.datasets.some(d => d.id === id))) return { type: 'dataset', id };
  return null;
}

// ---- Mock state helpers (used by effect) ----

const setSvc = (s, id, patch) => {
  s.services = { ...s.services, [id]: { ...s.services[id], ...patch } };
};
const restartSvc = (s, id, secs = 4) => setSvc(s, id, { status: 'restarting', until: s.t + secs * 1000, next: 'running' });
const setLxc = (s, id, patch) => {
  s.lxc = { ...s.lxc, [id]: { ...s.lxc[id], ...patch } };
};

// ---- The catalog ----

const SERVICE_STATES = { running: 1, degraded: 1, restarting: 1, starting: 1 };
const isUp = e => SERVICE_STATES[e.live?.status];

const HOST_ACTIONS = [
  { id: 'host.web', label: 'Open Proxmox web UI', group: 'Open', icon: 'open', primary: true, request: () => link(HOST.web) },
  { id: 'host.shell', label: 'Host shell', group: 'Open', icon: 'terminal', primary: true, view: 'terminal', request: () => host('bash -l') },
  { id: 'host.tasks', label: 'Recent Proxmox tasks', group: 'Inspect', icon: 'list', view: 'output', request: () => pve('GET', `/nodes/${NODE}/tasks?limit=20`) },
  { id: 'host.syslog', label: 'System log', group: 'Inspect', icon: 'logs', view: 'logs', request: () => host('journalctl -f -n 200') },
  { id: 'host.apt-update', label: 'Refresh package lists', group: 'Maintain', icon: 'refresh', request: () => pve('POST', `/nodes/${NODE}/apt/update`) },
  { id: 'host.apt-upgrade', label: 'Upgrade packages', group: 'Maintain', icon: 'download', danger: 1, request: () => host('apt-get update && apt-get dist-upgrade -y') },
  {
    id: 'host.backup-all',
    label: 'Back up all LXCs now',
    group: 'Maintain',
    icon: 'archive',
    fields: [
      { name: 'storage', label: 'Storage', type: 'select', options: ['backup', 'local'], default: 'backup' },
      { name: 'mode', label: 'Mode', type: 'select', options: ['snapshot', 'suspend', 'stop'], default: 'snapshot' },
    ],
    request: (e, p) => pve('POST', `/nodes/${NODE}/vzdump`, { all: 1, storage: p.storage, mode: p.mode, compress: 'zstd' }),
  },
  { id: 'host.zfs-arc', label: 'Limit ZFS ARC size', group: 'Configure', icon: 'sliders', danger: 1, fields: [{ name: 'gib', label: 'Max ARC (GiB)', type: 'range', min: 4, max: 48, step: 1, default: 24 }], request: (e, p) => host(`echo ${p.gib * 1024 ** 3} > /sys/module/zfs/parameters/zfs_arc_max`) },
  { id: 'host.reboot', label: 'Reboot host', group: 'Power', icon: 'restart', danger: 2, confirm: 'Every LXC and service goes down for a few minutes.', request: () => pve('POST', `/nodes/${NODE}/status`, { command: 'reboot' }) },
  { id: 'host.shutdown', label: 'Shut down host', group: 'Power', icon: 'power', danger: 2, confirm: 'The server stays off until someone presses the power button or sends Wake-on-LAN.', request: () => pve('POST', `/nodes/${NODE}/status`, { command: 'shutdown' }) },
];

const lxcPath = (e, rest) => `/nodes/${NODE}/lxc/${e.lxc.id}${rest}`;
const lxcDown = e => e.live.status === 'stopped';

const LXC_ACTIONS = [
  { id: 'lxc.console', label: 'Console (Proxmox)', group: 'Open', icon: 'open', request: e => link(`${HOST.web}/?console=lxc&xtermjs=1&vmid=${e.lxc.id}&node=${NODE}`) },
  { id: 'lxc.shell', label: 'Shell', group: 'Open', icon: 'terminal', primary: true, when: e => !lxcDown(e), view: 'terminal', request: e => host(`pct enter ${e.lxc.id}`) },
  {
    id: 'lxc.start',
    label: 'Start',
    group: 'Power',
    icon: 'play',
    primary: true,
    when: lxcDown,
    request: e => pve('POST', lxcPath(e, '/status/start')),
    effect: (s, e) => {
      setLxc(s, e.lxc.id, { status: 'running' });
      e.lxc.services.forEach(sv => s.services[sv.id].byLxc && setSvc(s, sv.id, { status: 'starting', until: s.t + 5000, next: 'running', byLxc: false }));
    },
  },
  {
    id: 'lxc.reboot',
    label: 'Reboot',
    group: 'Power',
    icon: 'restart',
    primary: true,
    danger: 1,
    when: e => !lxcDown(e),
    confirm: e => `Stops ${e.lxc.services.length} services for ~10 seconds.`,
    request: e => pve('POST', lxcPath(e, '/status/reboot')),
    effect: (s, e) => e.lxc.services.forEach(sv => s.services[sv.id].status !== 'stopped' && restartSvc(s, sv.id, 8)),
  },
  {
    id: 'lxc.shutdown',
    label: 'Shut down',
    group: 'Power',
    icon: 'power',
    danger: 1,
    when: e => !lxcDown(e),
    request: e => pve('POST', lxcPath(e, '/status/shutdown'), { timeout: 60 }),
    effect: (s, e) => {
      setLxc(s, e.lxc.id, { status: 'stopped' });
      e.lxc.services.forEach(sv => s.services[sv.id].status !== 'stopped' && setSvc(s, sv.id, { status: 'stopped', byLxc: true }));
    },
  },
  {
    id: 'lxc.stop',
    label: 'Force stop',
    group: 'Power',
    icon: 'stop',
    danger: 2,
    when: e => !lxcDown(e),
    confirm: 'Kills the container without a clean shutdown.',
    request: e => pve('POST', lxcPath(e, '/status/stop')),
    effect: (s, e) => {
      setLxc(s, e.lxc.id, { status: 'stopped' });
      e.lxc.services.forEach(sv => s.services[sv.id].status !== 'stopped' && setSvc(s, sv.id, { status: 'stopped', byLxc: true }));
    },
  },
  {
    id: 'lxc.snapshot',
    label: 'Take snapshot',
    group: 'Backup',
    icon: 'camera',
    fields: [
      { name: 'snapname', label: 'Name', type: 'text', default: () => `manual-${today()}`, pattern: '^[A-Za-z][A-Za-z0-9_-]*$' },
      { name: 'description', label: 'Note', type: 'text', default: '' },
    ],
    request: (e, p) => pve('POST', lxcPath(e, '/snapshot'), { snapname: p.snapname, description: p.description }),
  },
  { id: 'lxc.snapshots', label: 'List snapshots', group: 'Backup', icon: 'list', view: 'output', request: e => pve('GET', lxcPath(e, '/snapshot')) },
  {
    id: 'lxc.rollback',
    label: 'Roll back to snapshot',
    group: 'Backup',
    icon: 'undo',
    danger: 2,
    fields: e => [{ name: 'snap', label: 'Snapshot', type: 'select', options: [`pre-update-${today()}`, 'weekly-20261006', 'weekly-20260929'], default: `pre-update-${today()}` }],
    confirm: 'Everything written since that snapshot is lost.',
    request: (e, p) => pve('POST', lxcPath(e, `/snapshot/${p.snap}/rollback`), { start: 1 }),
  },
  {
    id: 'lxc.backup',
    label: 'Back up now',
    group: 'Backup',
    icon: 'archive',
    fields: [
      { name: 'storage', label: 'Storage', type: 'select', options: ['backup', 'local'], default: 'backup' },
      { name: 'mode', label: 'Mode', type: 'select', options: ['snapshot', 'suspend', 'stop'], default: 'snapshot' },
      { name: 'notes', label: 'Notes', type: 'text', default: 'manual from dashboard' },
    ],
    request: (e, p) => pve('POST', `/nodes/${NODE}/vzdump`, { vmid: e.lxc.id, storage: p.storage, mode: p.mode, compress: 'zstd', 'notes-template': p.notes }),
  },
  {
    id: 'lxc.resources',
    label: 'Change CPU / RAM',
    group: 'Configure',
    icon: 'sliders',
    danger: 1,
    fields: e => [
      { name: 'cores', label: 'Cores', type: 'range', min: 1, max: HOST.cpu.threads, step: 1, default: e.lxc.cores },
      { name: 'memory', label: 'Memory (MiB)', type: 'range', min: 256, max: 32768, step: 256, default: e.lxc.ram },
      { name: 'swap', label: 'Swap (MiB)', type: 'range', min: 0, max: 8192, step: 256, default: 512 },
    ],
    request: (e, p) => pve('PUT', lxcPath(e, '/config'), { cores: p.cores, memory: p.memory, swap: p.swap }),
  },
  {
    id: 'lxc.resize',
    label: 'Grow root disk',
    group: 'Configure',
    icon: 'disk',
    danger: 1,
    fields: e => [{ name: 'size', label: 'Add (GB)', type: 'range', min: 1, max: 64, step: 1, default: 4 }],
    confirm: 'Disks can only grow, never shrink.',
    request: (e, p) => pve('PUT', lxcPath(e, '/resize'), { disk: 'rootfs', size: `+${p.size}G` }),
  },
  { id: 'lxc.onboot', label: 'Start on boot', group: 'Configure', icon: 'toggle', fields: [{ name: 'onboot', label: 'Start when the host boots', type: 'toggle', default: true }], request: (e, p) => pve('PUT', lxcPath(e, '/config'), { onboot: p.onboot ? 1 : 0 }) },
  { id: 'lxc.config', label: 'Edit LXC config', group: 'Configure', icon: 'edit', danger: 1, view: 'editor', file: e => ({ path: `/etc/pve/lxc/${e.lxc.id}.conf`, content: lxcConf(e.lxc) }), request: (e, p) => host(`cat > /etc/pve/lxc/${e.lxc.id}.conf <<'EOF'\n${p.content}\nEOF`) },
  { id: 'lxc.compose', label: 'Edit compose.yml', group: 'Docker', icon: 'edit', when: e => e.lxc.compose, view: 'editor', file: e => ({ path: e.lxc.compose, content: composeFile(e.lxc), validate: `docker compose -f ${e.lxc.compose} config -q` }), request: (e, p) => [inLxc(e.lxc, `tee ${e.lxc.compose} <<'EOF'\n${p.content}\nEOF`), compose(e.lxc, 'up -d --remove-orphans')] },
  { id: 'lxc.ps', label: 'docker ps', group: 'Docker', icon: 'list', when: e => e.lxc.compose && !lxcDown(e), view: 'output', request: e => compose(e.lxc, 'ps') },
  {
    id: 'lxc.pull',
    label: 'Update all containers',
    group: 'Docker',
    icon: 'download',
    danger: 1,
    when: e => e.lxc.compose && !lxcDown(e),
    confirm: 'Pulls new images and recreates every container in this stack.',
    request: e => compose(e.lxc, 'pull && docker compose -f ' + e.lxc.compose + ' up -d'),
    effect: (s, e) => e.lxc.services.filter(sv => sv.kind === 'docker').forEach(sv => restartSvc(s, sv.id, 6)),
  },
  { id: 'lxc.prune', label: 'Prune unused images', group: 'Docker', icon: 'trash', when: e => e.lxc.compose && !lxcDown(e), request: e => inLxc(e.lxc, 'docker image prune -af') },
  { id: 'lxc.apt', label: 'Upgrade packages', group: 'Maintain', icon: 'download', danger: 1, when: e => !lxcDown(e), request: e => inLxc(e.lxc, "bash -c 'apt-get update && apt-get -y dist-upgrade'") },
];

// Generic per-service actions, by kind.
const SVC_ACTIONS = [
  { id: 'svc.open', label: 'Open app', group: 'Open', icon: 'open', primary: true, when: e => e.svc.port && e.svc.kind !== 'systemd', request: e => link(svcUrl(e)) },
  {
    id: 'svc.logs',
    label: 'Live logs',
    group: 'Inspect',
    icon: 'logs',
    primary: true,
    view: 'logs',
    request: e => (e.svc.kind === 'docker' ? inLxc(e.lxc, `docker logs -f --tail 200 ${container(e.svc)}`) : inLxc(e.lxc, `journalctl -fu ${e.svc.unit} -n 200`)),
  },
  {
    id: 'svc.restart',
    label: 'Restart',
    group: 'Control',
    icon: 'restart',
    primary: true,
    when: isUp,
    request: e => (e.svc.kind === 'docker' ? inLxc(e.lxc, `docker restart ${container(e.svc)}`) : inLxc(e.lxc, `systemctl restart ${e.svc.unit}`)),
    effect: (s, e) => restartSvc(s, e.id),
  },
  {
    id: 'svc.start',
    label: 'Start',
    group: 'Control',
    icon: 'play',
    primary: true,
    when: e => e.live.status === 'stopped' && e.lxc && e.live && !e.live.byLxc,
    request: e => (e.svc.kind === 'docker' ? inLxc(e.lxc, `docker start ${container(e.svc)}`) : inLxc(e.lxc, `systemctl start ${e.svc.unit}`)),
    effect: (s, e) => setSvc(s, e.id, { status: 'starting', until: s.t + 3000, next: 'running' }),
  },
  {
    id: 'svc.stop',
    label: 'Stop',
    group: 'Control',
    icon: 'stop',
    danger: 1,
    when: isUp,
    request: e => (e.svc.kind === 'docker' ? inLxc(e.lxc, `docker stop ${container(e.svc)}`) : inLxc(e.lxc, `systemctl stop ${e.svc.unit}`)),
    effect: (s, e) => setSvc(s, e.id, { status: 'stopped', byLxc: false }),
  },
  { id: 'svc.reload', label: 'Reload config', group: 'Control', icon: 'refresh', when: e => e.svc.kind === 'native', request: e => inLxc(e.lxc, `systemctl reload ${e.svc.unit}`) },
  { id: 'svc.status', label: 'Service status', group: 'Inspect', icon: 'info', when: e => e.svc.kind !== 'docker', view: 'output', request: e => inLxc(e.lxc, `systemctl status ${e.svc.unit} --no-pager`) },
  { id: 'svc.inspect', label: 'Inspect container', group: 'Inspect', icon: 'info', when: e => e.svc.kind === 'docker', view: 'output', request: e => inLxc(e.lxc, `docker inspect --format '{{json .State}}' ${container(e.svc)}`) },
  { id: 'svc.exec', label: 'Shell in container', group: 'Inspect', icon: 'terminal', when: e => e.svc.kind === 'docker' && isUp(e), view: 'terminal', request: e => inLxc(e.lxc, `docker exec -it ${container(e.svc)} sh`) },
  {
    id: 'svc.update',
    label: 'Pull image & recreate',
    group: 'Maintain',
    icon: 'download',
    danger: 1,
    when: e => e.svc.kind === 'docker',
    request: e => compose(e.lxc, `pull ${container(e.svc)} && docker compose -f ${e.lxc.compose} up -d ${container(e.svc)}`),
    effect: (s, e) => restartSvc(s, e.id, 7),
  },
  { id: 'svc.unit', label: 'Edit unit file', group: 'Configure', icon: 'edit', danger: 1, when: e => e.svc.kind !== 'docker', view: 'editor', file: e => ({ path: `/etc/systemd/system/${e.svc.unit}.service`, content: unitFile(e.svc) }), request: (e, p) => [inLxc(e.lxc, `tee /etc/systemd/system/${e.svc.unit}.service <<'EOF'\n${p.content}\nEOF`), inLxc(e.lxc, `systemctl daemon-reload && systemctl restart ${e.svc.unit}`)] },
  { id: 'svc.enable', label: 'Start on boot', group: 'Configure', icon: 'toggle', when: e => e.svc.kind !== 'docker', fields: [{ name: 'on', label: 'Enabled', type: 'toggle', default: true }], request: (e, p) => inLxc(e.lxc, `systemctl ${p.on ? 'enable' : 'disable'} ${e.svc.unit}`) },
];

const JELLYFIN_TASKS = ['Scan Media Library', 'Extract Chapter Images', 'Generate Trickplay Images', 'Clean Transcode Directory', 'Refresh People', 'Optimize database'];
const IMMICH_JOBS = { thumbnailGeneration: 'thumbnails', metadataExtraction: 'metadata', faceDetection: 'faces', smartSearch: 'smartSearch' };

// Service-specific actions, keyed by service id.
const APP_ACTIONS = {
  jellyfin: [
    { id: 'jellyfin.dashboard', label: 'Admin dashboard', group: 'Open', icon: 'open', request: e => link(`${svcUrl(e)}/web/#/dashboard`) },
    { id: 'jellyfin.scan', label: 'Scan all libraries', group: 'App', icon: 'refresh', primary: true, when: isUp, request: () => api('jellyfin', 'POST', '/Library/Refresh'), effect: s => event(s, 'jellyfin', 'library scan started') },
    { id: 'jellyfin.task', label: 'Run scheduled task…', group: 'App', icon: 'play', when: isUp, fields: [{ name: 'task', label: 'Task', type: 'select', options: JELLYFIN_TASKS, default: JELLYFIN_TASKS[0] }], request: (e, p) => api('jellyfin', 'POST', `/ScheduledTasks/Running/{taskId:${p.task}}`) },
    {
      id: 'jellyfin.message',
      label: 'Message everyone watching',
      group: 'App',
      icon: 'message',
      when: isUp,
      fields: [
        { name: 'header', label: 'Title', type: 'text', default: 'Server' },
        { name: 'text', label: 'Message', type: 'textarea', default: 'Kurzer Neustart in 5 Minuten.' },
      ],
      request: (e, p) => api('jellyfin', 'POST', '/Sessions/{each}/Message', { Header: p.header, Text: p.text, TimeoutMs: 10000 }),
    },
    { id: 'jellyfin.users', label: 'Manage users', group: 'Open', icon: 'open', request: e => link(`${svcUrl(e)}/web/#/dashboard/users`) },
    { id: 'jellyfin.transcodes', label: 'Clear transcode cache', group: 'Maintain', icon: 'trash', request: e => inLxc(e.lxc, 'docker exec jellyfin sh -c "rm -rf /cache/transcodes/*"') },
  ],
  seerr: [
    { id: 'seerr.request', label: 'Request a movie or show…', group: 'App', icon: 'plus', primary: true, view: 'request', request: (e, p) => api('seerr', 'POST', '/api/v1/request', p?.media ? { mediaType: p.media.type === 'movie' ? 'movie' : 'tv', mediaId: p.media.tmdb, seasons: p.seasons } : undefined) },
    { id: 'seerr.requests', label: 'Open requests', group: 'Open', icon: 'open', request: e => link(`${svcUrl(e)}/requests`) },
    { id: 'seerr.sync', label: 'Sync Jellyfin library', group: 'App', icon: 'refresh', when: isUp, request: () => api('seerr', 'POST', '/api/v1/settings/jobs/jellyfin-full-scan/run') },
  ],
  radarr: [
    { id: 'radarr.missing', label: 'Search all missing movies', group: 'App', icon: 'search', primary: true, when: isUp, request: () => api('radarr', 'POST', '/api/v3/command', { name: 'MissingMoviesSearch' }) },
    { id: 'radarr.rss', label: 'RSS sync', group: 'App', icon: 'refresh', when: isUp, request: () => api('radarr', 'POST', '/api/v3/command', { name: 'RssSync' }) },
    { id: 'radarr.refresh', label: 'Refresh all movies', group: 'App', icon: 'refresh', when: isUp, request: () => api('radarr', 'POST', '/api/v3/command', { name: 'RefreshMovie' }) },
    { id: 'radarr.queue', label: 'Open queue', group: 'Open', icon: 'open', request: e => link(`${lanUrl(e)}/activity/queue`) },
  ],
  sonarr: [
    { id: 'sonarr.missing', label: 'Search all missing episodes', group: 'App', icon: 'search', primary: true, when: isUp, request: () => api('sonarr', 'POST', '/api/v3/command', { name: 'MissingEpisodeSearch' }) },
    { id: 'sonarr.rss', label: 'RSS sync', group: 'App', icon: 'refresh', when: isUp, request: () => api('sonarr', 'POST', '/api/v3/command', { name: 'RssSync' }) },
    { id: 'sonarr.refresh', label: 'Refresh all series', group: 'App', icon: 'refresh', when: isUp, request: () => api('sonarr', 'POST', '/api/v3/command', { name: 'RefreshSeries' }) },
    { id: 'sonarr.calendar', label: 'Open calendar', group: 'Open', icon: 'open', request: e => link(`${lanUrl(e)}/calendar`) },
  ],
  prowlarr: [
    { id: 'prowlarr.test', label: 'Test all indexers', group: 'App', icon: 'check', primary: true, when: isUp, view: 'output', request: () => api('prowlarr', 'POST', '/api/v1/indexer/testall') },
    { id: 'prowlarr.sync', label: 'Sync indexers to apps', group: 'App', icon: 'refresh', when: isUp, request: () => api('prowlarr', 'POST', '/api/v1/command', { name: 'ApplicationIndexerSync' }) },
  ],
  qbit: [
    { id: 'qbit.pause', label: 'Pause all torrents', group: 'App', icon: 'pause', primary: true, when: (e, s) => isUp(e) && !s.qbit.paused, request: () => api('qbittorrent', 'POST', '/api/v2/torrents/stop', 'hashes=all'), effect: s => (s.qbit = { ...s.qbit, paused: true }) },
    { id: 'qbit.resume', label: 'Resume all torrents', group: 'App', icon: 'play', primary: true, when: (e, s) => isUp(e) && s.qbit.paused, request: () => api('qbittorrent', 'POST', '/api/v2/torrents/start', 'hashes=all'), effect: s => (s.qbit = { ...s.qbit, paused: false }) },
    { id: 'qbit.alt', label: 'Toggle alternative speed limits', group: 'App', icon: 'gauge', when: isUp, request: () => api('qbittorrent', 'POST', '/api/v2/transfer/toggleSpeedLimitsMode'), effect: s => (s.qbit = { ...s.qbit, altSpeed: !s.qbit.altSpeed }) },
    {
      id: 'qbit.limit',
      label: 'Set download limit',
      group: 'App',
      icon: 'sliders',
      when: isUp,
      fields: (e, s) => [{ name: 'mbs', label: 'Limit (MB/s, 0 = unlimited)', type: 'range', min: 0, max: 120, step: 5, default: s.qbit.limit }],
      request: (e, p) => api('qbittorrent', 'POST', '/api/v2/transfer/setDownloadLimit', `limit=${p.mbs * 1024 * 1024}`),
      effect: (s, e, p) => (s.qbit = { ...s.qbit, limit: p.mbs }),
    },
    { id: 'qbit.vpn', label: 'Check VPN exit IP', group: 'Inspect', icon: 'shield', view: 'output', request: e => inLxc(e.lxc, 'docker exec gluetun wget -qO- https://ipinfo.io/json') },
  ],
  bazarr: [
    { id: 'bazarr.missing', label: 'Search missing subtitles', group: 'App', icon: 'search', primary: true, when: isUp, request: () => api('bazarr', 'POST', '/api/system/tasks', { taskid: 'wanted_search_missing_subtitles_movies' }) },
    { id: 'bazarr.providers', label: 'Reset provider throttling', group: 'App', icon: 'refresh', when: isUp, request: () => api('bazarr', 'POST', '/api/providers', { action: 'reset' }), effect: (s, e) => setSvc(s, e.id, { status: 'running' }) },
  ],
  'immich-server': [
    {
      id: 'immich.job',
      label: 'Run job…',
      group: 'App',
      icon: 'play',
      primary: true,
      when: isUp,
      fields: [
        { name: 'job', label: 'Job', type: 'select', options: Object.keys(IMMICH_JOBS), default: 'faceDetection' },
        { name: 'force', label: 'Re-run on all assets (not just missing)', type: 'toggle', default: false },
      ],
      request: (e, p) => api('immich', 'PUT', `/api/jobs/${p.job}`, { command: 'start', force: p.force }),
      effect: (s, e, p) => {
        const key = IMMICH_JOBS[p.job];
        s.immich = { ...s.immich, queue: { ...s.immich.queue, [key]: s.immich.queue[key] + (p.force ? 400 : 25) } };
      },
    },
    {
      id: 'immich.pause',
      label: 'Pause all jobs',
      group: 'App',
      icon: 'pause',
      when: (e, s) => isUp(e) && !s.immich.paused?.all,
      request: () => Object.keys(IMMICH_JOBS).map(j => api('immich', 'PUT', `/api/jobs/${j}`, { command: 'pause' })),
      effect: s => (s.immich = { ...s.immich, paused: { all: true, thumbnails: true, metadata: true, faces: true, smartSearch: true } }),
    },
    { id: 'immich.resume', label: 'Resume all jobs', group: 'App', icon: 'play', when: (e, s) => s.immich.paused?.all, request: () => Object.keys(IMMICH_JOBS).map(j => api('immich', 'PUT', `/api/jobs/${j}`, { command: 'resume' })), effect: s => (s.immich = { ...s.immich, paused: {} }) },
    { id: 'immich.jobs', label: 'Open job queues', group: 'Open', icon: 'open', request: e => link(`${lanUrl(e)}/admin/jobs-status`) },
    { id: 'immich.scan', label: 'Scan external libraries', group: 'App', icon: 'refresh', when: isUp, request: () => api('immich', 'POST', '/api/libraries/{each}/scan') },
  ],
  'immich-db': [{ id: 'immich.dump', label: 'Dump database now', group: 'Backup', icon: 'archive', request: e => inLxc(e.lxc, `sh -c 'docker exec -t immich_postgres pg_dumpall --clean --if-exists -U postgres | gzip > /backup/immich-db-$(date +%F).sql.gz'`) }],
  paperless: [
    { id: 'paperless.inbox', label: 'Open inbox', group: 'Open', icon: 'open', primary: true, request: e => link(`${lanUrl(e)}/documents?is_in_inbox=1`) },
    { id: 'paperless.upload', label: 'Upload document…', group: 'App', icon: 'upload', when: isUp, fields: [{ name: 'file', label: 'File (PDF, image, office)', type: 'file' }, { name: 'title', label: 'Title (optional)', type: 'text', default: '' }], request: (e, p) => api('paperless', 'POST', '/api/documents/post_document/', { document: p.file?.name ?? '<file>', title: p.title || undefined }), effect: (s, e, p) => (s.scanJobs = [...s.scanJobs, { ...newScanJob(s.t), name: p.title || p.file?.name?.replace(/\.\w+$/, '') || 'Upload', stage: 4, progress: 0 }]) },
    { id: 'paperless.tasks', label: 'Consumption tasks', group: 'Inspect', icon: 'list', view: 'output', request: () => api('paperless', 'GET', '/api/tasks/?acknowledged=false') },
    { id: 'paperless.reindex', label: 'Rebuild search index', group: 'Maintain', icon: 'refresh', request: e => compose(e.lxc, 'exec webserver document_index reindex') },
    { id: 'paperless.classifier', label: 'Retrain classifier', group: 'Maintain', icon: 'spark', request: e => compose(e.lxc, 'exec webserver document_create_classifier') },
    { id: 'paperless.sanity', label: 'Run sanity checker', group: 'Maintain', icon: 'check', view: 'output', request: e => compose(e.lxc, 'exec webserver document_sanity_checker') },
    { id: 'paperless.export', label: 'Export everything', group: 'Backup', icon: 'archive', request: e => compose(e.lxc, 'exec webserver document_exporter ../export --zip') },
  ],
  'scan-watcher': [
    { id: 'scan.test', label: 'Feed a test scan', group: 'App', icon: 'play', primary: true, request: e => inLxc(e.lxc, 'cp /opt/scan-watcher/test-page.jpg /scans/inbox/test_$(date +%s).jpg'), effect: s => (s.scanJobs = [...s.scanJobs, { ...newScanJob(s.t), name: 'Testseite', stage: 1, progress: 0 }]) },
    { id: 'scan.script', label: 'Edit watcher script', group: 'Configure', icon: 'edit', danger: 1, view: 'editor', file: () => ({ path: '/usr/local/bin/scan-watcher.sh', content: WATCHER_SCRIPT, validate: 'bash -n /usr/local/bin/scan-watcher.sh' }), request: (e, p) => [inLxc(e.lxc, `tee /usr/local/bin/scan-watcher.sh <<'EOF'\n${p.content}\nEOF`), inLxc(e.lxc, 'systemctl restart scan-watcher')] },
    { id: 'scan.failed', label: 'Retry failed scans', group: 'App', icon: 'undo', request: e => inLxc(e.lxc, "sh -c 'mv /scans/failed/* /scans/inbox/ 2>/dev/null; echo moved'") },
  ],
  'smb-inbox': [
    { id: 'smb.ls', label: 'List inbox', group: 'Inspect', icon: 'list', view: 'output', request: e => inLxc(e.lxc, 'ls -lh /scans/inbox /scans/failed') },
    { id: 'smb.clear', label: 'Empty failed folder', group: 'Maintain', icon: 'trash', danger: 1, request: e => inLxc(e.lxc, 'sh -c "rm -f /scans/failed/*"') },
  ],
  caddy: [
    { id: 'caddy.edit', label: 'Edit Caddyfile', group: 'Configure', icon: 'edit', primary: true, danger: 1, view: 'editor', file: () => ({ path: '/etc/caddy/Caddyfile', content: CADDYFILE, validate: 'caddy validate --config /etc/caddy/Caddyfile' }), request: (e, p) => [inLxc(e.lxc, `tee /etc/caddy/Caddyfile <<'EOF'\n${p.content}\nEOF`), inLxc(e.lxc, 'systemctl reload caddy')] },
    { id: 'caddy.certs', label: 'Show certificates', group: 'Inspect', icon: 'shield', view: 'output', request: e => inLxc(e.lxc, 'ls -l /var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory') },
    { id: 'caddy.config', label: 'Running config (JSON)', group: 'Inspect', icon: 'info', view: 'output', request: e => inLxc(e.lxc, 'curl -s localhost:2019/config/') },
  ],
  ddclient: [
    { id: 'ddns.force', label: 'Force IP update', group: 'App', icon: 'refresh', primary: true, request: e => inLxc(e.lxc, 'systemctl restart ddns-updater'), effect: s => event(s, 'ddns-updater', `${DOMAIN} → 84.1xx.xx.17 (forced)`) },
    { id: 'ddns.check', label: 'Check DNS record', group: 'Inspect', icon: 'search', view: 'output', request: () => host(`dig +short ${DOMAIN} @1.1.1.1`) },
  ],
};

const STREAM_ACTIONS = [
  { id: 'stream.pause', label: 'Pause', group: 'Playback', icon: 'pause', when: e => !e.stream.paused, request: e => api('jellyfin', 'POST', `/Sessions/${e.id}/Playing/Pause`), effect: (s, e) => (s.streams = s.streams.map(x => (x.id === e.id ? { ...x, paused: true } : x))) },
  { id: 'stream.resume', label: 'Resume', group: 'Playback', icon: 'play', when: e => e.stream.paused, request: e => api('jellyfin', 'POST', `/Sessions/${e.id}/Playing/Unpause`), effect: (s, e) => (s.streams = s.streams.map(x => (x.id === e.id ? { ...x, paused: false } : x))) },
  { id: 'stream.message', label: 'Send message', group: 'Playback', icon: 'message', fields: [{ name: 'text', label: 'Message', type: 'textarea', default: '' }], request: (e, p) => api('jellyfin', 'POST', `/Sessions/${e.id}/Message`, { Header: 'Server', Text: p.text, TimeoutMs: 8000 }) },
  { id: 'stream.stop', label: 'Stop playback', group: 'Playback', icon: 'stop', danger: 1, request: e => api('jellyfin', 'POST', `/Sessions/${e.id}/Playing/Stop`), effect: (s, e) => (s.streams = s.streams.filter(x => x.id !== e.id)) },
];

const SCAN_JOB_ACTIONS = [
  { id: 'scanjob.open', label: 'Open in Paperless', group: 'Open', icon: 'open', when: e => e.job.stage === 5, request: () => link(`http://192.168.178.23:8000/documents?query=added:today`) },
  { id: 'scanjob.retry', label: 'Retry from inbox', group: 'Job', icon: 'undo', when: e => e.job.stage > 1 && e.job.stage < 5, request: e => inLxc(LXCS.find(c => c.id === 103), `mv /scans/work/${e.id}* /scans/inbox/`), effect: (s, e) => (s.scanJobs = s.scanJobs.map(j => (j.id === e.id ? { ...j, stage: 1, progress: 0 } : j))) },
  { id: 'scanjob.cancel', label: 'Cancel', group: 'Job', icon: 'stop', danger: 1, when: e => e.job.stage < 5, request: e => inLxc(LXCS.find(c => c.id === 103), `mv /scans/work/${e.id}* /scans/failed/`), effect: (s, e) => (s.scanJobs = s.scanJobs.filter(j => j.id !== e.id)) },
];

const MEDIA_JOB_ACTIONS = [
  { id: 'mediajob.play', label: 'Play in Jellyfin', group: 'Open', icon: 'open', when: e => e.job.stage === 4, request: e => link(`https://jellyfin.${DOMAIN}/web/#/search.html?query=${encodeURIComponent(e.job.title)}`) },
  { id: 'mediajob.top', label: 'Download first', group: 'Job', icon: 'up', when: e => e.job.stage === 2, request: () => api('qbittorrent', 'POST', '/api/v2/torrents/topPrio', 'hashes=<hash>'), effect: (s, e) => (s.mediaJobs = s.mediaJobs.map(j => (j.id === e.id ? { ...j, cap: 0.45 } : j))) },
  { id: 'mediajob.search', label: 'Search again', group: 'Job', icon: 'search', when: e => e.job.stage <= 2, request: e => api(e.job.type === 'movie' ? 'radarr' : 'sonarr', 'POST', '/api/v3/command', { name: e.job.type === 'movie' ? 'MoviesSearch' : 'SeriesSearch' }), effect: (s, e) => (s.mediaJobs = s.mediaJobs.map(j => (j.id === e.id ? { ...j, stage: 1, progress: 0 } : j))) },
  { id: 'mediajob.cancel', label: 'Cancel request', group: 'Job', icon: 'stop', danger: 1, when: e => e.job.stage < 4, request: e => [api('seerr', 'DELETE', '/api/v1/request/{id}'), api(e.job.type === 'movie' ? 'radarr' : 'sonarr', 'DELETE', '/api/v3/queue/{id}?removeFromClient=true&blocklist=false')], effect: (s, e) => (s.mediaJobs = s.mediaJobs.filter(j => j.id !== e.id)) },
];

const DISK_ACTIONS = [
  { id: 'disk.report', label: 'Full SMART report', group: 'Inspect', icon: 'info', primary: true, view: 'output', request: e => pve('GET', `/nodes/${NODE}/disks/smart?disk=/dev/${e.id}`) },
  { id: 'disk.short', label: 'Run short self-test (~2 min)', group: 'Test', icon: 'play', request: e => host(`smartctl -t short /dev/${e.id}`), effect: (s, e) => (s.smartTests = { ...s.smartTests, [e.id]: { kind: 'short', at: s.t } }) },
  { id: 'disk.long', label: 'Run extended self-test', group: 'Test', icon: 'play', confirm: e => (e.disk.kind === 'HDD' ? 'Takes ~12 hours on this disk; the disk stays usable but slower.' : 'Takes ~10 minutes.'), request: e => host(`smartctl -t long /dev/${e.id}`), effect: (s, e) => (s.smartTests = { ...s.smartTests, [e.id]: { kind: 'long', at: s.t } }) },
  { id: 'disk.spindown', label: 'Spin down now', group: 'Power', icon: 'power', when: e => e.disk.kind === 'HDD', request: e => host(`hdparm -y /dev/${e.id}`) },
];

const POOL_ACTIONS = [
  { id: 'pool.status', label: 'zpool status', group: 'Inspect', icon: 'info', primary: true, view: 'output', request: e => host(`zpool status -v ${e.id}`) },
  { id: 'pool.scrub', label: 'Start scrub', group: 'Maintain', icon: 'check', primary: true, when: (e, s) => !s.scrub[e.id] || s.scrub[e.id].done, request: e => host(`zpool scrub ${e.id}`), effect: (s, e) => (s.scrub = { ...s.scrub, [e.id]: { progress: 0, done: false } }) },
  { id: 'pool.scrub-stop', label: 'Stop scrub', group: 'Maintain', icon: 'stop', when: (e, s) => s.scrub[e.id] && !s.scrub[e.id].done, request: e => host(`zpool scrub -s ${e.id}`), effect: (s, e) => (s.scrub = { ...s.scrub, [e.id]: undefined }) },
  { id: 'pool.trim', label: 'TRIM', group: 'Maintain', icon: 'spark', when: e => e.id === 'rpool', request: e => host(`zpool trim ${e.id}`) },
  { id: 'pool.snapshot', label: 'Snapshot everything', group: 'Backup', icon: 'camera', fields: [{ name: 'name', label: 'Snapshot name', type: 'text', default: () => `manual-${today()}` }], request: (e, p) => host(`zfs snapshot -r ${e.id}@${p.name}`) },
];

const DATASET_ACTIONS = [
  { id: 'ds.snapshot', label: 'Take snapshot', group: 'Backup', icon: 'camera', primary: true, fields: [{ name: 'name', label: 'Snapshot name', type: 'text', default: () => `manual-${today()}` }], request: (e, p) => host(`zfs snapshot ${e.id}@${p.name}`) },
  { id: 'ds.snapshots', label: 'List snapshots', group: 'Backup', icon: 'list', view: 'output', request: e => host(`zfs list -t snapshot -o name,used,creation -s creation ${e.id}`) },
  { id: 'ds.usage', label: 'Largest folders', group: 'Inspect', icon: 'disk', view: 'output', request: e => host(`du -xh --max-depth=1 /${e.id} | sort -rh | head -15`) },
  { id: 'ds.quota', label: 'Set quota', group: 'Configure', icon: 'sliders', fields: [{ name: 'gb', label: 'Quota (GB, 0 = none)', type: 'number', default: 0 }], request: (e, p) => host(`zfs set quota=${p.gb ? p.gb + 'G' : 'none'} ${e.id}`) },
];

const EXT_ACTIONS = [
  { id: 'ext.open', label: 'Open web interface', group: 'Open', icon: 'open', primary: true, when: e => e.ext.url, request: e => link(e.ext.url) },
  { id: 'ext.dns', label: 'Check DNS record', group: 'Inspect', icon: 'search', when: e => e.id === 'dyndns', view: 'output', request: () => host(`dig +short ${DOMAIN} @1.1.1.1`) },
  { id: 'ext.ping', label: 'Ping', group: 'Inspect', icon: 'gauge', when: e => e.ext.url, view: 'output', request: e => host(`ping -c 4 ${new URL(e.ext.url).hostname}`) },
  { id: 'ext.public', label: 'Test from outside', group: 'Inspect', icon: 'globe', when: e => e.id === 'clients' || e.id === 'router', view: 'output', request: () => host(`curl -sI https://jellyfin.${DOMAIN} | head -3`) },
];

const BY_TYPE = {
  host: HOST_ACTIONS,
  lxc: LXC_ACTIONS,
  stream: STREAM_ACTIONS,
  scanJob: SCAN_JOB_ACTIONS,
  mediaJob: MEDIA_JOB_ACTIONS,
  disk: DISK_ACTIONS,
  pool: POOL_ACTIONS,
  dataset: DATASET_ACTIONS,
  ext: EXT_ACTIONS,
};

export const GROUP_ORDER = ['Open', 'App', 'Playback', 'Job', 'Control', 'Power', 'Inspect', 'Docker', 'Maintain', 'Test', 'Backup', 'Configure'];

/** All actions that apply to an entity right now, primary first within each group. */
export function actionsFor(e, state) {
  if (!e) return [];
  const list = e.type === 'svc' ? [...(APP_ACTIONS[e.id] ?? []), ...SVC_ACTIONS] : BY_TYPE[e.type] ?? [];
  return list.filter(a => !a.when || a.when(e, state));
}

export function findAction(id) {
  for (const list of [...Object.values(BY_TYPE), SVC_ACTIONS, ...Object.values(APP_ACTIONS)]) {
    const a = list.find(x => x.id === id);
    if (a) return a;
  }
  return null;
}

/** Every (target, action) pair, for the command palette. */
export function allTargets(state) {
  return [
    { type: 'host', id: NODE },
    ...LXCS.map(c => ({ type: 'lxc', id: c.id })),
    ...LXCS.flatMap(c => c.services.map(s => ({ type: 'svc', id: s.id }))),
    ...state.streams.map(s => ({ type: 'stream', id: s.id })),
    ...state.scanJobs.map(j => ({ type: 'scanJob', id: j.id })),
    ...state.mediaJobs.map(j => ({ type: 'mediaJob', id: j.id })),
    ...DISKS.map(d => ({ type: 'disk', id: d.id })),
    ...STORAGE.map(p => ({ type: 'pool', id: p.id })),
    ...STORAGE.flatMap(p => p.datasets.map(d => ({ type: 'dataset', id: d.id }))),
    ...EXTERNAL.map(x => ({ type: 'ext', id: x.id })),
  ];
}

export const fieldsOf = (a, e, state) => (typeof a.fields === 'function' ? a.fields(e, state) : a.fields ?? []);
export const confirmOf = (a, e) => (typeof a.confirm === 'function' ? a.confirm(e) : a.confirm);
export const requestsOf = (a, e, params) => [a.request(e, params ?? {})].flat().filter(Boolean);

/** Human-readable form of a request, shown before anything runs. */
export function describeRequest(r, e) {
  if (r.via === 'link') return { label: 'Opens', text: r.url };
  if (r.via === 'shell') return { label: r.target === 'host' ? `root@${NODE}` : `root@${NODE} → LXC ${r.target.slice(4)}`, text: `# ${r.cmd}` };
  const base = r.via === 'proxmox' ? HOST.web : serviceBase(r.service);
  const body = r.body == null ? '' : typeof r.body === 'string' ? `\n${r.body}` : `\n${JSON.stringify(r.body, null, 2)}`;
  return { label: r.via === 'proxmox' ? 'Proxmox API' : `${r.service} API`, text: `${r.method} ${base}${r.url}${body}` };
}

const SERVICE_PORT = { jellyfin: 'jellyfin', seerr: 'seerr', radarr: 'radarr', sonarr: 'sonarr', prowlarr: 'prowlarr', qbittorrent: 'qbit', bazarr: 'bazarr', immich: 'immich-server', paperless: 'paperless' };
function serviceBase(name) {
  const id = SERVICE_PORT[name];
  const lxc = LXCS.find(c => c.services.some(s => s.id === id));
  const svc = lxc?.services.find(s => s.id === id);
  return svc ? `http://${lxc.ip}:${svc.port}` : '';
}

// ---- Sample files for the editor (what the backend would `cat`) ----

function lxcConf(lxc) {
  return [
    `arch: amd64`,
    `cores: ${lxc.cores}`,
    `features: nesting=1,keyctl=1`,
    `hostname: ${lxc.name}`,
    `memory: ${lxc.ram}`,
    ...(lxc.mounts ?? []).map((m, i) => `mp${i}: /${m},mp=/${m.split('/')[1]}`),
    `net0: name=eth0,bridge=vmbr0,hwaddr=BC:24:11:3A:0${lxc.id % 10}:1F,ip=${lxc.ip}/24,gw=192.168.178.1,type=veth`,
    `onboot: 1`,
    `ostype: debian`,
    `rootfs: local-zfs:subvol-${lxc.id}-disk-0,size=${lxc.disk}G`,
    `swap: 512`,
    `unprivileged: 1`,
    ...(lxc.gpu ? ['dev0: /dev/dri/renderD128,gid=104', 'dev1: /dev/dri/card0,gid=44'] : []),
  ].join('\n');
}

function composeFile(lxc) {
  const svcs = lxc.services.filter(s => s.kind === 'docker');
  return [
    'services:',
    ...svcs.flatMap(s => [
      `  ${s.container ?? s.name}:`,
      `    image: ${s.image?.includes('/') ? s.image : `${s.image ?? s.name}`}`,
      `    container_name: ${s.container ?? s.name}`,
      `    restart: unless-stopped`,
      ...(s.port ? [`    ports:`, `      - ${s.port}:${s.port}`] : []),
      ...(lxc.gpu && (s.id === 'jellyfin' || s.id === 'immich-ml') ? ['    devices:', '      - /dev/dri:/dev/dri'] : []),
      `    environment:`,
      `      - TZ=Europe/Berlin`,
      '',
    ]),
  ].join('\n');
}

function unitFile(svc) {
  if (svc.id === 'scan-watcher')
    return `[Unit]\nDescription=Watch the scanner inbox and feed Paperless\nAfter=network-online.target smbd.service\n\n[Service]\nExecStart=/usr/local/bin/scan-watcher.sh\nRestart=always\nRestartSec=5\nUser=scanner\n\n[Install]\nWantedBy=multi-user.target`;
  return `[Unit]\nDescription=${svc.name}\nAfter=network-online.target\n\n[Service]\nExecStart=/usr/bin/${svc.unit}\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target`;
}

const WATCHER_SCRIPT = `#!/usr/bin/env bash
# Waits for the scanner to finish a batch, merges the pages, runs OCR and hands
# the PDF to Paperless.
set -euo pipefail
INBOX=/scans/inbox WORK=/scans/work FAILED=/scans/failed
CONSUME=/opt/paperless/consume

inotifywait -m -e close_write --format '%f' "$INBOX" | while read -r f; do
  sleep 8                                   # let the scanner finish the batch
  batch="$WORK/$(date +%s)"; mkdir -p "$batch"
  mv "$INBOX"/*.jpg "$batch"/ 2>/dev/null || continue
  if img2pdf "$batch"/*.jpg -o "$batch/scan.pdf" \\
     && ocrmypdf -l deu+eng --rotate-pages --deskew "$batch/scan.pdf" "$batch/ocr.pdf"; then
    mv "$batch/ocr.pdf" "$CONSUME/scan_$(date +%F_%H%M%S).pdf"
    rm -rf "$batch"
  else
    mv "$batch" "$FAILED"/
  fi
done`;

const CADDYFILE = `{
\temail malte@example.com
}

jellyfin.${DOMAIN} {
\treverse_proxy 192.168.178.21:8096
}

seerr.${DOMAIN} {
\treverse_proxy 192.168.178.21:5055
}

# LAN only — not forwarded on the router
dash.home.arpa {
\ttls internal
\treverse_proxy 192.168.178.10:4000
}`;
