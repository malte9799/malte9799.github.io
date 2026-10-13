// Believable command output for the mock executor, terminal and log viewer.
// None of this is needed once a backend runs the real commands.

import { DISKS, DOMAIN, HOST, LXCS, STORAGE } from './inventory';

const pad = (s, n) => String(s).padEnd(n);
const ts = t => new Date(t).toISOString().replace('T', ' ').slice(0, 19);

export function mockOutput(action, e, params, state) {
  const id = action.id;
  if (id === 'lxc.ps') return dockerPs(e.lxc, state);
  if (id === 'svc.status') return systemctlStatus(e.svc, e.lxc, state);
  if (id === 'svc.inspect')
    return [JSON.stringify({ Status: state.services[e.id].status, Running: state.services[e.id].status !== 'stopped', Pid: 4000 + e.lxc.id, StartedAt: new Date(state.t - 3.6e6 * 30).toISOString(), RestartCount: 0, Health: { Status: 'healthy' } }, null, 2)];
  if (id === 'disk.report') return smartReport(e.disk, state);
  if (id === 'pool.status') return zpoolStatus(e.pool, state);
  if (id === 'lxc.snapshots') return ['NAME                      DATE                 DESCRIPTION', `pre-update-${today()}  ${ts(state.t - 86400e3)}  before docker pull`, `weekly-20261006            2026-10-06 03:00:00  auto`, `weekly-20260929            2026-09-29 03:00:00  auto`, 'current                                         You are here!'];
  if (id === 'ds.snapshots') return ['NAME                                   USED  CREATION', `${e.id}@weekly-20260929   1.2G  Mon Sep 29 03:00 2026`, `${e.id}@weekly-20261006   640M  Mon Oct  6 03:00 2026`, `${e.id}@daily-20261012    88M   Sun Oct 12 03:00 2026`];
  if (id === 'ds.usage') return datasetUsage(e.ds);
  if (id === 'host.tasks') return ['UPID                                         TYPE      ID   STATUS', 'UPID:pve:000F12A1:vzdump::root@pam:          vzdump        OK', 'UPID:pve:000F0E77:vzstart:101:root@pam:      vzstart   101  OK', 'UPID:pve:000E9C02:aptupdate::root@pam:       aptupdate      OK', 'UPID:pve:000E1B44:vzsnapshot:103:root@pam:   vzsnapshot 103 OK'];
  if (id === 'prowlarr.test') return ['NZBgeek         ✓ 212 ms', '1337x           ✓ 640 ms', 'TorrentLeech    ✓ 301 ms', 'IPTorrents      ✗ 503 Service Unavailable', '', '3 of 4 indexers OK'];
  if (id === 'qbit.vpn') return [JSON.stringify({ ip: '185.213.155.74', city: 'Amsterdam', country: 'NL', org: 'AS39351 31173 Services AB (Mullvad)' }, null, 2)];
  if (id === 'paperless.tasks') return ['TASK                                  STATUS    FILE', ...state.scanJobs.map(j => `${j.id.padEnd(37)} ${j.stage >= 5 ? 'SUCCESS' : j.stage >= 4 ? 'STARTED' : 'PENDING'}   ${j.name}.pdf`)];
  if (id === 'paperless.sanity') return ['Checking 1,284 documents…', 'Checksums OK', 'Archive files OK', 'Thumbnails OK', '0 errors, 1 warning: document 612 has no content (empty OCR)'];
  if (id === 'smb.ls') return ['/scans/inbox:', ...state.scanJobs.filter(j => j.stage <= 1).map(j => `-rw-r--r-- 1 scanner scanner 2.1M ${j.id}.jpg`), '', '/scans/failed:', '-rw-r--r-- 1 scanner scanner 1.8M scan_0007.jpg'];
  if (id === 'caddy.certs') return ['drwx------ 2 caddy caddy 4096 Aug 13 04:12 jellyfin.' + DOMAIN, 'drwx------ 2 caddy caddy 4096 Aug 13 04:12 seerr.' + DOMAIN, '', `Next renewal in ${state.caddy.certDays} days`];
  if (id === 'caddy.config') return ['{"apps":{"http":{"servers":{"srv0":{"listen":[":443"],"routes":[{"match":[{"host":["jellyfin.' + DOMAIN + '"]}],"handle":[{"handler":"reverse_proxy","upstreams":[{"dial":"192.168.178.21:8096"}]}]}, …]}}}}}'];
  if (id === 'ddns.check' || id === 'ext.dns') return ['84.1xx.xx.17'];
  if (id === 'ext.ping') return ['PING 64 bytes: icmp_seq=1 ttl=64 time=0.42 ms', 'PING 64 bytes: icmp_seq=2 ttl=64 time=0.39 ms', 'PING 64 bytes: icmp_seq=3 ttl=64 time=0.51 ms', 'PING 64 bytes: icmp_seq=4 ttl=64 time=0.40 ms', '4 packets transmitted, 4 received, 0% packet loss'];
  if (id === 'ext.public') return ['HTTP/2 200', 'alt-svc: h3=":443"; ma=2592000', 'server: Caddy'];
  return null;
}

