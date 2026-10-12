// A minimal Safari-style window around one or more screenshots. With several
// slides they are stacked and cross-faded; `index` picks the visible one.
export default function BrowserFrame({ url, slides, index = 0, eager = false }) {
  return (
    <div className="browser">
      <div className="browser-bar" aria-hidden="true">
        <div className="browser-dots">
          <span />
          <span />
          <span />
        </div>
        <div className="browser-url">{url}</div>
        <div className="browser-dots-spacer" />
      </div>
      <div className="browser-view">
        {slides.map((slide, i) => (
          <img
            key={slide.src}
            src={slide.src}
            alt={i === index ? slide.alt : ''}
            aria-hidden={i === index ? undefined : 'true'}
            className={i === index ? 'is-active' : undefined}
            loading={eager && i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            width="1600"
            height="900"
          />
        ))}
      </div>
    </div>
  );
}
