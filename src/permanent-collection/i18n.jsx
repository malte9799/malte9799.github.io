import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STRINGS = {
  en: {
    'nav.shop': 'Shop', 'nav.chairs': 'Chairs', 'nav.stools': 'Stools', 'nav.about': 'About', 'nav.search': 'Search', 'nav.cart': 'Cart',
    'gallery.title1': 'The Permanent', 'gallery.title2': 'Collection',
    'gallery.hint': 'Drag or scroll to look around · click a piece to open it',
    'cat.All': 'All', 'cat.Chair': 'Chairs', 'cat.Armchair': 'Armchairs', 'cat.Lounge': 'Lounge', 'cat.Stool': 'Stools',
    'cat1.Chair': 'Chair', 'cat1.Armchair': 'Armchair', 'cat1.Lounge': 'Lounge', 'cat1.Stool': 'Stool',
    'shop.title': 'The Collection', 'shop.sort': 'Sort', 'shop.pieces': '{n} pieces',
    'sort.featured': 'Featured', 'sort.low': 'Price: low to high', 'sort.high': 'Price: high to low', 'sort.name': 'Name',
    'search.placeholder': 'Search chairs, stools, materials…', 'search.close': 'Close', 'search.none': 'No results for “{q}”.',
    'desc.Stool': 'A quiet, honest stool for kitchen islands, studios and corners that need a seat without a statement.',
    'desc.Lounge': 'A generous lounge piece with a low, easy posture. Made to be sat in for hours and looked at in between.',
    'desc.Chair': 'A considered seat with clean lines and a comfortable profile, equally at home at a dining table or a desk.',
    'desc.Armchair': 'A deep, welcoming armchair with a calm silhouette. Built to anchor a corner of the room.',
    'finish.Natural': 'Natural', 'finish.Charcoal': 'Charcoal', 'finish.Chalk': 'Chalk', 'product.finish': 'Finish',
    'product.add': 'Add to cart',
    'perk.ship': 'Free shipping from {amount}', 'perk.delivery': 'Delivery in 3–5 working days', 'perk.returns': '30 days to return', 'perk.warranty': '5 year warranty',
    'product.details': 'Details', 'product.material': 'Material', 'product.dimensions': 'Dimensions', 'product.seat': 'Seat height', 'product.weight': 'Weight',
    'product.shipping': 'Shipping & returns', 'product.shippingText': 'Ships from our warehouse in 1–2 working days. Free returns within 30 days, in original packaging.',
    'product.care': 'Care', 'product.careText': 'Wipe with a soft, damp cloth. Avoid direct heat and prolonged sunlight.',
    'product.reviews': 'Reviews', 'product.related': 'You may also like',
    'review.1': 'Beautiful proportions and very comfortable. Arrived well packed.',
    'review.2': 'Looks even better in person. The finish is subtle and feels high quality.',
    'review.3': 'Exactly what we wanted for the dining table.',
    'cart.title': 'Cart', 'cart.close': 'Close', 'cart.toFree': '{amount} to free shipping', 'cart.free': 'You have free shipping',
    'cart.remove': 'Remove', 'cart.subtotal': 'Subtotal', 'cart.shipping': 'Shipping', 'cart.freeLabel': 'Free', 'cart.total': 'Total',
    'cart.checkout': 'Checkout', 'cart.empty': 'Your cart is empty.', 'cart.browse': 'Browse the collection',
    'checkout.title': 'Checkout', 'checkout.contact': 'Contact', 'checkout.email': 'Email', 'checkout.delivery': 'Delivery',
    'checkout.first': 'First name', 'checkout.last': 'Last name', 'checkout.street': 'Street and number', 'checkout.zip': 'Postal code', 'checkout.city': 'City',
    'checkout.country': 'Country', 'country.DE': 'Germany', 'country.AT': 'Austria', 'country.CH': 'Switzerland',
    'checkout.payment': 'Payment', 'checkout.card': 'Card number', 'checkout.exp': 'MM / YY', 'checkout.cvc': 'CVC',
    'checkout.accept1': 'I accept the ', 'checkout.terms': 'terms', 'checkout.and': ' and the ', 'checkout.privacy': 'privacy policy', 'checkout.dot': '.',
    'checkout.place': 'Place order', 'checkout.demo': 'Demo only. Do not enter real payment details.', 'checkout.summary': 'Order summary', 'checkout.qty': 'Qty',
    'done.title': 'Thank you.', 'done.text': 'Your order {id} is confirmed. A confirmation email is on its way.',
    'done.demo': 'This is a concept store. No payment was taken and nothing will be shipped.', 'done.back': 'Back to the gallery',
    'footer.about': 'Considered seating, photographed in a quiet room. A concept store, not a real shop.',
    'footer.shop': 'Shop', 'footer.all': 'All pieces', 'footer.service': 'Service', 'footer.shipping': 'Shipping', 'footer.returns': 'Returns', 'footer.care': 'Care', 'footer.contact': 'Contact',
    'footer.newsletter': 'Newsletter', 'footer.email': 'Email address', 'footer.join': 'Join', 'footer.thanks': 'Thank you. You are on the list.',
    'footer.legal': 'Legal notice', 'footer.privacy': 'Privacy', 'footer.terms': 'Terms',
    'cookies.text': 'We only use essential storage (your cart). No tracking.', 'cookies.ok': 'OK',
    'about.title': 'About', 'about.lead': 'The Permanent Collection is a small archive of chairs and stools that are meant to outlast trends.',
    'about.p1': 'We pick pieces for proportion, honest materials and the way they age. Every item is photographed in a quiet room, without props.',
    'about.demo': 'This is a design experiment built with React and Motion. It is not a real shop.',
    'info.shipping': 'Shipping', 'info.shippingText': 'We ship within Germany, Austria and Switzerland. Orders over €500 ship free, otherwise €39. Delivery takes 3–5 working days.',
    'info.returns': 'Returns', 'info.returnsText': 'You can return any piece within 30 days in its original packaging. Refunds are issued to the original payment method within 7 days.',
    'info.care': 'Care', 'info.careText': 'Wipe with a soft, damp cloth. Keep away from direct heat and prolonged sunlight. Wooden pieces benefit from a little oil once a year.',
    'info.contact': 'Contact', 'info.contactText': 'hello@permanent-collection.example · Mon–Fri, 9–17 h',
    'info.legal': 'Legal notice', 'info.legalText': 'Placeholder legal notice for a concept store.',
    'info.privacy': 'Privacy', 'info.privacyText': 'This site stores only your cart in your browser. No tracking, no third-party cookies.',
    'info.terms': 'Terms', 'info.termsText': 'Placeholder terms and conditions for a concept store.',
    'nf.title': 'Page not found', 'nf.text': 'The page you are looking for does not exist.', 'nf.back': 'Back to the shop',
  },
  de: {
    'nav.shop': 'Shop', 'nav.chairs': 'Stühle', 'nav.stools': 'Hocker', 'nav.about': 'Über uns', 'nav.search': 'Suche', 'nav.cart': 'Warenkorb',
    'gallery.title1': 'Die Permanente', 'gallery.title2': 'Kollektion',
    'gallery.hint': 'Ziehen oder scrollen zum Umschauen · Stück anklicken zum Öffnen',
    'cat.All': 'Alle', 'cat.Chair': 'Stühle', 'cat.Armchair': 'Sessel', 'cat.Lounge': 'Lounge', 'cat.Stool': 'Hocker',
    'cat1.Chair': 'Stuhl', 'cat1.Armchair': 'Sessel', 'cat1.Lounge': 'Lounge', 'cat1.Stool': 'Hocker',
    'shop.title': 'Die Kollektion', 'shop.sort': 'Sortieren', 'shop.pieces': '{n} Stücke',
    'sort.featured': 'Empfohlen', 'sort.low': 'Preis: aufsteigend', 'sort.high': 'Preis: absteigend', 'sort.name': 'Name',
    'search.placeholder': 'Stühle, Hocker, Materialien suchen…', 'search.close': 'Schließen', 'search.none': 'Keine Ergebnisse für „{q}“.',
    'desc.Stool': 'Ein ruhiger, ehrlicher Hocker für Kücheninseln, Ateliers und Ecken, die einen Sitz ohne große Geste brauchen.',
    'desc.Lounge': 'Ein großzügiges Loungemöbel mit niedriger, entspannter Haltung. Zum stundenlangen Sitzen und zwischendurch Anschauen gemacht.',
    'desc.Chair': 'Ein durchdachter Sitz mit klaren Linien und bequemem Profil, am Esstisch ebenso zu Hause wie am Schreibtisch.',
    'desc.Armchair': 'Ein tiefer, einladender Sessel mit ruhiger Silhouette. Gemacht, um eine Ecke des Raums zu verankern.',
    'finish.Natural': 'Natur', 'finish.Charcoal': 'Anthrazit', 'finish.Chalk': 'Kreide', 'product.finish': 'Ausführung',
    'product.add': 'In den Warenkorb',
    'perk.ship': 'Kostenloser Versand ab {amount}', 'perk.delivery': 'Lieferung in 3–5 Werktagen', 'perk.returns': '30 Tage Rückgaberecht', 'perk.warranty': '5 Jahre Garantie',
    'product.details': 'Details', 'product.material': 'Material', 'product.dimensions': 'Maße', 'product.seat': 'Sitzhöhe', 'product.weight': 'Gewicht',
    'product.shipping': 'Versand & Rückgabe', 'product.shippingText': 'Versand aus unserem Lager in 1–2 Werktagen. Kostenlose Rückgabe innerhalb von 30 Tagen in der Originalverpackung.',
    'product.care': 'Pflege', 'product.careText': 'Mit einem weichen, feuchten Tuch abwischen. Direkte Hitze und lange Sonneneinstrahlung vermeiden.',
    'product.reviews': 'Bewertungen', 'product.related': 'Das könnte dir auch gefallen',
    'review.1': 'Wunderschöne Proportionen und sehr bequem. Gut verpackt angekommen.',
    'review.2': 'In echt noch schöner. Die Oberfläche ist dezent und wirkt hochwertig.',
    'review.3': 'Genau das, was wir für den Esstisch wollten.',
    'cart.title': 'Warenkorb', 'cart.close': 'Schließen', 'cart.toFree': 'Noch {amount} bis zum kostenlosen Versand', 'cart.free': 'Du erhältst kostenlosen Versand',
    'cart.remove': 'Entfernen', 'cart.subtotal': 'Zwischensumme', 'cart.shipping': 'Versand', 'cart.freeLabel': 'Kostenlos', 'cart.total': 'Gesamt',
    'cart.checkout': 'Zur Kasse', 'cart.empty': 'Dein Warenkorb ist leer.', 'cart.browse': 'Kollektion ansehen',
    'checkout.title': 'Kasse', 'checkout.contact': 'Kontakt', 'checkout.email': 'E-Mail', 'checkout.delivery': 'Lieferung',
    'checkout.first': 'Vorname', 'checkout.last': 'Nachname', 'checkout.street': 'Straße und Hausnummer', 'checkout.zip': 'Postleitzahl', 'checkout.city': 'Stadt',
    'checkout.country': 'Land', 'country.DE': 'Deutschland', 'country.AT': 'Österreich', 'country.CH': 'Schweiz',
    'checkout.payment': 'Zahlung', 'checkout.card': 'Kartennummer', 'checkout.exp': 'MM / JJ', 'checkout.cvc': 'CVC',
    'checkout.accept1': 'Ich akzeptiere die ', 'checkout.terms': 'AGB', 'checkout.and': ' und die ', 'checkout.privacy': 'Datenschutzerklärung', 'checkout.dot': '.',
    'checkout.place': 'Kostenpflichtig bestellen', 'checkout.demo': 'Nur Demo. Bitte keine echten Zahlungsdaten eingeben.', 'checkout.summary': 'Bestellübersicht', 'checkout.qty': 'Menge',
    'done.title': 'Vielen Dank.', 'done.text': 'Deine Bestellung {id} ist bestätigt. Eine Bestätigungs-E-Mail ist unterwegs.',
    'done.demo': 'Dies ist ein Konzept-Shop. Es wurde nichts abgebucht und nichts wird versendet.', 'done.back': 'Zurück zur Galerie',
    'footer.about': 'Durchdachte Sitzmöbel, fotografiert in einem ruhigen Raum. Ein Konzept-Shop, kein echter Shop.',
    'footer.shop': 'Shop', 'footer.all': 'Alle Stücke', 'footer.service': 'Service', 'footer.shipping': 'Versand', 'footer.returns': 'Rückgabe', 'footer.care': 'Pflege', 'footer.contact': 'Kontakt',
    'footer.newsletter': 'Newsletter', 'footer.email': 'E-Mail-Adresse', 'footer.join': 'Anmelden', 'footer.thanks': 'Danke. Du stehst auf der Liste.',
    'footer.legal': 'Impressum', 'footer.privacy': 'Datenschutz', 'footer.terms': 'AGB',
    'cookies.text': 'Wir nutzen nur notwendigen Speicher (dein Warenkorb). Kein Tracking.', 'cookies.ok': 'OK',
    'about.title': 'Über uns', 'about.lead': 'The Permanent Collection ist ein kleines Archiv aus Stühlen und Hockern, die Trends überdauern sollen.',
    'about.p1': 'Wir wählen Stücke nach Proportion, ehrlichen Materialien und danach, wie sie altern. Jedes Stück wird in einem ruhigen Raum fotografiert, ohne Requisiten.',
    'about.demo': 'Dies ist ein Design-Experiment mit React und Motion. Es ist kein echter Shop.',
    'info.shipping': 'Versand', 'info.shippingText': 'Wir liefern nach Deutschland, Österreich und in die Schweiz. Ab 500 € Bestellwert versandkostenfrei, sonst 39 €. Die Lieferung dauert 3–5 Werktage.',
    'info.returns': 'Rückgabe', 'info.returnsText': 'Du kannst jedes Stück innerhalb von 30 Tagen in der Originalverpackung zurückgeben. Erstattung auf die ursprüngliche Zahlungsart innerhalb von 7 Tagen.',
    'info.care': 'Pflege', 'info.careText': 'Mit einem weichen, feuchten Tuch abwischen. Von direkter Hitze und langer Sonneneinstrahlung fernhalten. Holzmöbel freuen sich einmal im Jahr über etwas Öl.',
    'info.contact': 'Kontakt', 'info.contactText': 'hello@permanent-collection.example · Mo–Fr, 9–17 Uhr',
    'info.legal': 'Impressum', 'info.legalText': 'Platzhalter-Impressum für einen Konzept-Shop.',
    'info.privacy': 'Datenschutz', 'info.privacyText': 'Diese Seite speichert nur deinen Warenkorb in deinem Browser. Kein Tracking, keine Cookies von Dritten.',
    'info.terms': 'AGB', 'info.termsText': 'Platzhalter-AGB für einen Konzept-Shop.',
    'nf.title': 'Seite nicht gefunden', 'nf.text': 'Die gesuchte Seite existiert nicht.', 'nf.back': 'Zurück zum Shop',
  },
};

const Ctx = createContext(null);
export const useLang = () => useContext(Ctx);

const initial = () => {
  try {
    const saved = localStorage.getItem('pc-lang');
    if (saved === 'de' || saved === 'en') return saved;
  } catch {}
  return /^de\b/i.test(navigator.language || '') ? 'de' : 'en';
};

export function LangProvider({ children }) {
  const [lang, setLang] = useState(initial);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('pc-lang', lang);
    } catch {}
  }, [lang]);
  const t = useCallback(
    (key, vars) => (STRINGS[lang][key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars?.[k] ?? ''),
    [lang]
  );
  const money = useCallback(
    n => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n),
    [lang]
  );
  const value = useMemo(() => ({ lang, setLang, t, money }), [lang, t, money]);
  return <Ctx value={value}>{children}</Ctx>;
}
