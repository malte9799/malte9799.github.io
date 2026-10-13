// Static description of the homelab: hardware, LXCs, containers and how they
// connect. This is the file to edit when the real setup differs — the
// simulator and every panel read from here. IDs, IPs and images are
// placeholders until a real agent reports them.

export const HOST = {
  name: 'pve',
  os: 'Proxmox VE 9.0',
  kernel: '6.14.11-pve',
  ip: '192.168.178.10',
  cpu: { model: 'AMD Ryzen 7 5700G', cores: 8, threads: 16, tdp: 65 },
  gpu: { model: 'Intel Arc A380', vram: 6, driver: 'xe · QSV/VA-API' },
  ram: 64, // GiB
  swap: 8,
  nic: { name: 'vmbr0', speed: 2500 }, // Mbit
};

export const DOMAIN = 'malte.dydns.io';

// Disks with the SMART attributes that matter. `pool` links them to STORAGE.
export const DISKS = [
  {
    id: 'nvme0n1',
    model: 'Samsung 980 PRO 1TB',
    kind: 'NVMe',
    size: 1000,
    pool: 'rpool',
    serial: 'S5GXNX0T41…',
    smart: { health: 'good', temp: 44, powerOnHours: 18_420, wear: 7, mediaErrors: 0, unsafeShutdowns: 12 },
  },
  {
    id: 'sda',
    model: 'WD Red Plus 8TB',
    kind: 'HDD',
    size: 8000,
    pool: 'tank',
    serial: 'WD-CA0J2K…',
    smart: { health: 'good', temp: 36, powerOnHours: 21_903, reallocated: 0, pending: 0, crc: 0 },
  },
  {
    id: 'sdb',
    model: 'WD Red Plus 8TB',
    kind: 'HDD',
    size: 8000,
    pool: 'tank',
    serial: 'WD-CA0J9M…',
    smart: { health: 'good', temp: 37, powerOnHours: 21_897, reallocated: 0, pending: 0, crc: 2 },
  },
  {
    id: 'sdc',
    model: 'Seagate IronWolf 4TB',
    kind: 'HDD',
    size: 4000,
    pool: 'backup',
    serial: 'ZGY4H1…',
    smart: { health: 'warning', temp: 41, powerOnHours: 39_118, reallocated: 8, pending: 1, crc: 0 },
  },
];

// ZFS pools and the datasets that LXCs bind-mount.
export const STORAGE = [
  {
    id: 'rpool',
    layout: 'single NVMe',
    size: 899,
    used: 312,
    datasets: [
      { id: 'rpool/data', label: 'LXC root disks', used: 214 },
      { id: 'rpool/ROOT', label: 'Proxmox', used: 18 },
    ],
  },
  {
    id: 'tank',
    layout: 'mirror · 2× 8TB',
    size: 7270,
    used: 5084,
    datasets: [
      { id: 'tank/media', label: 'Media library', used: 4130 },
      { id: 'tank/photos', label: 'Immich library', used: 682 },
      { id: 'tank/documents', label: 'Paperless', used: 41 },
      { id: 'tank/downloads', label: 'Downloads', used: 231 },
    ],
  },
  {
    id: 'backup',
    layout: 'single · 4TB',
    size: 3630,
    used: 1912,
    datasets: [{ id: 'backup/vzdump', label: 'vzdump backups', used: 1912 }],
  },
];

// Things outside the Proxmox host.
export const EXTERNAL = [
  { id: 'clients', label: 'Remote clients', sub: 'TV · phone · browser', icon: 'globe' },
  { id: 'dyndns', label: DOMAIN, sub: 'DynDNS · A record', icon: 'dns' },
  { id: 'router', label: 'Router', sub: '443 → caddy', icon: 'router' },
  { id: 'phone', label: 'Phones', sub: 'Immich app (LAN)', icon: 'phone' },
  { id: 'scanner-dev', label: 'WiFi scanner', sub: 'scan-to-SMB', icon: 'scanner' },
  { id: 'indexers', label: 'Indexers', sub: 'via Prowlarr', icon: 'cloud' },
];

