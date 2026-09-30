import { CONTACT_EMAIL, DASHBOARD_URL, NAV_LINKS } from '../config';

const supportLinks = [
  { label: 'Help & Support', href: `mailto:${CONTACT_EMAIL}` },
  { label: 'Track Order', href: '#download' },
  { label: 'Contact', href: `mailto:${CONTACT_EMAIL}` },
  { label: 'RIO', href: '#how-it-works' },
] as const;

const social = [
  { label: 'Email', href: `mailto:${CONTACT_EMAIL}` },
  { label: 'X', href: '#' },
  { label: 'LinkedIn', href: '#' },
  { label: 'YouTube', href: '#' },
] as const;

export function Footer() {
  return (
    <footer className="mt-4 bg-qb-charcoal text-white">
      <div className="qb-container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:pr-6">
          <a href="#home" className="flex items-center gap-2.5">
            <img src="/logo2.png" alt="" className="h-9 w-9 rounded-xl object-cover" />
            <span className="font-heading text-lg font-bold">
              Quick<span className="text-qb-primary">Bite</span>
            </span>
          </a>
          <p className="mt-4 font-script text-2xl text-qb-primary">
            Good Food. Brighter Days.
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
            Discover, order, and track — one platform for everyone connected.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold">Quick Links</h3>
          <ul className="mt-4 space-y-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="text-sm text-white/60 transition hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a href="#download" className="text-sm text-white/60 transition hover:text-white">
                Download App
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold">Support</h3>
          <ul className="mt-4 space-y-3">
            {supportLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="text-sm text-white/60 transition hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a href={DASHBOARD_URL} className="text-sm text-white/60 transition hover:text-white">
                For Business
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold">Follow Us</h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {social.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="inline-flex h-9 items-center rounded-full border border-white/12 px-3.5 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="qb-container flex flex-col gap-3 py-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} QuickBite. All rights reserved.</p>
          <div className="flex gap-5">
            <a href="#" className="transition hover:text-white">
              Privacy Policy
            </a>
            <a href="#" className="transition hover:text-white">
              Terms & Conditions
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
