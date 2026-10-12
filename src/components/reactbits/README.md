# React Bits

Components in this folder are adapted from [React Bits](https://reactbits.dev)
by David Haz ([DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)),
licensed MIT + Commons Clause.

Local changes:
- `BlurText` takes an `as` prop for the wrapping tag; Tailwind classes replaced by inline styles.
- `ScrollReveal` renders valid markup (`<p>` > `<span>`) and scopes its GSAP
  triggers with `gsap.context`, so unmounting no longer kills every
  ScrollTrigger on the page.
- `ScrollVelocity` class names are prefixed with `rb-`.
