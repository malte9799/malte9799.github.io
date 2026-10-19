import { useRoute } from './router';
import { CartProvider } from './store';
import { LangProvider } from './i18n';
import { CartDrawer, CookieBanner, Footer, Header } from './Layout';
import Gallery from './Gallery';
import Shop from './Shop';
import Product, { NotFound } from './Product';
import Checkout from './Checkout';
import { About, Info } from './Pages';

function Routes({ path, query }) {
  const [a, b] = path;
  if (!a) return <Gallery />;
  if (a === 'shop') return <Shop query={query} />;
  if (a === 'product' && b) return <Product key={b} slug={b} />;
  if (a === 'checkout') return <Checkout />;
  if (a === 'about') return <About />;
  if (a === 'info') return <Info page={b} />;
  return <NotFound />;
}

export default function App() {
  const { path, query } = useRoute();
  const home = !path.length;
  return (
    <LangProvider>
    <CartProvider>
      <Header home={home} />
      <Routes path={path} query={query} />
      {!home && <Footer />}
      <CartDrawer />
      <CookieBanner />
    </CartProvider>
    </LangProvider>
  );
}
