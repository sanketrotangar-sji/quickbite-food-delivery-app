import type { ReactNode } from 'react';
import { APP_STORE_URL, PLAY_STORE_URL } from '../config';

type StoreBadgesProps = {
  className?: string;
  dark?: boolean;
};

type BadgeProps = {
  href: string | null;
  eyebrow: string;
  title: string;
  icon: ReactNode;
  dark?: boolean;
};

function Badge({ href, eyebrow, title, icon, dark }: BadgeProps) {
  const className = [
    'inline-flex h-12 items-center gap-3 rounded-xl px-3.5 text-left transition',
    dark
      ? 'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15'
      : 'bg-qb-text text-white hover:bg-qb-text/90',
    !href ? 'cursor-default' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {icon}
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-75">
          {href ? eyebrow : 'Coming soon'}
        </span>
        <span className="mt-1 text-sm font-bold tracking-tight">{title}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return (
    <span className={className} aria-label={`${title} — coming soon`}>
      {content}
    </span>
  );
}

/** Official-style Apple mark (monochrome). */
function AppleLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

/** Official-style Google Play triangle (brand colors). */
function GooglePlayLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#EA4335" d="M3.6 2.55 13.2 12 3.6 21.45A1.55 1.55 0 0 1 3 20.2V3.8c0-.52.24-1 .6-1.25Z" />
      <path fill="#FBBC04" d="m13.2 12 2.95 2.95-8.55 4.85L13.2 12Z" />
      <path fill="#4285F4" d="M20.4 10.85c.8.45.8 1.65 0 2.1l-3.4 1.95-3.8-2.9 3.8-2.9 3.4 1.75Z" />
      <path fill="#34A853" d="M13.2 12 7.6 3.35l8.55 4.85L13.2 12Z" />
    </svg>
  );
}

export function StoreBadges({ className = '', dark = false }: StoreBadgesProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Badge
        href={APP_STORE_URL}
        eyebrow="Download on the"
        title="App Store"
        dark={dark}
        icon={<AppleLogo />}
      />
      <Badge
        href={PLAY_STORE_URL}
        eyebrow="Get it on"
        title="Google Play"
        dark={dark}
        icon={<GooglePlayLogo />}
      />
    </div>
  );
}
