import { AppFeatures } from './components/AppFeatures';
import { BusinessEcosystem } from './components/BusinessEcosystem';
import { FinalCta } from './components/FinalCta';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Navbar } from './components/Navbar';
import { RestaurantDiscovery } from './components/RestaurantDiscovery';
import { RioSection } from './components/RioSection';
import { WhyQuickBite } from './components/WhyQuickBite';

export default function App() {
  return (
    <div className="min-h-screen bg-qb-bg text-qb-text antialiased">
      <Navbar />
      <main>
        <Hero />
        <WhyQuickBite />
        <RestaurantDiscovery />
        <AppFeatures />
        <RioSection />
        <BusinessEcosystem />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
