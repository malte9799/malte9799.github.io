import { useState } from 'react';
import { useLang } from './i18n';
import { useCart } from './store';

export default function Checkout() {
  const { items, subtotal, shipping, total, clear } = useCart();
  const { t, money } = useLang();
  const [done, setDone] = useState(null);

  if (done)
    return (
      <section className="page narrow">
        <h1>{t('done.title')}</h1>
        <p>{t('done.text', { id: done })}</p>
        <p className="muted small">{t('done.demo')}</p>
        <a className="btn" href="#/">{t('done.back')}</a>
      </section>
    );
  if (!items.length)
    return (
      <section className="page narrow">
        <h1>{t('checkout.title')}</h1>
        <p className="muted">{t('cart.empty')}</p>
        <a className="btn" href="#/shop">{t('cart.browse')}</a>
      </section>
    );

  const submit = e => {
    e.preventDefault();
    setDone(`PC-${Math.floor(100000 + Math.random() * 900000)}`);
    clear();
  };

  return (
    <section className="page">
      <h1>{t('checkout.title')}</h1>
      <form className="checkout" onSubmit={submit}>
        <div className="form">
          <h2>{t('checkout.contact')}</h2>
          <input type="email" placeholder={t('checkout.email')} required />
          <h2>{t('checkout.delivery')}</h2>
          <div className="row2">
            <input placeholder={t('checkout.first')} required />
            <input placeholder={t('checkout.last')} required />
          </div>
          <input placeholder={t('checkout.street')} required />
          <div className="row2">
            <input placeholder={t('checkout.zip')} required />
            <input placeholder={t('checkout.city')} required />
          </div>
          <select defaultValue="DE" aria-label={t('checkout.country')}>
            {['DE', 'AT', 'CH'].map(c => (
              <option key={c} value={c}>{t('country.' + c)}</option>
            ))}
          </select>
          <h2>{t('checkout.payment')}</h2>
          <input placeholder={t('checkout.card')} inputMode="numeric" required />
          <div className="row2">
            <input placeholder={t('checkout.exp')} required />
            <input placeholder={t('checkout.cvc')} required />
          </div>
          <label className="check small">
            <input type="checkbox" required />
            <span>
              {t('checkout.accept1')}<a href="#/info/terms">{t('checkout.terms')}</a>
              {t('checkout.and')}<a href="#/info/privacy">{t('checkout.privacy')}</a>{t('checkout.dot')}
            </span>
          </label>
          <button className="btn wide">{t('checkout.place')} · {money(total)}</button>
          <p className="muted small">{t('checkout.demo')}</p>
        </div>
        <aside className="summary">
          <h2>{t('checkout.summary')}</h2>
          <ul className="lines">
            {items.map(l => (
              <li key={l.slug + l.finish}>
                <img src={l.product.src} alt="" />
                <div>
                  <span>{l.product.name}</span>
                  <p className="muted small">{t('finish.' + l.finish)} · {t('checkout.qty')} {l.qty}</p>
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
        </aside>
      </form>
    </section>
  );
}