const today = () => new Date().toISOString().slice(0, 10).replaceAll('-', '');

function dockerPs(lxc, state) {
  return [
    `${pad('NAME', 26)}${pad('IMAGE', 40)}STATUS`,
    ...lxc.services
      .filter(s => s.kind === 'docker')
      .map(s => {
        const st = state.services[s.id].status;
        return `${pad(s.container ?? s.name, 26)}${pad(s.image ?? s.name, 40)}${st === 'stopped' ? 'Exited (0) 2 minutes ago' : st === 'running' || st === 'degraded' ? 'Up 12 days (healthy)' : 'Up 2 seconds (health: starting)'}`;
      }),
  ];
}

function systemctlStatus(svc, lxc, state) {
  const st = state.services[svc.id];
  const active = st.status === 'stopped' ? 'inactive (dead)' : st.status === 'running' || st.status === 'degraded' ? 'active (running) since Mon 2026-09-29 03:12:41 CEST; 2 weeks ago' : 'activating (start)';
  return [
    `● ${svc.unit}.service - ${svc.detail}`,
    `     Loaded: loaded (/etc/systemd/system/${svc.unit}.service; enabled; preset: enabled)`,
    `     Active: ${active}`,
    `   Main PID: ${1200 + lxc.id} (${svc.unit})`,
    `     Memory: ${Math.round(st.mem)}M`,
    `        CPU: ${(st.cpu * 3.1).toFixed(1)}s`,
  ];
}

function smartReport(d, state) {
  const s = d.smart;
  const head = [`=== START OF INFORMATION SECTION ===`, `Device Model:     ${d.model}`, `Serial Number:    ${d.serial}`, `User Capacity:    ${d.size} GB`, ``, `SMART overall-health self-assessment test result: ${s.health === 'good' ? 'PASSED' : 'PASSED (with warnings)'}`, ``];
  const test = state.smartTests[d.id];
  const tail = test ? [``, `Self-test in progress: ${test.kind}, started ${Math.round((state.t - test.at) / 1000)} s ago`] : [``, `# 1  Short offline   Completed without error   00%   ${s.powerOnHours - 168}`];
  if (d.kind === 'NVMe')
    return [...head, `Temperature:                        ${Math.round(state.disks[d.id].temp)} Celsius`, `Percentage Used:                    ${s.wear}%`, `Data Units Written:                 48,211,532 [24.6 TB]`, `Power On Hours:                     ${s.powerOnHours}`, `Unsafe Shutdowns:                   ${s.unsafeShutdowns}`, `Media and Data Integrity Errors:    ${s.mediaErrors}`, ...tail];
  return [
    ...head,
    'ID# ATTRIBUTE_NAME          VALUE WORST THRESH RAW_VALUE',
    `  5 Reallocated_Sector_Ct   ${s.reallocated ? '098' : '100'}   ${s.reallocated ? '098' : '100'}   010    ${s.reallocated}`,
    `  9 Power_On_Hours          ${pad(Math.max(1, 100 - Math.round(s.powerOnHours / 1000)), 5)} ${pad('', 5)} 000    ${s.powerOnHours}`,
    `194 Temperature_Celsius     ${pad(Math.round(state.disks[d.id].temp), 5)} ${pad('', 5)} 000    ${Math.round(state.disks[d.id].temp)}`,
    `197 Current_Pending_Sector  100   100   000    ${s.pending}`,
    `199 UDMA_CRC_Error_Count    200   200   000    ${s.crc}`,
    ...tail,
  ];
}

function zpoolStatus(pool, state) {
  const disks = DISKS.filter(d => d.pool === pool.id);
  const sc = state.scrub[pool.id];
  const scan = sc && !sc.done ? `  scan: scrub in progress since ${ts(state.t - sc.progress * 90e3)}\n        ${(sc.progress * 100).toFixed(1)}% done, 0 repaired` : `  scan: scrub repaired 0B in 05:41:12 with 0 errors on Sun Oct 12 05:41:12 2026`;
  return [
    `  pool: ${pool.id}`,
    ` state: ONLINE`,
    ...scan.split('\n'),
    `config:`,
    ``,
    `        NAME        STATE     READ WRITE CKSUM`,
    `        ${pad(pool.id, 12)}ONLINE       0     0     0`,
    ...(disks.length > 1 ? [`          mirror-0  ONLINE       0     0     0`] : []),
    ...disks.map(d => `            ${pad(d.id, 10)}ONLINE       0     0     0`),
    ``,
    `errors: No known data errors`,
  ];
}

