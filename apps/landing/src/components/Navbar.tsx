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
          ? 'border-b border-qb-border bg-qb-bg/95 shadow-soft backdrop-blur-md'
          : 'border-b border-transparent bg-qb-bg/70 backdrop-blur-sm',
      ].join(' ')}
    >
      <div className="qb-container flex h-[4.5rem] items-center justify-between gap-6">
        <a href="#home" className="relative z-10 shrink-0" aria-label="QuickBite home">
          <img
            src="/logo2.png"
            alt="QuickBite"
            className="h-11 w-auto object-contain sm:h-12"
          />
        </a>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[0.9rem] font-semibold text-qb-muted transition hover:text-qb-text"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="relative z-10 hidden shrink-0 items-center gap-2.5 md:flex">
          <a href="#download" className="qb-btn-primary h-10 px-4 text-[0.8125rem]">
            Download App
          </a>
          <a href={DASHBOARD_URL} className="qb-btn-secondary h-10 px-4 text-[0.8125rem]">
            Dashboard Login
          </a>
        </div>

        <button
          type="button"
          className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-qb-border bg-qb-surface md:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex w-4 flex-col gap-1.5">
            <span className="block h-0.5 rounded-full bg-qb-text" />
            <span className="block h-0.5 rounded-full bg-qb-text" />
            <span className="block h-0.5 rounded-full bg-qb-text" />
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
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-qb-text hover:bg-qb-surface"
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
