import { DISKS, LXCS, STORAGE } from '../data/inventory';
import { Meter, Sparkline, Status, fmtBytes, fmtDuration, fmtGB, level } from '../charts';
import { Card } from './Hardware';
import { ActionMenu } from '../ui/Actions';

const DOT = { running: 'good', degraded: 'warning', restarting: 'warning', starting: 'warning', stopped: 'critical' };

const KIND_LABEL = { docker: 'docker', systemd: 'systemd', native: 'native' };

export function LxcGrid({ state, onSelect, selected }) {
  return (
    <div className="hl-lxc-grid">
      {LXCS.map(c => {
        const live = state.lxc[c.id];
        const degraded = c.services.filter(s => state.services[s.id].status !== 'running');
        const off = live.status === 'stopped';
        return (
          <section key={c.id} className={`hl-card hl-lxc-card${selected === `lxc${c.id}` ? ' is-selected' : ''}`}>
            <header className="hl-card-head">
              <button className="hl-lxc-link" onClick={() => onSelect(`lxc${c.id}`)}>
                <span className="hl-lxc-num">{c.id}</span>
                <span>
                  <h3>{c.name}</h3>
                  <p>{c.role}</p>
                </span>
              </button>
              <div className="hl-head-actions">
                <Status status={off ? 'critical' : degraded.length ? 'warning' : 'good'} label={off ? 'stopped' : degraded.length ? `${degraded.length} not healthy` : 'running'} />
                <ActionMenu target={{ type: 'lxc', id: c.id }} />
              </div>
            </header>
            <div className="hl-lxc-stats">
              <div>
                <span>CPU · {c.cores} cores</span>
                <b>{live.cpu.toFixed(1)}%</b>
                <Meter value={live.cpu} thin label="CPU" />
              </div>
              <div>
                <span>RAM · {fmtBytes(c.ram)}</span>
                <b>{fmtBytes(live.mem)}</b>
                <Meter value={live.mem} max={c.ram} thin label="RAM" />
              </div>
              <div>
                <span>Uptime</span>
                <b>{fmtDuration(live.uptime)}</b>
                <small>{c.ip}</small>
              </div>
            </div>
            <table className="hl-svc-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Type</th>
                  <th className="is-num">CPU</th>
                  <th className="is-num">RAM</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {c.services.map(s => {
                  const sv = state.services[s.id];
                  return (
                    <tr key={s.id} onClick={() => onSelect(s.id)} className={selected === s.id ? 'is-selected' : ''}>
                      <td>
                        <span className={`hl-dot-html is-${DOT[sv.status]}`} aria-label={sv.status} />
                        <b>{s.name}</b>
                        {sv.status !== 'running' && <span className={`hl-state is-${DOT[sv.status]}`}>{sv.status}</span>}
                        {s.port && <span className="hl-port">:{s.port}</span>}
                        <small>{s.detail}</small>
                      </td>
                      <td>
                        <span className={`hl-kind is-${s.kind}`}>{KIND_LABEL[s.kind]}</span>
                      </td>
                      <td className="is-num">{sv.cpu.toFixed(1)}%</td>
                      <td className="is-num">{fmtBytes(sv.mem)}</td>
                      <td className="hl-row-act" onClick={ev => ev.stopPropagation()}>
                        <ActionMenu target={{ type: 'svc', id: s.id }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

export function StorageCard({ scrub = {} }) {
  return (
    <Card title="ZFS pools" sub="Capacity by dataset">
      <div className="hl-pools">
        {STORAGE.map(p => {
          const pct = (p.used / p.size) * 100;
          const sc = scrub[p.id];
          return (
            <div key={p.id} className="hl-pool">
              <div className="hl-pool-top">
                <b>{p.id}</b>
                <span>{p.layout}</span>
                <span className="hl-pool-num">
                  {fmtGB(p.used)} / {fmtGB(p.size)}
                </span>
                <ActionMenu target={{ type: 'pool', id: p.id }} />
              </div>
              {sc && !sc.done && (
                <div className="hl-row-meter">
                  <span>Scrub</span>
                  <Meter value={sc.progress * 100} warn={101} crit={101} thin label="Scrub progress" />
                  <b>{(sc.progress * 100).toFixed(0)}%</b>
                </div>
              )}
              <Meter value={pct} warn={80} crit={90} label={`${p.id} used`} />
              <ul className="hl-datasets">
                {p.datasets.map(d => (
                  <li key={d.id}>
                    <span>{d.label}</span>
                    <code>{d.id}</code>
                    <b>{fmtGB(d.used)}</b>
                    <ActionMenu target={{ type: 'dataset', id: d.id }} className="is-hover" />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const hours = h => (h > 8760 ? `${(h / 8760).toFixed(1)} y` : `${h} h`);

export function DisksCard({ disks, tests = {} }) {
  return (
    <Card title="Disks & SMART" sub="Live temperature and throughput · SMART attributes from the last smartctl run" className="is-wide">
      <div className="hl-table-scroll">
        <table className="hl-disk-table">
          <thead>
            <tr>
              <th>Disk</th>
              <th>Health</th>
              <th className="is-num">Temp</th>
              <th>I/O (2 min)</th>
              <th className="is-num">Read / write</th>
              <th className="is-num">Power-on</th>
              <th>Attributes</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {DISKS.map(d => {
              const live = disks[d.id];
              const temp = level(live.temp, d.kind === 'NVMe' ? 65 : 45, d.kind === 'NVMe' ? 75 : 55);
              const io = live.readHist.map((r, i) => r + (live.writeHist[i] ?? 0));
              return (
                <tr key={d.id}>
                  <td>
                    <b>{d.model}</b>
                    <small>
                      /dev/{d.id} · {d.kind} · {fmtGB(d.size)} · {d.pool}
                    </small>
                  </td>
                  <td>
                    <Status status={d.smart.health} label={d.smart.health === 'good' ? 'PASSED' : 'Check'} />
                    {tests[d.id] && <small>{tests[d.id].kind} self-test running</small>}
                  </td>
                  <td className="is-num">
                    <span className={`hl-temp is-${temp}`}>{live.temp.toFixed(0)} °C</span>
                  </td>
                  <td className="hl-io-cell">
                    <Sparkline data={io} color="var(--series-1)" height={24} max={d.kind === 'NVMe' ? 200 : 260} />
                  </td>
                  <td className="is-num">
                    {live.read.toFixed(0)} / {live.write.toFixed(0)} MB/s
                  </td>
                  <td className="is-num">{hours(d.smart.powerOnHours)}</td>
                  <td>
                    <SmartAttrs d={d} />
                  </td>
                  <td className="hl-row-act">
                    <ActionMenu target={{ type: 'disk', id: d.id }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SmartAttrs({ d }) {
  const s = d.smart;
  const items =
    d.kind === 'NVMe'
      ? [
          ['Wear', `${s.wear}%`, s.wear > 80],
          ['Media errors', s.mediaErrors, s.mediaErrors > 0],
          ['Unsafe shutdowns', s.unsafeShutdowns, false],
        ]
      : [
          ['Reallocated', s.reallocated, s.reallocated > 0],
          ['Pending', s.pending, s.pending > 0],
          ['CRC errors', s.crc, s.crc > 10],
        ];
  return (
    <ul className="hl-attrs">
      {items.map(([k, v, bad]) => (
        <li key={k} className={bad ? 'is-bad' : ''}>
          {k} <b>{v}</b>
        </li>
      ))}
    </ul>
  );
}
