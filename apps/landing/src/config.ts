const DEFAULT_DASHBOARD_LOGIN = "https://quickbite-nine-phi.vercel.app/login";

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Override when the landing is embedded in the dashboard (same-origin `/login`). */
let dashboardUrlOverride: string | null = null;

export function setDashboardUrlOverride(url: string | null) {
  dashboardUrlOverride = url;
}

/** Dashboard login — partners / admin land on role-specific screens after auth. */
export function getDashboardUrl(): string {
  if (dashboardUrlOverride) return dashboardUrlOverride;
  return trimOrNull(import.meta.env['VITE_DASHBOARD_URL']) ?? DEFAULT_DASHBOARD_LOGIN;
}

/** @deprecated Prefer getDashboardUrl() — kept for existing component imports. */
export const DASHBOARD_URL = trimOrNull(import.meta.env['VITE_DASHBOARD_URL']) ?? DEFAULT_DASHBOARD_LOGIN;

/** Live store URLs when published; null keeps badges in “Coming soon” mode. */
export const APP_STORE_URL = trimOrNull(import.meta.env['VITE_APP_STORE_URL']);
export const PLAY_STORE_URL = trimOrNull(import.meta.env['VITE_PLAY_STORE_URL']);

export const CONTACT_EMAIL = "hello@quickbite.app";

export const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Restaurants", href: "#restaurants" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "For Business", href: "#business" },
] as const;
