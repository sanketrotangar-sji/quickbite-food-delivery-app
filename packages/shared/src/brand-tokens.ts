/** Shared brand colors — hex is source of truth for RN; oklch notes for manager CSS parity. */

export const brandHex = {
  background: '#FBF7F2',
  surface: '#FFFFFF',
  primary: '#F15A24',
  primaryDark: '#D44812',
  primarySoft: '#FFE8DC',
  forest: '#2D4A42',
  forestMuted: '#3F6358',
  forestForeground: '#F7F3EA',
  success: '#4A8B6F',
  successSoft: '#DCECE4',
  text: '#1F1C19',
  textMuted: '#8D877F',
  border: '#EFE8E0',
  danger: '#B42318',
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