// kind: 'docker' | 'systemd' | 'native'
export const LXCS = [
  {
    id: 100,
    name: 'caddy',
    ip: '192.168.178.20',
    cores: 1,
    ram: 512,
    disk: 4,
    role: 'Reverse proxy · TLS',
    services: [
      { id: 'caddy', name: 'caddy2', kind: 'native', port: 443, detail: 'Let’s Encrypt · auto-HTTPS', image: 'caddy 2.10' },
      { id: 'ddclient', name: 'ddns-updater', kind: 'systemd', detail: `keeps ${DOMAIN} on the WAN IP` },
    ],
  },
  {
    id: 101,
    name: 'media',
    ip: '192.168.178.21',
    cores: 6,
    ram: 12288,
    disk: 32,
    role: 'Docker · media stack',
    gpu: true,
    mounts: ['tank/media', 'tank/downloads'],
    services: [
      { id: 'jellyfin', name: 'jellyfin', kind: 'docker', port: 8096, image: 'jellyfin/jellyfin:10.11', detail: 'QSV transcoding on Arc A380', public: 'jellyfin.' + DOMAIN },
      { id: 'seerr', name: 'seerr', kind: 'docker', port: 5055, image: 'seerr/seerr:latest', detail: 'requests → Radarr / Sonarr', public: 'seerr.' + DOMAIN },
      { id: 'radarr', name: 'radarr', kind: 'docker', port: 7878, image: 'linuxserver/radarr', detail: 'movies' },
      { id: 'sonarr', name: 'sonarr', kind: 'docker', port: 8989, image: 'linuxserver/sonarr', detail: 'series' },
      { id: 'prowlarr', name: 'prowlarr', kind: 'docker', port: 9696, image: 'linuxserver/prowlarr', detail: 'indexer manager' },
      { id: 'qbit', name: 'qbittorrent', kind: 'docker', port: 8080, image: 'linuxserver/qbittorrent', detail: 'behind gluetun VPN' },
      { id: 'bazarr', name: 'bazarr', kind: 'docker', port: 6767, image: 'linuxserver/bazarr', detail: 'subtitles' },
    ],
  },
  {
    id: 102,
    name: 'immich',
    ip: '192.168.178.22',
    cores: 4,
    ram: 8192,
    disk: 24,
    role: 'Docker · photos',
    gpu: true,
    mounts: ['tank/photos'],
    services: [
      { id: 'immich-server', name: 'immich-server', kind: 'docker', port: 2283, image: 'immich-app/immich-server:v2', detail: 'API · web · uploads' },
      { id: 'immich-ml', name: 'immich-ml', kind: 'docker', image: 'immich-machine-learning:v2-openvino', detail: 'faces · CLIP search (OpenVINO)' },
      { id: 'immich-db', name: 'postgres', kind: 'docker', image: 'vectorchord-pg16', detail: 'metadata + vectors' },
      { id: 'immich-redis', name: 'redis', kind: 'docker', image: 'valkey:8', detail: 'job queue' },
    ],
  },
  {
    id: 103,
    name: 'scanner',
    ip: '192.168.178.23',
    cores: 2,
    ram: 4096,
    disk: 16,
    role: 'Docker + systemd · documents',
    mounts: ['tank/documents'],
    services: [
      { id: 'smb-inbox', name: 'smb-inbox', kind: 'systemd', port: 445, detail: 'samba share the scanner writes to' },
      { id: 'scan-watcher', name: 'scan-watcher.service', kind: 'systemd', detail: 'inotify → img2pdf → ocrmypdf → consume/' },
      { id: 'paperless', name: 'paperless-ngx', kind: 'docker', port: 8000, image: 'paperless-ngx:2.18', detail: 'consume · classify · archive' },
      { id: 'paperless-redis', name: 'redis', kind: 'docker', image: 'redis:7', detail: 'celery broker' },
      { id: 'gotenberg', name: 'gotenberg', kind: 'docker', image: 'gotenberg:8', detail: 'office → PDF' },
      { id: 'tika', name: 'tika', kind: 'docker', image: 'apache/tika', detail: 'text extraction' },
    ],
  },
];

