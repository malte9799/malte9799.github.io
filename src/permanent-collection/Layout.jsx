import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PRODUCTS } from './items';
import Contact from '../components/Contact';
import FlyButton from '../components/FlyButton';
import { ArrowRight } from '../components/Icons';
import { STRINGS } from '../i18n/strings';
import { CONTACT_EMAIL } from '../data/contact';
import { useLang } from './i18n';
import { FREE_SHIPPING_FROM, useCart } from './store';

export function Header({ home }) {
  const { count, setOpen } = useCart();
  const { t, lang, setLang } = useLang();
  const [search, setSearch] = useState(false);
  return (
    <>
      <header className={`header${home ? ' on-home' : ''}`}>
        <a className="logo" href="#/">The Permanent Collection</a>
        <nav>
          <a href="#/shop">{t('nav.shop')}</a>
          <a href="#/shop?cat=Chair">{t('nav.chairs')}</a>
          <a href="#/shop?cat=Stool">{t('nav.stools')}</a>
          <a href="#/about">{t('nav.about')}</a>
        </nav>
        <div className="header-actions">
          <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} aria-label="Language">
            <span className={lang === 'en' ? 'on' : ''}>EN</span> / <span className={lang === 'de' ? 'on' : ''}>DE</span>
          </button>
          <button onClick={() => setSearch(true)}>{t('nav.search')}</button>
          <button onClick={() => setOpen(true)}>{t('nav.cart')} ({count})</button>
        </div>
      </header>
      <AnimatePresence>{search && <Search onClose={() => setSearch(false)} />}</AnimatePresence>
    </>
  );
}

function Search({ onClose }) {
  const { t, lang, money } = useLang();
  const [q, setQ] = useState('');
  const input = useRef(null);
  useEffect(() => {
    input.current?.focus();
    const esc = e => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? PRODUCTS.filter(p => `${p.name} ${t('cat1.' + p.category)} ${p.material[lang]}`.toLowerCase().includes(s)).slice(0, 8)
      : [];
  }, [q, t, lang]);
  return (
    <motion.div className="overlay search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="close" onClick={onClose}>{t('search.close')}</button>
      <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder={t('search.placeholder')} />
      <ul>
        {hits.map(p => (
          <li key={p.slug}>
            <a href={`#/product/${p.slug}`} onClick={onClose}>
              <img src={p.src} alt="" />
              <span>{p.name}</span>
              <span>{money(p.price)}</span>
            </a>
          </li>
        ))}
        {q && !hits.length && <li className="muted">{t('search.none', { q })}</li>}
      </ul>
    </motion.div>
  );
}