function datasetUsage(ds) {
  const parts = {
    'tank/media': [['movies', 2610], ['tv', 1440], ['music', 64], ['.trickplay', 16]],
    'tank/photos': [['library', 540], ['thumbs', 98], ['encoded-video', 44]],
    'tank/documents': [['media/documents/originals', 22], ['media/documents/archive', 17], ['data', 2]],
    'tank/downloads': [['complete', 196], ['incomplete', 35]],
  }[ds.id] ?? [['data', ds.used]];
  return parts.map(([n, gb]) => `${pad(gb >= 1000 ? (gb / 1000).toFixed(1) + 'T' : gb + 'G', 8)}/${ds.id}/${n}`);
}

// ---- Terminal ----

export function mockShell(cmd, where, state) {
  const c = cmd.trim();
  const lxc = where.startsWith('lxc:') ? LXCS.find(x => x.id === Number(where.slice(4))) : null;
  const name = lxc ? lxc.name : HOST.name;
  if (!c) return [];
  if (c === 'help') return ['Mock shell — try: uptime, df -h, free -h, docker ps, zpool list, pct list, systemctl status <unit>, ip -br a, hostname, whoami'];
  if (c === 'whoami') return ['root'];
  if (c === 'hostname') return [name];
  if (c === 'uptime') return [` ${new Date(state.t).toTimeString().slice(0, 8)} up ${Math.floor(state.uptime / 86400)} days,  load average: ${state.cpu.load.map(l => l.toFixed(2)).join(', ')}`];
  if (c === 'free -h') {
    const used = lxc ? state.lxc[lxc.id].mem / 1024 : state.ram.hist.at(-1) / 1024;
    const total = lxc ? lxc.ram / 1024 : HOST.ram;
    return ['               total        used        free', `Mem:        ${pad(total.toFixed(1) + 'Gi', 12)}${pad(used.toFixed(1) + 'Gi', 12)}${(total - used).toFixed(1)}Gi`];
  }
  if (c === 'df -h')
    return lxc
      ? ['Filesystem                       Size  Used Avail Use% Mounted on', `rpool/data/subvol-${lxc.id}-disk-0  ${lxc.disk}G  ${(lxc.disk * 0.42).toFixed(1)}G  ${(lxc.disk * 0.58).toFixed(1)}G  42% /`, ...(lxc.mounts ?? []).map(m => `${pad(m, 33)}7.1T  5.0T  2.2T  70% /${m.split('/')[1]}`)]
      : ['Filesystem        Size  Used Avail Use% Mounted on', 'rpool/ROOT/pve-1  880G   18G  862G   3% /', ...STORAGE.flatMap(p => p.datasets.map(d => `${pad(d.id, 18)}${p.size}G  ${d.used}G   ${p.size - p.used}G  ${Math.round((p.used / p.size) * 100)}% /${d.id}`))];
  if (c === 'docker ps') return lxc?.compose ? dockerPs(lxc, state) : ['bash: docker: command not found'];
  if (c === 'pct list' && !lxc) return ['VMID       Status     Lock         Name', ...LXCS.map(x => `${pad(x.id, 11)}${pad(state.lxc[x.id].status === 'stopped' ? 'stopped' : 'running', 11)}${pad('', 13)}${x.name}`)];
  if (c === 'zpool list' && !lxc) return ['NAME     SIZE  ALLOC   FREE  HEALTH', ...STORAGE.map(p => `${pad(p.id, 9)}${pad(p.size + 'G', 6)}${pad(p.used + 'G', 7)}${pad(p.size - p.used + 'G', 7)}ONLINE`)];
  if (c === 'ip -br a') return ['lo               UNKNOWN        127.0.0.1/8', `${lxc ? 'eth0@if12' : 'vmbr0'}        UP             ${lxc ? lxc.ip : HOST.ip}/24`];
  if (c.startsWith('systemctl status')) {
    const unit = c.split(/\s+/)[2];
    const svc = (lxc ? lxc.services : LXCS.flatMap(x => x.services)).find(s => s.unit === unit || s.name === unit);
    return svc ? systemctlStatus(svc, lxc ?? LXCS.find(x => x.services.includes(svc)), state) : [`Unit ${unit}.service could not be found.`];
  }
  if (c.startsWith('cd ') || c === 'ls') return c === 'ls' ? (lxc?.compose ? ['compose.yml  .env  data'] : ['scripts  backups']) : [];
  return [`(mock) would run on ${name}: ${c}`];
}

