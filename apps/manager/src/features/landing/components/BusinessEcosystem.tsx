import { ArrowRight, Bike, Store, UserRound } from 'lucide-react';
import { DASHBOARD_URL } from '../config';

const roles = [
  {
    title: 'Customers',
    flow: ['Discover', 'Order', 'Track', 'Enjoy'],
    copy: 'Browse local kitchens, checkout fast, and follow every delivery live.',
    href: '#download',
    cta: 'Get the App',
    icon: UserRound,
  },
  {
    title: 'Restaurants',
    flow: ['Manage menu', 'Receive orders', 'Prepare', 'Grow'],
    copy: 'Run your kitchen from one dashboard — menu, orders, and performance.',
    href: DASHBOARD_URL,
    cta: 'Learn More',
    icon: Store,
  },
  {
    title: 'Delivery Partners',
    flow: ['Accept', 'Pick up', 'Deliver', 'Earn'],
    copy: 'Go online, take nearby jobs, and complete deliveries with live routes.',
    href: '#download',
    cta: 'Learn More',
    icon: Bike,
  },
] as const;

export function BusinessEcosystem() {
  return (
    <section id="business" className="qb-section scroll-mt-24 border-y border-qb-border bg-qb-surface">
      <div className="qb-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="qb-eyebrow justify-center">Business ecosystem</p>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            One platform. Everyone connected.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-qb-muted">
            QuickBite links customers, restaurant teams, and delivery partners
            on a single realtime stack — so every order moves cleanly from
            kitchen to doorstep.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {roles.map(({ title, flow, copy, href, cta, icon: Icon }) => (
            <article key={title} className="qb-card flex h-full flex-col p-7">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-qb-primary-soft text-qb-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-semibold text-qb-primary">{title}</h3>
              <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-bold text-qb-primary">
                {flow.map((step, i) => (
                  <span key={step} className="inline-flex items-center gap-1.5">
                    {i > 0 ? <span className="text-qb-muted/50">→</span> : null}
                    {step}
                  </span>
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-qb-muted">{copy}</p>
              <a
                href={href}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-qb-primary transition hover:text-qb-primary-dark"
              >
                {cta}
                <ArrowRight className="h-4 w-4" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
