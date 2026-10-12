// A minimal Safari-style window around a screenshot.
export default function BrowserFrame({ url, src, alt, eager = false }) {
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
        <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" width="1600" height="1000" />
      </div>
    </div>
  );
}
