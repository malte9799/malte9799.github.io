import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { StatusIcon } from '../charts';
import { Card } from './Hardware';

const GROUPS = {
  all: { label: 'All', match: () => true },
  docs: { label: 'Documents', match: s => ['scanner', 'scan-watcher', 'paperless'].includes(s) },
  media: { label: 'Media', match: s => ['jellyfin', 'seerr', 'radarr', 'sonarr', 'qbittorrent', 'bazarr', 'prowlarr'].includes(s) },
  photos: { label: 'Photos', match: s => s === 'immich' },
  edge: { label: 'Edge', match: s => ['caddy', 'ddns-updater'].includes(s) },
};

const time = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export default function Events({ events }) {
  const [group, setGroup] = useState('all');
  const shown = events.filter(e => GROUPS[group].match(e.source)).slice(0, 30);
  return (
    <Card title="Activity" sub="Everything the services report, newest first" className="hl-events">
      <div className="hl-seg" role="tablist" aria-label="Filter activity">
        {Object.entries(GROUPS).map(([k, g]) => (
          <button key={k} role="tab" aria-selected={group === k} className={group === k ? 'is-on' : ''} onClick={() => setGroup(k)}>
            {g.label}
          </button>
        ))}
      </div>
      <ol className="hl-log" aria-live="polite">
        <AnimatePresence initial={false}>
          {shown.map(e => (
            <motion.li key={e.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <time>{time(e.t)}</time>
              <span className={`hl-log-src is-${e.level}`}>
                {e.level !== 'info' && <StatusIcon status={e.level} />}
                {e.source}
              </span>
              <span className="hl-log-text">{e.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {shown.length === 0 && <li className="hl-note">Nothing yet.</li>}
      </ol>
    </Card>
  );
}
