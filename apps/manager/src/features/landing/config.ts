/** Same-host dashboard entry — AuthGate routes each role after login. */
export const DASHBOARD_URL = '/login';

export const APP_STORE_URL: string | null = null;
export const PLAY_STORE_URL: string | null = null;

export const CONTACT_EMAIL = 'hello@quickbite.app';

export const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Restaurants', href: '#restaurants' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'For Business', href: '#business' },
] as const;
