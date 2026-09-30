import { Clock3, Heart, Leaf, Star } from 'lucide-react';

const benefits = [
  {
    title: 'Lightning Fast',
    copy: 'From kitchen to doorstep with live ETAs and reliable riders.',
    icon: Clock3,
    tone: 'bg-qb-primary-soft text-qb-primary',
  },
  {
    title: 'Fresh & Hygienic',
    copy: 'Partner kitchens you can trust — prepared when you order.',
    icon: Leaf,
    tone: 'bg-qb-success-soft text-qb-success',
  },
  {
    title: 'Local Restaurants',
    copy: 'Discover neighbourhood favourites and regional specialties.',
    icon: Heart,
    tone: 'bg-qb-forest text-qb-forest-fg',
  },
  {
    title: 'Great Offers',
    copy: 'App-only deals, festival specials, and everyday value.',
    icon: Star,
    tone: 'bg-qb-primary-soft text-qb-primary-dark',
  },
] as const;

export function WhyQuickBite() {
  return (
    <section className="qb-section border-y border-qb-border bg-qb-surface">
      <div className="qb-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="qb-eyebrow justify-center">Why QuickBite</p>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            More Than Just Food Delivery
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-qb-muted">
            One ecosystem for customers, kitchens, and delivery partners —
            built around speed, trust, and great local food.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ title, copy, icon: Icon, tone }) => (
            <article key={title} className="qb-card flex h-full flex-col p-6">
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <h3 className="mt-5 font-heading text-base font-semibold text-qb-primary">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-qb-muted">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