// Edges for the topology map. kind: 'web' (public HTTPS), 'lan', 'api', 'data' (files / mounts)
export const LINKS = [
  { from: 'clients', to: 'dyndns', kind: 'web' },
  { from: 'dyndns', to: 'router', kind: 'web' },
  { from: 'router', to: 'caddy', kind: 'web', label: ':443' },
  { from: 'caddy', to: 'jellyfin', kind: 'web', label: 'jellyfin.' },
  { from: 'caddy', to: 'seerr', kind: 'web', label: 'seerr.' },
  { from: 'ddclient', to: 'dyndns', kind: 'api', label: 'IP update' },
  { from: 'seerr', to: 'radarr', kind: 'api' },
  { from: 'seerr', to: 'sonarr', kind: 'api' },
  { from: 'radarr', to: 'prowlarr', kind: 'api' },
  { from: 'sonarr', to: 'prowlarr', kind: 'api' },
  { from: 'prowlarr', to: 'indexers', kind: 'web' },
  { from: 'radarr', to: 'qbit', kind: 'api' },
  { from: 'sonarr', to: 'qbit', kind: 'api' },
  { from: 'qbit', to: 'tank/downloads', kind: 'data' },
  { from: 'radarr', to: 'tank/media', kind: 'data', label: 'import' },
  { from: 'sonarr', to: 'tank/media', kind: 'data' },
  { from: 'bazarr', to: 'tank/media', kind: 'data' },
  { from: 'jellyfin', to: 'tank/media', kind: 'data' },
  { from: 'phone', to: 'immich-server', kind: 'lan', label: 'upload' },
  { from: 'immich-server', to: 'immich-ml', kind: 'api' },
  { from: 'immich-server', to: 'immich-db', kind: 'api' },
  { from: 'immich-server', to: 'immich-redis', kind: 'api' },
  { from: 'immich-server', to: 'tank/photos', kind: 'data' },
  { from: 'scanner-dev', to: 'smb-inbox', kind: 'lan', label: 'SMB' },
  { from: 'smb-inbox', to: 'scan-watcher', kind: 'data', label: 'inotify' },
  { from: 'scan-watcher', to: 'paperless', kind: 'data', label: 'consume/' },
  { from: 'paperless', to: 'paperless-redis', kind: 'api' },
  { from: 'paperless', to: 'tika', kind: 'api' },
  { from: 'paperless', to: 'gotenberg', kind: 'api' },
  { from: 'paperless', to: 'tank/documents', kind: 'data' },
];

// Stages for the two live pipelines.
export const SCAN_STAGES = [
  { id: 'scan', label: 'Scanning', sub: 'WiFi scanner', where: 'scanner-dev' },
  { id: 'inbox', label: 'Inbox', sub: 'SMB /scans/inbox', where: 'smb-inbox' },
  { id: 'convert', label: 'Convert', sub: 'img2pdf + ocrmypdf', where: 'scan-watcher' },
  { id: 'consume', label: 'Consume', sub: 'paperless consume/', where: 'scan-watcher' },
  { id: 'ingest', label: 'Ingest', sub: 'Tika · classify · tag', where: 'paperless' },
  { id: 'done', label: 'Archived', sub: 'tank/documents', where: 'paperless' },
];

export const MEDIA_STAGES = [
  { id: 'request', label: 'Requested', sub: 'Seerr', where: 'seerr' },
  { id: 'search', label: 'Searching', sub: 'Prowlarr', where: 'prowlarr' },
  { id: 'download', label: 'Downloading', sub: 'qBittorrent · VPN', where: 'qbit' },
  { id: 'import', label: 'Importing', sub: 'Radarr / Sonarr', where: 'radarr' },
  { id: 'done', label: 'Available', sub: 'Jellyfin library', where: 'jellyfin' },
];
