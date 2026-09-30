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
    'inline-flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-left transition',
    dark
      ? 'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15'
      : 'bg-qb-charcoal text-white hover:bg-black',
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
        <span className="mt-0.5 text-sm font-bold">{title}</span>
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

export function StoreBadges({ className = '', dark = false }: StoreBadgesProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Badge
        href={APP_STORE_URL}
        eyebrow="Download on the"
        title="App Store"
        dark={dark}
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
            <path d="M16.365 1.43c0 1.14-.46 2.2-1.22 3-.81.86-2.1 1.52-3.28 1.43-.12-1.1.43-2.25 1.2-3.07.83-.88 2.2-1.52 3.3-1.36ZM20.5 17.2c-.56 1.25-.84 1.8-1.57 2.9-.99 1.45-2.38 3.25-4.12 3.27-1.54.02-1.94-.98-4.04-.97-2.1.01-2.54.99-4.08.97-1.74-.02-3.07-1.65-4.06-3.1C.94 17.5-.4 12.84 1.4 9.64c1.14-2 2.93-3.2 4.63-3.2 1.72 0 2.8 1.02 4.22 1.02 1.38 0 2.22-1.03 4.22-1.03 1.5 0 3.08.82 4.2 2.24-3.7 2.03-3.1 7.3.83 8.53Z" />
          </svg>
        }
      />
      <Badge
        href={PLAY_STORE_URL}
        eyebrow="Get it on"
        title="Google Play"
        dark={dark}
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
            <path d="M3.6 2.3c-.4.2-.6.6-.6 1.1v17.2c0 .5.2.9.6 1.1l9.4-9.7L3.6 2.3Zm11.3 6.5-2.2 2.2 2.2 2.2 4.5-2.5c.6-.3.6-1.1 0-1.4l-4.5-2.5ZM12 13.5l-2.3 2.3 5.7 3.2c.6.3 1.3 0 1.3-.7v-.1L12 13.5Zm0-3L16.7 7v-.1c0-.7-.7-1-1.3-.7L9.7 9.4 12 10.5Z" />
          </svg>
        }
      />
    </div>
  );
}
