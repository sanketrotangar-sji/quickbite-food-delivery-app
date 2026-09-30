import { DASHBOARD_URL } from '../config';
import { StoreBadges } from './StoreBadges';

export function FinalCta() {
  return (
    <section id="download" className="qb-section scroll-mt-24 pt-10 lg:pt-14">
      <div className="qb-container">
        <div className="grid overflow-hidden rounded-[1.75rem] bg-qb-forest lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-qb-forest-fg sm:text-4xl">
              Good Food is Just a Click Away.
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-qb-forest-fg/75">
              Download QuickBite when the stores go live — or jump into the web
              dashboard if you already run with us.
            </p>

            <div className="mt-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-qb-forest-fg/55">
                Download QuickBite
              </p>
              <StoreBadges dark />
            </div>

            <p className="mt-8 text-sm text-qb-forest-fg/75">
              Already using QuickBite?{' '}
              <a
                href={DASHBOARD_URL}
                className="font-bold text-qb-forest-fg underline decoration-qb-forest-fg/35 underline-offset-4 transition hover:decoration-qb-forest-fg"
              >
                Dashboard Login
              </a>
            </p>
          </div>

          <div className="relative min-h-[240px] lg:min-h-full">
            <img
              src="/masala_dosa.png"
              alt="Masala dosa plated and ready to enjoy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-qb-forest via-qb-forest/35 to-transparent lg:bg-linear-to-l lg:via-qb-forest/50" />
          </div>
        </div>
      </div>
    </section>
  );
}
