// 16px stroke icons for actions. Kept tiny on purpose: one path per name.
const PATHS = {
  open: 'M9 3h4v4M13 3 7 9M11 9v3.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5H7',
  terminal: 'M2.5 3.5h11v9h-11zM5 7l2 1.5L5 10M8.5 10.5H11',
  logs: 'M3 4h10M3 7h10M3 10h6M3 13h8',
  restart: 'M13 8a5 5 0 1 1-1.5-3.5M13 3v2.5h-2.5',
  refresh: 'M3 8a5 5 0 0 1 8.5-3.5L13 6M13 3v3h-3M13 8a5 5 0 0 1-8.5 3.5L3 10M3 13v-3h3',
  play: 'M5 3.5v9l7-4.5z',
  pause: 'M5.5 3.5v9M10.5 3.5v9',
  stop: 'M4 4h8v8H4z',
  power: 'M8 2.5V8M4.8 4.5a4.5 4.5 0 1 0 6.4 0',
  list: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01',
  info: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM8 7.5V11M8 5h.01',
  edit: 'M10.5 2.5 13.5 5.5 6 13H3v-3z',
  download: 'M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10',
  upload: 'M8 10.5v-8M4.5 6 8 2.5 11.5 6M3 13.5h10',
  archive: 'M2.5 3.5h11v3h-11zM3.5 6.5v6h9v-6M6.5 9h3',
  camera: 'M2.5 5h2.5l1-1.5h4L11 5h2.5v7.5h-11zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  undo: 'M5 6.5H10a3 3 0 0 1 0 6H6M5 6.5 7.5 4M5 6.5 7.5 9',
  sliders: 'M3 4.5h6M12 4.5h1M3 11.5h1M7 11.5h6M10.5 3v3M5.5 10v3',
  toggle: 'M5.5 4.5h5a3.5 3.5 0 0 1 0 7h-5a3.5 3.5 0 0 1 0-7ZM10.5 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  disk: 'M2.5 9.5 4 3.5h8l1.5 6v3h-11zM2.5 9.5h11M11 11h.01',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5',
  search: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM10.5 10.5 14 14',
  check: 'M3 8.5 6.5 12 13 4.5',
  message: 'M2.5 3.5h11v7.5H7l-3 2.5v-2.5H2.5z',
  plus: 'M8 3v10M3 8h10',
  gauge: 'M2.5 11a5.5 5.5 0 1 1 11 0M8 11l2.5-3.5',
  shield: 'M8 2 13 4v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z',
  spark: 'M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2',
  up: 'M8 13V3M4 7l4-4 4 4',
  globe: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM2 8h12M8 2c1.8 1.8 2.5 3.8 2.5 6S9.8 12.2 8 14C6.2 12.2 5.5 10.2 5.5 8S6.2 3.8 8 2Z',
  more: 'M3.5 8h.01M8 8h.01M12.5 8h.01',
  close: 'M4 4l8 8M12 4l-8 8',
  command: 'M6 6V4.5A1.5 1.5 0 1 0 4.5 6H6Zm0 0h4m-4 0v4m4-4V4.5A1.5 1.5 0 1 1 11.5 6H10Zm0 0v4m0 0h1.5a1.5 1.5 0 1 1-1.5 1.5V10Zm0 0H6m0 0v1.5A1.5 1.5 0 1 1 4.5 10H6Z',
  tasks: 'M3 4.5 4.5 6 7 3.5M3 10.5 4.5 12 7 9.5M9 5h4.5M9 11h4.5',
};

export default function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="hl-icon" fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 2.6 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}
