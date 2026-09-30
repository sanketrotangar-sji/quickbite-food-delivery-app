import { ArrowRight } from 'lucide-react';
import { DASHBOARD_URL } from '../config';
import { StoreBadges } from './StoreBadges';

export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden bg-qb-bg">
      <div className="pointer-events-none absolute -left-40 top-10 h-[36rem] w-[36rem] rounded-full bg-qb-primary/[0.1] blur-3xl" />
      <div className="pointer-events-none absolute right-[-10%] top-[18%] h-[34rem] w-[34rem] rounded-full bg-qb-primary/[0.14] blur-3xl" />

      <div className="qb-container relative grid min-h-[calc(100svh-4.5rem)] items-center gap-8 py-12 lg:grid-cols-12 lg:gap-4 lg:py-10">
        <div className="relative z-10 lg:col-span-5">
          <p className="inline-flex items-center gap-2 rounded-full border border-qb-border bg-qb-surface/90 px-3.5 py-1.5 text-xs font-bold tracking-wide text-qb-muted shadow-soft backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-qb-primary" />
            Fast · Fresh · Reliable
          </p>

          <h1 className="mt-6 font-heading text-[2.85rem] font-bold leading-[1.04] tracking-tight sm:text-5xl xl:text-[3.55rem]">
            Good Food.
            <br />
            <span className="text-qb-primary">Brighter Days.</span>
          </h1>

          <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-qb-muted">
            Discover local restaurants, order your favourites, and track every
            delivery in real time.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#download" className="qb-btn-primary">
              Get the App
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href={DASHBOARD_URL} className="qb-btn-secondary">
              Go to Dashboard
            </a>
          </div>

          <StoreBadges className="mt-7" />
        </div>

        <div className="relative lg:col-span-7">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-qb-primary/15 blur-3xl" />
          <img
            src="/hero-mockup.png"
            alt="QuickBite app on a phone next to a fresh biryani bowl"
            className="relative z-[1] mx-auto w-full max-w-[40rem] scale-105 object-contain drop-shadow-[0_28px_60px_rgba(31,28,25,0.18)] lg:max-w-none lg:scale-110 lg:translate-x-4"
          />
        </div>
      </div>
    </section>
  );
}
