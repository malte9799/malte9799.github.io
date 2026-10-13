import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { MEDIA_STAGES, SCAN_STAGES } from '../data/inventory';
import { Meter, Status } from '../charts';
import { Card } from './Hardware';
import { ActionMenu, useActions } from '../ui/Actions';
import Icon from '../ui/Icon';

const fileName = j => `scan_${j.id.slice(4).padStart(4, '0')}.pdf`;

function Pipeline({ stages, jobs, renderJob, onStage, label, jobType }) {
  const busy = new Set(jobs.map(j => j.stage));
  return (
    <LayoutGroup id={label}>
      <ol className="hl-pipe" style={{ '--n': stages.length }} aria-label={label}>
        {stages.map((st, i) => {
          const here = jobs.filter(j => j.stage === i);
          const done = i === stages.length - 1;
          return (
            <li key={st.id} className={`hl-pipe-stage${busy.has(i) ? ' is-busy' : ''}${done ? ' is-done' : ''}`}>
              <button className="hl-pipe-head" onClick={() => onStage?.(st.where)} title={`Show ${st.where} on the map`}>
                <span className="hl-pipe-num">{i + 1}</span>
                <span className="hl-pipe-label">{st.label}</span>
                <span className="hl-pipe-sub">{st.sub}</span>
              </button>
              {i < stages.length - 1 && <span className={`hl-pipe-arrow${busy.has(i) ? ' is-on' : ''}`} aria-hidden="true" />}
              <div className="hl-pipe-jobs">
                <AnimatePresence mode="popLayout">
                  {here.map(j => (
                    <motion.div
                      key={j.id}
                      layoutId={j.id}
                      className="hl-job"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                    >
                      {renderJob(j, st)}
                      {j.stalled && <div className="hl-job-stalled">waiting · {st.sub.split(' ')[0]} is not running</div>}
                      <ActionMenu target={{ type: jobType, id: j.id }} className="hl-job-menu" />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {here.length === 0 && <span className="hl-pipe-empty">—</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </LayoutGroup>
  );
}

export function ScanPipeline({ jobs, paperless, onSelect }) {
  const active = jobs.filter(j => j.stage < SCAN_STAGES.length - 1);
  const { open } = useActions();
  return (
    <Card
      title="Scanner → Paperless"
      sub="LXC 103 · scan-watcher.service picks up whatever the scanner drops on the SMB share"
      aside={
        <div className="hl-head-actions">
          {active.length ? <Status status="good" label={`${active.length} in progress`} /> : <Status status="idle" label="Waiting for a scan" />}
          <button className="hl-btn" onClick={() => open('scan.test', { type: 'svc', id: 'scan-watcher' })}>
            <Icon name="play" /> Test scan
          </button>
          <ActionMenu target={{ type: 'svc', id: 'paperless' }} />
        </div>
      }
      className="is-wide"
    >
      <Pipeline
        jobType="scanJob"
        label="Scan pipeline"
        stages={SCAN_STAGES}
        jobs={jobs}
        onStage={onSelect}
        renderJob={(j, st) => (
          <>
            <div className="hl-job-title">{st.id === 'ingest' || st.id === 'done' ? j.name : fileName(j)}</div>
            <div className="hl-job-meta">
              {j.pages} page{j.pages > 1 ? 's' : ''}
              {st.id === 'done' && <span className="hl-tag">{j.tag}</span>}
              {st.id === 'convert' && ' · OCR deu+eng'}
            </div>
            {st.id !== 'done' && <Meter value={j.progress * 100} warn={101} crit={101} thin label="Stage progress" />}
          </>
        )}
      />
      <div className="hl-pipe-foot">
        <span>
          Paperless: <b>{paperless.docs.toLocaleString()}</b> documents · <b>{paperless.inbox}</b> in inbox
        </span>
        <code>inotifywait /scans/inbox → img2pdf → ocrmypdf → /opt/paperless/consume</code>
      </div>
    </Card>
  );
}

export function MediaPipeline({ jobs, onSelect, qbit }) {
  const active = jobs.filter(j => j.stage < MEDIA_STAGES.length - 1);
  const { open } = useActions();
  return (
    <Card
      title="Request → Jellyfin"
      sub="LXC 101 · Seerr request travels through the *arr stack into the library"
      aside={
        <div className="hl-head-actions">
          {qbit?.paused ? <Status status="warning" label="Downloads paused" /> : active.length ? <Status status="good" label={`${active.length} active`} /> : <Status status="idle" label="Nothing requested" />}
          <button className="hl-btn is-primary" onClick={() => open('seerr.request', { type: 'svc', id: 'seerr' })}>
            <Icon name="plus" /> Request
          </button>
          <ActionMenu target={{ type: 'svc', id: 'qbit' }} />
        </div>
      }
      className="is-wide"
    >
      <Pipeline
        jobType="mediaJob"
        label="Media pipeline"
        stages={MEDIA_STAGES}
        jobs={jobs}
        onStage={onSelect}
        renderJob={(j, st) => (
          <>
            <div className="hl-job-title">{j.title}</div>
            <div className="hl-job-meta">
              {j.type === 'movie' ? 'Radarr' : 'Sonarr'} · {j.by}
              {st.id === 'download' && ` · ${(j.progress * 100).toFixed(0)}% · ${(j.speed * 1000 * 0.1).toFixed(0)} MB/s`}
              {st.id === 'done' && ` · ${j.size.toFixed(1)} GB`}
            </div>
            {st.id !== 'done' && <Meter value={j.progress * 100} warn={101} crit={101} thin label="Stage progress" />}
          </>
        )}
      />
    </Card>
  );
}

export function StreamsCard({ streams }) {
  return (
    <Card
      title="Now playing"
      sub="Jellyfin sessions"
      aside={
        <div className="hl-head-actions">
          <span className="hl-big">{streams.length}</span>
          <ActionMenu target={{ type: 'svc', id: 'jellyfin' }} />
        </div>
      }
    >
      {streams.length === 0 && <p className="hl-note">Nobody is watching right now.</p>}
      <ul className="hl-streams">
        <AnimatePresence initial={false}>
          {streams.map(s => (
            <motion.li key={s.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="hl-stream-top">
                <b>{s.title}</b>
                <span className="hl-head-actions">
                  <span className={`hl-tag${s.transcode ? ' is-accent' : ''}`}>{s.transcode ? 'Transcode' : 'Direct'}</span>
                  <ActionMenu target={{ type: 'stream', id: s.id }} />
                </span>
              </div>
              <div className="hl-job-meta">
                {s.user} · {s.device} · {s.res} · {s.bitrate.toFixed(0)} Mb/s{s.paused ? ' · paused' : ''}
              </div>
              <div className="hl-job-meta">{s.codec}</div>
              <Meter value={s.progress * 100} warn={101} crit={101} thin label="Playback position" />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Card>
  );
}

export function ImmichCard({ immich }) {
  const rows = [
    ['Thumbnails', immich.queue.thumbnails],
    ['Metadata', immich.queue.metadata],
    ['Face detection', immich.queue.faces],
    ['Smart search (CLIP)', immich.queue.smartSearch],
  ];
  const max = Math.max(20, ...rows.map(r => r[1]));
  return (
    <Card
      title="Immich jobs"
      sub="LXC 102 · ML on the Arc via OpenVINO"
      aside={
        <div className="hl-head-actions">
          <span className="hl-big">{immich.assets.toLocaleString()}</span>
          <ActionMenu target={{ type: 'svc', id: 'immich-server' }} />
        </div>
      }
    >
      <ul className="hl-queue">
        {rows.map(([k, v]) => (
          <li key={k}>
            <span>{k}</span>
            <div className="hl-queue-bar">
              <div style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <b>{immich.paused?.all ? 'paused' : v || 'idle'}</b>
          </li>
        ))}
      </ul>
      <p className="hl-note">{immich.uploadsToday} uploads today · assets in library shown top right</p>
    </Card>
  );
}
