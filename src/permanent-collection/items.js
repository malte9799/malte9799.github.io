// Chair photos live in public/chairs (Pexels and Unsplash, see CREDITS.md there).
const base = import.meta.env.BASE_URL;

// [name, category, material (en), material (de)]
const DATA = [
  ['Wire Chair', 'Chair', 'Leather seat, chromed wire frame', 'Ledersitz, verchromtes Drahtgestell'],
  ['Shell Armchair', 'Armchair', 'Moulded polypropylene, steel base', 'Polypropylen, Stahlgestell'],
  ['Chrome Cantilever', 'Chair', 'Chrome-plated steel, leather seat', 'Verchromter Stahl, Ledersitz'],
  ['Blue Steel Chair', 'Chair', 'Powder-coated tubular steel, cork seat', 'Pulverbeschichteter Stahl, Korksitz'],
  ['Club Armchair', 'Armchair', 'Distressed leather, beech feet', 'Used-Look-Leder, Buchenfüße'],
  ['Cane Folding Chair', 'Chair', 'Beech frame, woven cane', 'Buchenrahmen, Rohrgeflecht'],
  ['Spindle Dining Chair', 'Chair', 'Reclaimed oak', 'Altholz-Eiche'],
  ['Plywood Chair', 'Chair', 'Moulded birch plywood', 'Geformtes Birkensperrholz'],
  ['Chesterfield Armchair', 'Armchair', 'Full-grain leather, brass studs', 'Vollnarbenleder, Messingnieten'],
  ['Moulded Side Chair', 'Chair', 'Fibreglass, oak legs', 'Glasfaser, Eichenbeine'],
  ['Ladder Chair', 'Chair', 'Oak, upholstered seat', 'Eiche, gepolsterter Sitz'],
  ['Sculpted Lounge', 'Lounge', 'Laminated ash', 'Geschichtete Esche'],
  ['Cross-Back Chair', 'Chair', 'Oak, upholstered seat', 'Eiche, gepolsterter Sitz'],
  ['Stacking Chair', 'Chair', 'Beech, steel', 'Buche, Stahl'],
  ['Chesterfield Armchair II', 'Armchair', 'Full-grain leather, brass studs', 'Vollnarbenleder, Messingnieten'],
  ['Bruno Chair', 'Chair', 'Solid beech', 'Massive Buche'],
  ['Fjord Armchair', 'Armchair', 'Velvet, solid beech legs', 'Samt, massive Buchenbeine'],
  ['Wedge Chair', 'Chair', 'Plywood, black steel', 'Sperrholz, schwarzer Stahl'],
  ['Reclaimed Bench', 'Stool', 'Reclaimed teak', 'Recyceltes Teakholz'],
  ['Cup Chair', 'Chair', 'Moulded shell, steel legs', 'Schale, Stahlbeine'],
  ['Elm Armchair', 'Armchair', 'Elm, rattan', 'Ulme, Rattan'],
  ['Round Armchair', 'Lounge', 'Wool blend, oak base', 'Wollmischung, Eichenfuß'],
  ['Reclaimed Bench II', 'Stool', 'Reclaimed teak, painted', 'Recyceltes Teakholz, lackiert'],
  ['Felt Stool', 'Stool', 'Wool felt, powder-coated steel', 'Wollfilz, pulverbeschichteter Stahl'],
  ['Walnut Dining Chair', 'Chair', 'Solid walnut, leather seat', 'Massivholz Nussbaum, Ledersitz'],
  ['Bar Stool', 'Stool', 'Natural beech', 'Natur-Buche'],
  ['Smoke Chair', 'Chair', 'Tinted acrylic, chrome', 'Getöntes Acryl, Chrom'],
  ['Chrome Stool', 'Stool', 'Chrome-plated steel, moulded seat', 'Verchromter Stahl, geformter Sitz'],
  ['Twin Bar Stools', 'Stool', 'Bentwood, lacquered', 'Bugholz, lackiert'],
  ['Panton Chair', 'Chair', 'Translucent polycarbonate', 'Transluzentes Polycarbonat'],
  ['Schoolhouse Chair', 'Chair', 'Steel, moulded plywood', 'Stahl, geformtes Sperrholz'],
  ['Panton Chair II', 'Chair', 'Translucent polycarbonate', 'Transluzentes Polycarbonat'],
  ['Lime Swivel Armchair', 'Armchair', 'Faux leather, chromed base', 'Kunstleder, verchromter Fuß'],
  ['Shell Stool', 'Stool', 'Moulded fibreglass, beech legs', 'Glasfaser, Buchenbeine'],
  ['Rosso Chair', 'Chair', 'Lacquered steel', 'Lackierter Stahl'],
  ['Parish Chair', 'Chair', 'Stained oak', 'Gebeizte Eiche'],
  ['Nursery Rocker', 'Lounge', 'Solid beech', 'Massive Buche'],
  ['Café Chair', 'Chair', 'Powder-coated steel', 'Pulverbeschichteter Stahl'],
  ['Spindle Rocker', 'Lounge', 'Solid beech', 'Massive Buche'],
  ['Matte Chair', 'Chair', 'Moulded shell, steel legs', 'Schale, Stahlbeine'],
  ['Folding Chair', 'Chair', 'Beech, black stain', 'Buche, schwarz gebeizt'],
  ['Director Chair', 'Chair', 'Beech, cotton canvas', 'Buche, Baumwolle'],
  ['Bentwood Chair No. 14', 'Chair', 'Steamed beech, cane seat', 'Gedämpfte Buche, Rohrgeflecht'],
  ['Rocking Chair', 'Lounge', 'Solid ash', 'Massive Esche'],
  ['Teak Lounge Armchair', 'Lounge', 'Teak, wool bouclé', 'Teak, Wollbouclé'],
  ['Birch Stool', 'Stool', 'Solid birch', 'Massive Birke'],
  ['Ant Chair', 'Chair', 'Moulded walnut veneer, steel', 'Formholz Nussbaum, Stahl'],
  ['Workshop Stool', 'Stool', 'Blackened steel', 'Brünierter Stahl'],
  ['Ant Chair II', 'Chair', 'Moulded walnut veneer, steel', 'Formholz Nussbaum, Stahl'],
  ['Director Chair II', 'Chair', 'Beech, cotton canvas', 'Buche, Baumwolle'],
];

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const PRODUCTS = DATA.map(([name, category, en, de], i) => ({
  slug: slugify(name),
  name,
  category,
  material: { en, de },
  price: 140 + ((i * 53) % 17) * 30,
  src: `${base}chairs/${String(i + 1).padStart(2, '0')}.jpg`,
}));

export const CATEGORIES = ['All', 'Chair', 'Armchair', 'Lounge', 'Stool'];
export const bySlug = slug => PRODUCTS.find(p => p.slug === slug);
