import { useEffect, useState } from 'react';
import { DASHBOARD_URL, NAV_LINKS } from '../config';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={[
        'sticky top-0 z-50 transition-[background,border-color,box-shadow]',
        scrolled
          ? 'border-b border-qb-border/90 bg-qb-bg/95 shadow-soft backdrop-blur-md'
          : 'border-b border-transparent bg-qb-bg/80 backdrop-blur-sm',
      ].join(' ')}
    >
      <div className="qb-container flex h-[4.25rem] items-center justify-between gap-6">
        <a href="#home" className="flex shrink-0 items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-9 w-9 rounded-xl object-cover" />
          <span className="font-heading text-[1.15rem] font-bold tracking-tight">
            Quick<span className="text-qb-primary">Bite</span>
          </span>
        </a>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[0.9rem] font-semibold text-qb-muted transition hover:text-qb-charcoal"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2.5 md:flex">
          <a href="#download" className="qb-btn-primary h-10 px-4 text-[0.8125rem]">
            Download App
          </a>
          <a href={DASHBOARD_URL} className="qb-btn-secondary h-10 px-4 text-[0.8125rem]">
            Dashboard Login
          </a>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-qb-border bg-white md:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex w-4 flex-col gap-1.5">
            <span className="block h-0.5 rounded-full bg-qb-charcoal" />
            <span className="block h-0.5 rounded-full bg-qb-charcoal" />
            <span className="block h-0.5 rounded-full bg-qb-charcoal" />
          </div>
        </button>
      </div>

      {open ? (
        <div className="border-t border-qb-border bg-qb-bg md:hidden">
          <nav className="qb-container flex flex-col gap-1 py-4" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-qb-charcoal hover:bg-white"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 grid gap-2">
              <a
                href="#download"
                className="qb-btn-primary w-full"
                onClick={() => setOpen(false)}
              >
                Download App
              </a>
              <a
                href={DASHBOARD_URL}
                className="qb-btn-secondary w-full"
                onClick={() => setOpen(false)}
              >
                Dashboard Login
              </a>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
