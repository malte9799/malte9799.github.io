// Runs actions. With VITE_HOMELAB_API set (e.g. "/api" behind the same Caddy),
// it POSTs { action, target, params } to the backend, which holds the tokens
// and executes the request described in actions.js. Without it, everything is
// simulated against the mock store.

import { describeRequest, requestsOf } from './actions';
import { mockOutput, mockShell } from './mock-output';
import { event, store } from './simulator';

export const API = import.meta.env.VITE_HOMELAB_API || '';
export const MODE = API ? 'live' : 'mock';

const wait = ms => new Promise(r => setTimeout(r, ms));

/** Returns { ok, lines }. Links are opened by the caller, not here. */
export async function execute(action, target, e, params) {
  if (MODE === 'live') {
    // Files (Paperless upload) go as multipart next to the JSON payload.
    const files = Object.entries(params ?? {}).filter(([, v]) => v instanceof File);
    const payload = JSON.stringify({ action: action.id, target, params: stripFiles(params) });
    let body = payload;
    if (files.length) {
      body = new FormData();
      body.append('payload', payload);
      for (const [k, f] of files) body.append(k, f);
    }
    const res = await fetch(`${API}/actions`, {
      method: 'POST',
      headers: files.length ? {} : { 'Content-Type': 'application/json' },
      credentials: 'include',
      body,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false, lines: data.lines ?? [res.ok ? 'OK' : `HTTP ${res.status}`] };
  }

  const reqs = requestsOf(action, e, params);
  await wait(500 + Math.random() * 1200);
  const lines = mockOutput(action, e, params, store.getSnapshot()) ?? reqs.map(r => `${describeRequest(r, e).text.split('\n')[0]} → ${r.via === 'proxmox' ? 'UPID:pve:000F' + Math.floor(Math.random() * 1e4).toString(16).toUpperCase() + ':OK' : r.via === 'api' ? '200 OK' : 'exit 0'}`);
  store.mutate(s => {
    action.effect?.(s, e, params ?? {});
    event(s, 'you', `${action.label} · ${e.title}`, 'good');
  });
  return { ok: true, lines };
}

/** One command typed into the terminal. */
export async function shell(where, cmd) {
  if (MODE === 'live') {
    const res = await fetch(`${API}/shell`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ target: where, cmd }) });
    const data = await res.json().catch(() => ({}));
    return data.lines ?? [`HTTP ${res.status}`];
  }
  await wait(120 + Math.random() * 250);
  return mockShell(cmd, where, store.getSnapshot());
}

function stripFiles(params) {
  if (!params) return params;
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v instanceof File ? { name: v.name, size: v.size } : v]));
}
