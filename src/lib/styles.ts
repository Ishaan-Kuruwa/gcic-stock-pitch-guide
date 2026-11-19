// Tailwind class strings shared across pages, plus the stagger helper for
// fade-in lists. Colors come from the theme tokens in styles/global.css.

export const focus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** Small uppercase label above a heading. */
export const eyebrow = 'text-sm font-bold uppercase tracking-wider text-muted';

/** Static card. */
export const card = 'rounded-xl border border-border bg-surface p-card shadow-card';

/**
 * Hover/focus lift for clickable cards. The shadow always appears; the small
 * rise only happens when the visitor allows motion.
 */
export const lift = [
  'transition duration-300 ease-soft hover:border-accent hover:shadow-lift focus-within:shadow-lift',
  'motion-safe:hover:-translate-y-0.5 motion-safe:focus-within:-translate-y-0.5',
].join(' ');

/** Fade-and-slide-up on load. Pair with `fadeDelay(i)` to stagger a list. */
export const fadeUp = 'motion-safe:animate-fade-up';

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-lg font-bold no-underline transition-colors duration-200';
export const buttonPrimary = `${buttonBase} bg-accent text-accent-contrast hover:bg-accent-strong hover:text-white`;
export const buttonSecondary = `${buttonBase} border-2 border-accent text-accent hover:bg-tint`;

/** Decorative number badge, as used on module parts and learning-path cards. */
export const numberBadge =
  'grid size-10 shrink-0 place-items-center rounded-full bg-tint font-display text-xl font-extrabold text-accent';

/**
 * Inline style that delays an item's fade-in by its position in a list.
 * Capped so long lists never wait more than `maxMs`.
 */
export function fadeDelay(index: number, stepMs = 50, maxMs = 600): string {
  const ms = Math.min(Math.max(0, Math.floor(index)) * stepMs, maxMs);
  return `animation-delay: ${ms}ms`;
}
