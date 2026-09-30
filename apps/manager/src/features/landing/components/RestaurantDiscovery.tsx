import { ArrowRight, Clock3, Star } from 'lucide-react';
import { restaurants } from '../data/restaurants';

export function RestaurantDiscovery() {
  return (
    <section id="restaurants" className="qb-section scroll-mt-24">
      <div className="qb-container">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="qb-eyebrow">Explore</p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Top Restaurants in Your City
            </h2>
            <p className="mt-4 text-base leading-relaxed text-qb-muted">
              Browse curated kitchens on QuickBite — from South Indian classics
              to regional favourites — then order in a few taps.
            </p>
          </div>
          <a href="#download" className="qb-btn-primary shrink-0 self-start sm:self-auto">
            Explore Restaurants
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((r) => (
            <article key={r.name} className="qb-card group overflow-hidden">
              <div className="relative overflow-hidden">
                <img
                  src={r.image}
                  alt={r.name}
                  className="aspect-[16/11] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <span
                  className={[
                    'absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-qb-surface/95 px-2.5 py-1 text-[11px] font-bold shadow-soft',
                    r.veg ? 'text-qb-success' : 'text-qb-primary',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'h-2 w-2 rounded-full',
                      r.veg ? 'bg-qb-success' : 'bg-qb-primary',
                    ].join(' ')}
                  />
                  {r.veg ? 'Veg' : 'Non-Veg'}
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-heading text-[1.05rem] font-semibold text-qb-primary">{r.name}</h3>
                <p className="mt-1 text-sm text-qb-muted">{r.cuisine}</p>
                <div className="mt-4 flex items-center gap-4 border-t border-qb-border/80 pt-4 text-sm font-semibold">
                  <span className="inline-flex items-center gap-1.5 text-qb-text">
                    <Star className="h-3.5 w-3.5 fill-qb-primary text-qb-primary" />
                    {r.rating.toFixed(1)}
                    <span className="font-medium text-qb-muted">({r.reviews})</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-qb-muted">
                    <Clock3 className="h-3.5 w-3.5" />
                    {r.eta}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
