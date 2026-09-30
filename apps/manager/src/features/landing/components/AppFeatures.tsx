import { Check, CreditCard, MapPinned } from 'lucide-react';
import { StoreBadges } from './StoreBadges';

const features = [
  'Browse restaurants',
  'Order food',
  'Live order tracking',
  'Multiple payments',
  'Personalized recommendations',
  'RIO AI assistant',
] as const;

export function AppFeatures() {
  return (
    <section id="how-it-works" className="qb-section scroll-mt-24 bg-qb-surface">
      <div className="qb-container">
        <div className="overflow-hidden rounded-[1.75rem] border border-qb-border bg-linear-to-br from-qb-primary-soft via-qb-bg to-qb-surface shadow-soft">
          <div className="grid items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:px-14 lg:py-16">
            <div className="relative mx-auto w-full max-w-[22rem]">
              <div className="overflow-hidden rounded-[1.75rem] border-[6px] border-qb-text bg-qb-surface shadow-card">
                <img
                  src="/chicken_tikka.png"
                  alt="Chicken tikka dish in the QuickBite app"
                  className="aspect-[5/4] w-full object-cover"
                />
                <div className="space-y-3 p-5">
                  <div>
                    <p className="text-xs font-semibold text-qb-muted">The Deccan Table</p>
                    <h3 className="mt-1 font-heading text-xl font-bold">Chicken Tikka</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-qb-muted">
                    Chargrilled chicken tikka with mint chutney.
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-heading text-lg font-bold">₹279</span>
                    <span className="rounded-xl bg-qb-primary px-3.5 py-2 text-xs font-bold text-white">
                      Add to Cart
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -left-3 top-14 hidden rounded-2xl border border-qb-border bg-qb-surface px-3.5 py-2.5 shadow-card sm:block sm:-left-8">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-qb-primary-soft text-qb-primary">
                    <MapPinned className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-qb-muted">
                      Live Tracking
                    </p>
                    <p className="text-xs font-bold text-qb-text">Rider 8 mins away</p>
                  </div>
                </div>
              </div>

              <div className="absolute -right-2 bottom-24 hidden rounded-2xl border border-qb-border bg-qb-surface px-3.5 py-2.5 shadow-card sm:block sm:-right-6">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-qb-success-soft text-qb-success">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-qb-muted">
                      Payments
                    </p>
                    <p className="text-xs font-bold text-qb-text">UPI · Cards · COD</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="qb-eyebrow">Everything in one app</p>
              <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                Order Anytime, Anywhere
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-qb-muted">
                From craving to doorstep — browse, checkout, track, and get help
                without leaving QuickBite.
              </p>

              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {features.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-qb-border/80 bg-qb-surface/80 px-3.5 py-3 text-sm font-semibold"
                  >
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-qb-primary text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a href="#download" className="qb-btn-secondary">
                  Download the App
                </a>
                <StoreBadges />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
