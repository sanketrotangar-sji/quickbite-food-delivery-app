import { ArrowRight } from 'lucide-react';
import { DASHBOARD_URL } from '../config';
import { StoreBadges } from './StoreBadges';

export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-24 h-80 w-80 rounded-full bg-qb-primary/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-qb-forest/[0.08] blur-3xl" />

      <div className="qb-container grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-20 xl:gap-12">
        <div className="max-w-xl lg:max-w-none">
          <p className="inline-flex items-center gap-2 rounded-full border border-qb-border bg-white px-3.5 py-1.5 text-xs font-bold tracking-wide text-qb-muted shadow-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-qb-primary" />
            Fast · Fresh · Reliable
          </p>

          <h1 className="mt-6 font-heading text-[2.6rem] font-bold leading-[1.08] tracking-tight text-qb-charcoal sm:text-5xl lg:text-[3.35rem]">
            Good Food.
            <br />
            <span className="text-qb-primary">Brighter Days.</span>
          </h1>

          <p className="mt-2 font-script text-2xl text-qb-primary/90 sm:text-[1.75rem]">
            Order local. Track live. Enjoy more.
          </p>

          <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-qb-muted">
            Discover local restaurants, order your favourites, and track every
            delivery in real time — all in one QuickBite ecosystem.
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

        <div className="relative mx-auto w-full max-w-[34rem] lg:max-w-none">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-qb-primary/[0.12] blur-2xl" />
          <img
            src="/hero-mockup.png"
            alt="QuickBite app on a phone next to a fresh biryani bowl"
            className="relative z-[1] mx-auto w-full drop-shadow-[0_24px_50px_rgba(23,23,23,0.14)]"
          />
        </div>
      </div>
    </section>
  );
}
