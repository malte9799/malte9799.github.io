import { HOST, LXCS } from '../data/inventory';
import { CoreBars, Gauge, Legend, LineChart, Meter, Sparkline, StackBar, fmtBytes, fmtRate } from '../charts';

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];

export function Card({ title, sub, aside, className = '', children }) {
  return (
    <section className={`hl-card ${className}`}>
      <header className="hl-card-head">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Kv({ items }) {
  return (
    <dl className="hl-kv">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CpuCard({ cpu }) {
  return (
    <Card title="CPU" sub={`${HOST.cpu.model} · ${HOST.cpu.cores}C/${HOST.cpu.threads}T`}>
      <div className="hl-gauges">
        <Gauge value={cpu.usage} warn={75} crit={92} display={`${cpu.usage.toFixed(0)}%`} label="Usage" sub={`${cpu.freq.toFixed(2)} GHz`} />
        <Gauge value={cpu.temp} max={100} warn={75} crit={88} display={`${cpu.temp.toFixed(0)}°`} label="Tctl" sub="k10temp" />
      </div>
      <LineChart series={[{ key: 'cpu', label: 'CPU', color: 'var(--series-1)', data: cpu.hist }]} max={100} unit="%" ariaLabel="CPU usage, last two minutes" />
      <CoreBars cores={cpu.cores} />
      <Kv
        items={[
          ['Load', cpu.load.map(l => l.toFixed(2)).join(' · ')],
          ['Temp trend', <Sparkline key="t" data={cpu.tempHist} color="var(--series-2)" height={18} />],
        ]}
      />
    </Card>
  );
}

export function GpuCard({ gpu, streams }) {
  const transcodes = streams.filter(s => s.transcode && !s.paused).length;
  return (
    <Card title="GPU" sub={`${HOST.gpu.model} · ${HOST.gpu.driver}`}>
      <div className="hl-gauges">
        <Gauge value={gpu.util} warn={80} crit={95} display={`${gpu.util.toFixed(0)}%`} label="Busy" sub={`${gpu.power.toFixed(0)} W`} />
        <Gauge value={gpu.temp} max={100} warn={78} crit={88} display={`${gpu.temp.toFixed(0)}°`} label="Temp" sub={gpu.fan ? `${gpu.fan} rpm` : 'fan stopped'} />
      </div>
      <LineChart
        series={[
          { key: 'video', label: 'Video (QSV)', color: 'var(--series-1)', data: gpu.videoHist },
          { key: 'all', label: 'Busiest engine', color: 'var(--series-2)', data: gpu.hist },
        ]}
        max={100}
        unit="%"
        ariaLabel="GPU engine utilisation, last two minutes"
      />
      <Legend
        items={[
          { label: 'Video (QSV)', color: 'var(--series-1)', value: `${gpu.video.toFixed(0)}%` },
          { label: 'Busiest engine', color: 'var(--series-2)', value: `${gpu.util.toFixed(0)}%` },
        ]}
      />
      <div className="hl-row-meter">
        <span>VRAM</span>
        <Meter value={gpu.vram} max={HOST.gpu.vram} label="VRAM" />
        <b>
          {gpu.vram.toFixed(1)} / {HOST.gpu.vram} GiB
        </b>
      </div>
      <Kv
        items={[
          ['Render / 3D', `${gpu.render.toFixed(0)}%`],
          ['Transcodes', `${transcodes} active`],
          ['Passed to', 'LXC 101 media · 102 immich'],
        ]}
      />
    </Card>
  );
}

export function MemoryCard({ ram, lxc }) {
  const total = HOST.ram * 1024;
  const segments = [
    ...LXCS.map((c, i) => ({ label: `${c.id} ${c.name}`, value: lxc[c.id].mem, color: SERIES[i] })),
    { label: 'ZFS ARC', value: ram.arc, color: 'var(--series-5)' },
    { label: 'Host', value: 2400, color: 'var(--neutral-seg)' },
  ];
  const used = segments.reduce((a, s) => a + s.value, 0);
  return (
    <Card title="Memory" sub={`${HOST.ram} GiB DDR4 · ${HOST.swap} GiB swap`} aside={<span className="hl-big">{((used / total) * 100).toFixed(0)}%</span>}>
      <StackBar segments={segments} total={total} format={fmtBytes} />
      <Legend items={segments.map(s => ({ label: s.label, color: s.color, value: fmtBytes(s.value) }))} />
      <LineChart series={[{ key: 'ram', label: 'Used', color: 'var(--series-1)', data: ram.hist.map(v => v / 1024) }]} max={HOST.ram} unit=" GiB" format={v => v.toFixed(1)} height={110} ariaLabel="Memory used, last two minutes" />
      <p className="hl-note">ARC is reclaimable cache — the kernel shrinks it when containers need memory.</p>
    </Card>
  );
}

export function NetworkCard({ net, power, caddy }) {
  return (
    <Card title="Network & power" sub={`${HOST.nic.name} · ${HOST.nic.speed / 1000} GbE · ${HOST.ip}`}>
      <LineChart
        series={[
          { key: 'rx', label: 'Down', color: 'var(--series-1)', data: net.rxHist },
          { key: 'tx', label: 'Up', color: 'var(--series-2)', data: net.txHist },
        ]}
        unit=""
        format={fmtRate}
        ariaLabel="Network throughput, last two minutes"
      />
      <Legend
        items={[
          { label: 'Down', color: 'var(--series-1)', value: fmtRate(net.rx) },
          { label: 'Up', color: 'var(--series-2)', value: fmtRate(net.tx) },
        ]}
      />
      <div className="hl-tiles">
        <div className="hl-tile">
          <span>Power draw</span>
          <b>{power.watts.toFixed(0)} W</b>
          <Sparkline data={power.hist} color="var(--series-3)" height={22} />
        </div>
        <div className="hl-tile">
          <span>Caddy</span>
          <b>{caddy.rps.toFixed(1)} req/s</b>
          <small>TLS cert renews in {caddy.certDays} d</small>
        </div>
      </div>
    </Card>
  );
}
