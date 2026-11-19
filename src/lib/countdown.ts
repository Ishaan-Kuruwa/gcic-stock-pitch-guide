export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Time left until the deadline. Both arguments are absolute instants
 * (ms since epoch), so the result does not depend on the viewer's time zone.
 */
export function getCountdown(deadlineMs: number, nowMs: number): Countdown {
  const remaining = deadlineMs - nowMs;
  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }
  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
    isPast: false,
  };
}

/** Format the deadline as wall-clock time in the given IANA time zone. */
export function formatDeadlineInZone(
  deadlineIso: string,
  timeZone: string,
  locale = 'en-US',
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(deadlineIso));
}
