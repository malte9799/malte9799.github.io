import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { bySlug } from './items';

const KEY = 'pc-cart';
const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};

export const FREE_SHIPPING_FROM = 500;
export const SHIPPING = 39;

export function CartProvider({ children }) {
  const [lines, setLines] = useState(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {}
  }, [lines]);

  const value = useMemo(() => {
    const items = lines.map(l => ({ ...l, product: bySlug(l.slug) })).filter(l => l.product);
    const count = items.reduce((n, l) => n + l.qty, 0);
    const subtotal = items.reduce((n, l) => n + l.qty * l.product.price, 0);
    const shipping = !items.length || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING;
    return {
      items,
      count,
      subtotal,
      shipping,
      total: subtotal + shipping,
      open,
      setOpen,
      add: (slug, finish = 'Natural', qty = 1) => {
        setLines(ls => {
          const hit = ls.find(l => l.slug === slug && l.finish === finish);
          return hit ? ls.map(l => (l === hit ? { ...l, qty: l.qty + qty } : l)) : [...ls, { slug, finish, qty }];
        });
        setOpen(true);
      },
      setQty: (slug, finish, qty) =>
        setLines(ls => ls.map(l => (l.slug === slug && l.finish === finish ? { ...l, qty } : l)).filter(l => l.qty > 0)),
      remove: (slug, finish) => setLines(ls => ls.filter(l => !(l.slug === slug && l.finish === finish))),
      clear: () => setLines([]),
    };
  }, [lines, open]);

  return <Ctx value={value}>{children}</Ctx>;
}
