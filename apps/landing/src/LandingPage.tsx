import { useEffect } from "react";

import { AppFeatures } from "./components/AppFeatures";
import { BusinessEcosystem } from "./components/BusinessEcosystem";
import { FinalCta } from "./components/FinalCta";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Navbar } from "./components/Navbar";
import { RestaurantDiscovery } from "./components/RestaurantDiscovery";
import { RioSection } from "./components/RioSection";
import { WhyQuickBite } from "./components/WhyQuickBite";
import { setDashboardUrlOverride } from "./config";
import "./styles.css";

export type LandingPageProps = {
  /** Same-origin login when embedded in the dashboard. */
  dashboardUrl?: string;
};

export function LandingPage({ dashboardUrl }: LandingPageProps = {}) {
  useEffect(() => {
    if (dashboardUrl) setDashboardUrlOverride(dashboardUrl);
    return () => setDashboardUrlOverride(null);
  }, [dashboardUrl]);

  if (dashboardUrl) setDashboardUrlOverride(dashboardUrl);

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
