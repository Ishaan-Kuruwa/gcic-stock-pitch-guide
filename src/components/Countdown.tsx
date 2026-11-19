import { useEffect, useState } from 'preact/hooks';
import { formatDeadlineInZone, getCountdown } from '../lib/countdown';

interface Props {
  deadlineIso: string;
  deadlineDisplay: string;
}

const numberFormat = new Intl.NumberFormat('en-US');

function viewerTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export default function Countdown({ deadlineIso, deadlineDisplay }: Props) {
  const deadlineMs = Date.parse(deadlineIso);
  // null until mounted so the server render and first client render match.
  const [now, setNow] = useState<number | null>(null);
  const [localTime, setLocalTime] = useState<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const zone = viewerTimeZone();
    if (zone) setLocalTime(formatDeadlineInZone(deadlineIso, zone));

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setInterval(() => setNow(Date.now()), reduceMotion ? 60_000 : 1_000);
    return () => window.clearInterval(id);
  }, [deadlineIso]);

  const countdown = now === null ? null : getCountdown(deadlineMs, now);

  return (
    <section aria-labelledby="countdown-heading" class="rounded-xl border border-border bg-surface p-5 shadow-card sm:p-card">
      <h2 id="countdown-heading" class="font-display text-3xl font-extrabold">
        Submission deadline
      </h2>
      <p class="mt-1">
        <strong>{deadlineDisplay}</strong>. No late submissions.
      </p>

      {countdown?.isPast ? (
        <p class="mt-4 font-display text-2xl font-extrabold">The deadline has passed. No late submissions.</p>
      ) : countdown ? (
        <>
          <dl class="mt-4 grid grid-cols-4 gap-2 text-center" aria-live="off">
            {(
              [
                ['Days', countdown.days],
                ['Hours', countdown.hours],
                ['Minutes', countdown.minutes],
                ['Seconds', countdown.seconds],
              ] as const
            ).map(([label, value]) => (
              <div key={label} class="flex flex-col-reverse rounded-lg border border-border bg-tint px-1 py-3">
                <dt class="text-xs font-bold uppercase text-muted sm:text-sm sm:tracking-wide">{label}</dt>
                <dd class="font-display text-4xl font-black leading-none tabular-nums text-accent sm:text-6xl">
                  {numberFormat.format(value)}
                </dd>
              </div>
            ))}
          </dl>
          {localTime && (
            <p class="mt-3 text-muted">
              Where you are, that's <strong>{localTime}</strong>.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
