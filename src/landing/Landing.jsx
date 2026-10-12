import { useMemo } from 'react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import ScrollRuler from '../components/ScrollRuler';
import { useLenis } from '../lib/useLenis';
import { useT } from '../i18n';
import Hero from './Hero';
import Work from './Work';
import { Statement, Numbers, Marquee, Outro } from './Sections';

export default function Landing() {
  useLenis();
  const labels = useT().ruler.landing;
  const rulerSections = useMemo(
    () => ['.hero', '.statement', '#work', '.numbers', '.outro'].map((selector, i) => ({ selector, label: labels[i] })),
    [labels]
  );

  return (
    <>
      <Nav page="/" />
      <ScrollRuler sections={rulerSections} />
      <main>
        <Hero />
        <Statement />
        <Work />
        <Numbers />
        <Marquee />
        <Outro />
      </main>
      <Footer />
    </>
  );
}