// ---- Log lines ----

const LOG_TEMPLATES = {
  jellyfin: ['[INF] [27] Emby.Server.Implementations.HttpServer.WebSocketManager: WS "192.168.178.55" request', '[INF] [41] MediaBrowser.MediaEncoding.Transcoding.TranscodeManager: /usr/lib/jellyfin-ffmpeg/ffmpeg -hwaccel qsv -c:v hevc_qsv …', '[INF] [12] Jellyfin.Api.Helpers.MediaInfoHelper: User policy for malte. EnablePlaybackRemuxing: True', '[INF] [55] Emby.Server.Implementations.ScheduledTasks.TaskManager: Scan Media Library Completed after 0 minute(s) and 14 seconds'],
  seerr: ['[info][Jellyfin Sync]: Recently Added Scan starting', '[info][Notifications]: Sent notification to webhook', '[debug][API]: GET /api/v1/request?take=10'],
  radarr: ['[Info] RssSyncService: RSS Sync Completed. Reports found: 98, Reports grabbed: 0', '[Info] DownloadDecisionMaker: Processing 98 releases', '[Info] RefreshMovieService: Updating info for Arrival'],
  sonarr: ['[Info] RssSyncService: RSS Sync Completed. Reports found: 120, Reports grabbed: 1', '[Info] EpisodeSearchService: Searching indexers for [Severance : S02E08]', '[Info] DiskScanService: Scanning disk for Shōgun'],
  prowlarr: ['[Info] ReleaseSearchService: Searching 4 indexers for [Dune Part Two]', '[Info] HistoryService: Indexer query: NZBgeek 212ms', '[Warn] IndexerStatusService: IPTorrents unavailable, disabling for 5 min'],
  qbit: ['(N) Added new torrent. Torrent: "Arrival.2016.2160p.UHD.BluRay"', '(N) Successfully listening on IP. IP: 10.64.0.2. Port: TCP/51820', '(I) Torrent finished: "Shogun.S01E04.1080p.WEB"'],
  bazarr: ['WARNING :: OpenSubtitles.com: throttled for 10 minutes', 'INFO :: Searching subtitles for Aftersun (2022)', 'INFO :: Downloaded de subtitles for Past Lives'],
  'immich-server': ['[Nest] LOG [Api:EventRepository] Websocket Connect: 3', '[Nest] LOG [Microservices:JobService] Job thumbnailGeneration finished for 12 assets', '[Nest] LOG [Api:AssetMediaService] Upload from iPhone, 4 files'],
  'immich-ml': ['INFO  Loaded ViT-B-32__openai (OpenVINO) in 1.8s', 'INFO  Processed 16 faces in 0.42s', 'INFO  POST /predict 200 31ms'],
  paperless: ['[INFO] [paperless.consumer] Consuming scan_2026-10-13_053912.pdf', '[INFO] [paperless.parsing.tesseract] Using OCR language deu+eng', '[INFO] [paperless.consumer] Document 1285 consumption finished', '[INFO] [paperless.matching] Assigned tag Rechnung by auto-matching'],
  'scan-watcher': ['inotify: close_write scan_0031.jpg', 'merging 3 pages with img2pdf', 'ocrmypdf: page 1/3 OCR done', 'moved scan_2026-10-13_053912.pdf -> /opt/paperless/consume'],
  'smb-inbox': ['smbd: connect from 192.168.178.40 (scanner)', 'smbd: scanner opened file scans/inbox/scan_0031.jpg', 'smbd: closed connection'],
  caddy: ['{"level":"info","logger":"http.log.access","msg":"handled request","request":{"host":"jellyfin.' + DOMAIN + '","uri":"/Items/…"},"status":200}', '{"level":"info","logger":"tls","msg":"certificate is valid, no renewal needed"}'],
  ddclient: ['ddns-updater: IP unchanged (84.1xx.xx.17), next check in 5m'],
  host: ['pvedaemon[2211]: <root@pam> starting task UPID:pve:…:vzdump', 'kernel: zfs: arc_c resized to 20.1 GiB', 'pveproxy[1022]: worker 31211 finished', 'smartd[901]: Device: /dev/sdc [SAT], 8 Currently unreadable (pending) sectors'],
};

export function mockLogLine(key, t) {
  const list = LOG_TEMPLATES[key] ?? ['[info] heartbeat ok', '[debug] GET /health 200'];
  return `${ts(t)}  ${list[Math.floor(Math.random() * list.length)]}`;
}
