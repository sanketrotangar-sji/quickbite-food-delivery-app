/** Shared brand colors — hex is source of truth for RN; oklch notes for manager CSS parity. */

export const brandHex = {
  background: '#FBF7F2',
  surface: '#FFFFFF',
  primary: '#F15A24',
  primaryDark: '#D44812',
  primarySoft: '#FFE8DC',
  /** Lighter peach washes for cards / unread / address hints */
  primarySoftMid: '#FFF3ED',
  primaryWash: '#FFF7F3',
  primaryTintBorder: '#FDBA74',
  forest: '#2D4A42',
  forestMuted: '#3F6358',
  forestForeground: '#F7F3EA',
  success: '#4A8B6F',
  successSoft: '#DCECE4',
  successBorder: '#B7E1C4',
  star: '#E0A106',
  starSoft: '#FFF4D6',
  veg: '#2E9B57',
  vegSoft: '#E5F6EC',
  warning: '#C97800',
  warningSoft: '#FFF1D6',
  info: '#1D4E89',
  infoSoft: '#D6E8FF',
  quick: '#7A4DDB',
  quickSoft: '#F3E8FF',
  text: '#1F1C19',
  /** Previous textMuted: '#8D877F' (raised to #6E675F for >=4.5:1 warm contrast) */
  textMuted: '#6E675F',
  border: '#EFE8E0',
  /** Neutral tracks for progress steppers */
  stepTrack: '#EEEEEE',
  stepTrackBorder: '#E0E0E0',
  stepLine: '#E8E8E8',
  danger: '#B42318',
  dangerSoft: '#FDECEC',
  dangerBorder: '#F5C2C2',
  white: '#FFFFFF',
  overlay: 'rgba(58, 56, 52, 0.45)',
} as const;

/** Checked-in oklch mapping for apps/manager/src/styles.css :root (keep in sync). */
export const brandOklchNotes = {
  background: 'oklch(0.9678 0.0086 84.57)',
  foreground: 'oklch(0.2565 0.004 84.58)',
  primary: 'oklch(0.5953 0.1497 41.27)',
  forest: 'oklch(0.383 0.0398 162.91)',
  success: 'oklch(0.5178 0.0801 155.22)',
  border: 'oklch(0.9147 0.0149 80.71)',
  destructive: 'oklch(0.5541 0.1472 30.57)',
} as const;

/** Type scale (px) shared by Expo and the dashboard. */
export const typeScale = {
  caption: { size: 11, line: 14 },
  meta: { size: 12, line: 16 },
  body: { size: 14, line: 20 },
  bodyLg: { size: 16, line: 22 },
  title: { size: 18, line: 24 },
  heading: { size: 22, line: 28 },
  display: { size: 28, line: 34 },
} as const;

/** Motion durations (ms) and press feedback. */
export const motion = {
  fast: 120,
  base: 220,
  slow: 360,
  pressScale: 0.97,
} as const;
