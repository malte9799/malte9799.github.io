import { useEffect, useState } from 'react';

// Tiny hash router: "#/product/panton-chair?x=1" -> { path: ['product', 'panton-chair'], query }
const parse = () => {
  const [p, q = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { path: p.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(q)) };
};

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}