export function CartDrawer() {
  const { open, setOpen, items, subtotal, shipping, total, setQty, remove } = useCart();
  const { t, money } = useLang();
  const left = Math.max(0, FREE_SHIPPING_FROM - subtotal);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            className="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          >
            <div className="drawer-head">
              <h2>{t('cart.title')}</h2>
              <button onClick={() => setOpen(false)}>{t('cart.close')}</button>
            </div>
            {items.length ? (
              <>
                <p className="muted small">{left > 0 ? t('cart.toFree', { amount: money(left) }) : t('cart.free')}</p>
                <ul className="lines">
                  {items.map(l => (
                    <li key={l.slug + l.finish}>
                      <img src={l.product.src} alt="" />
                      <div>
                        <a href={`#/product/${l.slug}`} onClick={() => setOpen(false)}>{l.product.name}</a>
                        <p className="muted small">{t('finish.' + l.finish)}</p>
                        <div className="qty">
                          <button onClick={() => setQty(l.slug, l.finish, l.qty - 1)}>−</button>
                          <span>{l.qty}</span>
                          <button onClick={() => setQty(l.slug, l.finish, l.qty + 1)}>+</button>
                          <button className="link" onClick={() => remove(l.slug, l.finish)}>{t('cart.remove')}</button>
                        </div>
                      </div>
                      <span>{money(l.product.price * l.qty)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="totals">
                  <div><dt>{t('cart.subtotal')}</dt><dd>{money(subtotal)}</dd></div>
                  <div><dt>{t('cart.shipping')}</dt><dd>{shipping ? money(shipping) : t('cart.freeLabel')}</dd></div>
                  <div className="grand"><dt>{t('cart.total')}</dt><dd>{money(total)}</dd></div>
                </dl>
                <a className="btn" href="#/checkout" onClick={() => setOpen(false)}>{t('cart.checkout')}</a>
              </>
            ) : (
              <div className="empty">
                <p>{t('cart.empty')}</p>
                <a className="btn ghost" href="#/shop" onClick={() => setOpen(false)}>{t('cart.browse')}</a>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// A wide, light-themed contact band that sits above the footer.
export function ContactBand() {
  const { lang } = useLang();
  return <Contact t={STRINGS[lang].contact} theme="light" wide />;
}

// A pill that stays in the corner on every page. It opens the first letter, which
// unfolds out of the pill.
export function FloatingContact() {
  const { lang } = useLang();
  const t = STRINGS[lang].contact;
  const letter = useRef(null);
  const pill = useRef(null);
  const open = e => {
    e.preventDefault();
    letter.current?.open(0, () => pill.current.getBoundingClientRect());
  };
  return (
    <div className="contact" data-theme="light" style={{ display: 'contents' }}>
      <FlyButton ref={pill} className="contact-btn contact-float" href={`mailto:${CONTACT_EMAIL}`} onClick={open} icon={<ArrowRight />}>
        {t.button}
      </FlyButton>
      <Contact ref={letter} t={t} theme="light" dialogOnly />
    </div>
  );
}

export function Footer() {
  const { t } = useLang();
  const [done, setDone] = useState(false);
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <h3>The Permanent Collection</h3>
          <p className="muted">{t('footer.about')}</p>
        </div>
        <div>
          <h4>{t('footer.shop')}</h4>
          <a href="#/shop">{t('footer.all')}</a>
          <a href="#/shop?cat=Chair">{t('cat.Chair')}</a>
          <a href="#/shop?cat=Armchair">{t('cat.Armchair')}</a>
          <a href="#/shop?cat=Stool">{t('cat.Stool')}</a>
        </div>
        <div>
          <h4>{t('footer.service')}</h4>
          <a href="#/info/shipping">{t('footer.shipping')}</a>
          <a href="#/info/returns">{t('footer.returns')}</a>
          <a href="#/info/care">{t('footer.care')}</a>
          <a href="#/info/contact">{t('footer.contact')}</a>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            setDone(true);
          }}
        >
          <h4>{t('footer.newsletter')}</h4>
          {done ? (
            <p className="muted">{t('footer.thanks')}</p>
          ) : (
            <div className="inline">
              <input type="email" required placeholder={t('footer.email')} />
              <button className="btn">{t('footer.join')}</button>
            </div>
          )}
        </form>
      </div>
      <div className="footer-base">
        <span>© 2026 The Permanent Collection</span>
        <span>
          <a href="#/info/legal">{t('footer.legal')}</a> · <a href="#/info/privacy">{t('footer.privacy')}</a> · <a href="#/info/terms">{t('footer.terms')}</a>
        </span>
      </div>
    </footer>
  );
}

export function CookieBanner() {
  const { t } = useLang();
  const [shown, setShown] = useState(() => {
    try {
      return !localStorage.getItem('pc-cookies');
    } catch {
      return true;
    }
  });
  if (!shown) return null;
  const close = () => {
    try {
      localStorage.setItem('pc-cookies', '1');
    } catch {}
    setShown(false);
  };
  return (
    <div className="cookies">
      <p>{t('cookies.text')}</p>
      <button className="btn ghost" onClick={close}>{t('cookies.ok')}</button>
    </div>
  );
}
