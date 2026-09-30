import type { ReactNode } from 'react';

const capabilities = [
  'Tell RIO what you’re craving — mood, spice level, or cuisine.',
  'Discover dishes and restaurants grounded in the live menu.',
  'Get recommendations tailored to your tastes and timing.',
  'Help placing orders, tracking deliveries, and support.',
] as const;

export function RioSection() {
  return (
    <section className="qb-section">
      <div className="qb-container">
        <div className="overflow-hidden rounded-[1.75rem] bg-qb-forest text-qb-forest-fg shadow-card">
          <div className="grid items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:px-14 lg:py-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-qb-forest-fg/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-qb-forest-fg/85">
                <span className="h-1.5 w-1.5 rounded-full bg-qb-primary" />
                AI assistant
              </p>
              <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-qb-forest-fg sm:text-4xl">
                Meet RIO — your personal food assistant.
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-qb-forest-fg/75">
                Tell RIO what you’re craving. RIO can discover food, recommend
                dishes, help place orders, track your delivery, and assist with
                support — right inside the QuickBite app.
              </p>

              <ul className="mt-8 space-y-3.5">
                {capabilities.map((line) => (
                  <li
                    key={line}
                    className="flex gap-3 text-sm leading-relaxed text-qb-forest-fg/85"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-qb-primary" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-6 rounded-[2rem] bg-qb-primary/20 blur-3xl" />
              <div className="relative rounded-[1.5rem] border border-qb-forest-fg/12 bg-qb-text/25 p-5 backdrop-blur-sm sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <img
                    src="/rio-mark.png"
                    alt=""
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-qb-forest-fg/20"
                  />
                  <div>
                    <p className="font-heading text-sm font-semibold text-qb-forest-fg">RIO</p>
                    <p className="text-xs text-qb-forest-fg/60">Online · QuickBite assistant</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <ChatBubble mine>
                    Something spicy and quick for lunch near Campal?
                  </ChatBubble>
                  <ChatBubble>
                    Try Chicken Biryani at The Deccan Table — 4.4★, about 25–35
                    mins. Want me to add it to your cart?
                  </ChatBubble>
                  <ChatBubble mine>Yes, and track it when it’s out.</ChatBubble>
                  <ChatBubble>
                    Done. I’ll keep your order status updated and nudge you when
                    the rider is nearby.
                  </ChatBubble>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({
  children,
  mine = false,
}: {
  children: ReactNode;
  mine?: boolean;
}) {
  return (
    <div
      className={[
        'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
        mine
          ? 'ml-auto rounded-br-md bg-qb-primary text-white'
          : 'mr-auto rounded-bl-md bg-qb-forest-fg/10 text-qb-forest-fg/90',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
