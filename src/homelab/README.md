# Homelab dashboard

Runs entirely on simulated data until a backend is connected. Everything the
UI can show or do is described as data:

| File | What it holds |
| --- | --- |
| `data/inventory.js` | The setup: host, disks, pools, LXCs, services, links, pipeline stages |
| `data/simulator.js` | Mock live feed (one snapshot per second) |
| `data/actions.js` | **Every action**: target, inputs, the exact request it becomes, mock effect |
| `data/executor.js` | Runs actions — mock, or `POST`s to the backend when `VITE_HOMELAB_API` is set |
| `data/mock-output.js` | Fake command output, terminal and log lines (mock only) |
| `ui/` | Action menu, action bar, dialogs, command palette (`/` or Ctrl/⌘ K), tasks |

## Actions

An action is `{ id, label, group, request(entity, params), fields?, view?, danger?, effect? }`.
`request()` returns one or more of:

- `{ via: 'proxmox', method, url, body }` — Proxmox VE API (`/api2/json/...`)
- `{ via: 'api', service, method, url, body }` — a service's own API (Jellyfin, Seerr, *arr, qBittorrent, Immich, Paperless…)
- `{ via: 'shell', target: 'host' | 'lxc:<id>', cmd }` — a command on the Proxmox host (`pct exec <id> -- …` for LXCs)
- `{ via: 'link', url }` — opened in a new tab, never sent anywhere

Every dialog shows these requests before anything runs, and the task drawer keeps them with their output.
`danger: 1` asks for confirmation, `danger: 2` additionally says what breaks.

## Backend contract (to build)

The browser never holds a token. A small service on the homelab (Node, same repo) does:

```
POST /api/actions   { action, target: { type, id }, params }  → { ok, lines: string[] }
                    multipart (field "payload" = that JSON, plus files) when a file is attached
POST /api/shell     { target: 'host' | 'lxc:<id>', cmd }       → { lines: string[] }
GET  /api/state     (or a WebSocket) → the same shape simulator.js produces
```

For `/api/actions` it imports `data/actions.js`, resolves the target, calls `request()` and executes the
result with its own credentials — so the set of possible commands is exactly the catalog, nothing free-form.
`/api/shell` is the one free-form endpoint (terminal); keep it behind the strongest auth or leave it out.

Credentials it needs: a Proxmox API token (`PVEAPIToken=root@pam!dashboard=…`), API keys for
Jellyfin, Seerr, Radarr, Sonarr, Prowlarr, Bazarr, Immich (admin), Paperless, the qBittorrent login,
and SSH or a local socket on the host for `shell` requests.

## Hosting on the homelab

```
VITE_HOMELAB_API=/api npm run build      # dist/homelab/ + dist/assets/
```

Serve `dist/` from Caddy (LXC 100) on a LAN-only name, put the backend behind `/api`, and add auth
(e.g. `forward_auth` to Authelia/Authentik, or at least `basic_auth`) — this page can reboot the server.
Don't add it to the router's port forward.
