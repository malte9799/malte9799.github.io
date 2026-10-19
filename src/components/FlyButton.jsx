// A link-button with a per-letter text roll and an
// icon that flies out and re-enters on hover. `dir` is the icon's exit direction.
import { forwardRef } from 'react';

const FlyButton = forwardRef(function FlyButton({ className = '', children, icon, dir = 'right', ...props }, ref) {
  const letters = [...String(children)];
  return (
    <a ref={ref} className={`fly-btn ${className}`} data-dir={dir} {...props}>
      <span className="fly-label" aria-label={children}>
        {letters.map((ch, i) => (
          <span key={i} className="fly-letter" aria-hidden="true" style={{ '--i': i }}>
            <span>{ch === ' ' ? ' ' : ch}</span>
            <span>{ch === ' ' ? ' ' : ch}</span>
          </span>
        ))}
      </span>
      {icon && (
        <span className="fly-icon" aria-hidden="true">
          <span>{icon}</span>
          <span>{icon}</span>
        </span>
      )}
    </a>
  );
});

export default FlyButton;
