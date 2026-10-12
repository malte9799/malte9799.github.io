import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { useLenis } from '../lib/useLenis';
import Hero from './Hero';
import Work from './Work';
import { Statement, Numbers, Marquee, Outro } from './Sections';

export default function Landing() {
  useLenis();

  return (
    <>
      <Nav page="/" />
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
