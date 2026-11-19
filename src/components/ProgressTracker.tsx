import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDate } from '../lib/format';
import { loadProgress, nextModule, progressSummary, saveProgress, toggleDone } from '../lib/progress';
import type { TrackerItem } from '../lib/modules';
import { card, eyebrow, focus } from '../lib/styles';

interface Props {
  /** Built with trackerItems() from the modules collection. */
  modules: TrackerItem[];
  /** "full": the checklist on /learn. "next": the compact card on the home page. */
  variant: 'full' | 'next';
}

const smallButton =
  'rounded-md px-4 py-2 font-bold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50';

function Due({ iso }: { iso: string }) {
  return <time datetime={iso}>{formatDate(iso)}</time>;
}

function Title({ m }: { m: TrackerItem }) {
  return m.href ? (
    <a href={m.href} class={`rounded ${focus}`}>
      {m.title}
    </a>
  ) : (
    <>{m.title}</>
  );
}

export default function ProgressTracker({ modules, variant }: Props) {
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [notSaved, setNotSaved] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  // Load after mount, so the server render and first client render match.
  useEffect(() => {
    setDone(loadProgress());
  }, []);

  useEffect(() => {
    if (fallbackText !== null) {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [fallbackText]);

  const next = nextModule(modules, done);

  if (variant === 'next') {
    const m = modules.find((x) => x.number === next);
    return (
      <section aria-labelledby="next-step-heading" class={card}>
        <h2 id="next-step-heading" class="font-display text-3xl font-extrabold">
          Your next step
        </h2>
        {m ? (
          <>
            <p class={`mt-3 ${eyebrow}`}>Module {m.number}</p>
            <p class="mt-1 text-xl font-bold">
              <Title m={m} />
            </p>
            <dl class="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
              <dt class="font-bold text-muted">Deliverable</dt>
              <dd>{m.deliverable}</dd>
              <dt class="font-bold text-muted">Due</dt>
              <dd>
                <Due iso={m.due} />
              </dd>
            </dl>
          </>
        ) : (
          <p class="mt-3">Every module is ticked off. Nice work.</p>
        )}
        <p class="mt-4">
          <a href="/learn#progress" class={`rounded font-bold ${focus}`}>
            See your progress
          </a>
        </p>
      </section>
    );
  }

  function onToggle(n: number) {
    const updated = toggleDone(done, n);
    setDone(updated);
    setNotSaved(!saveProgress(updated));
    setCopyStatus('');
    setFallbackText(null);
  }

  async function onCopy() {
    const text = progressSummary(modules, done);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('No clipboard');
      await navigator.clipboard.writeText(text);
      setFallbackText(null);
      setCopyStatus('Copied. Paste it in a message to your mentor.');
    } catch {
      setFallbackText(text);
      setCopyStatus('Select the text below and copy it.');
    }
  }

  return (
    <div>
      <p class="text-muted">
        {done.size} of {modules.length} done
      </p>
      <ol class="mt-4 grid gap-3">
        {modules.map((m) => {
          const isNext = m.number === next;
          const isDone = done.has(m.number);
          const id = `progress-${m.number}`;
          return (
            <li
              key={m.number}
              aria-current={isNext ? 'step' : undefined}
              class={`flex gap-4 rounded-xl border p-4 ${
                isNext ? 'border-border border-l-[6px] border-l-highlight bg-tint' : 'border-border bg-surface'
              }`}
            >
              <input
                type="checkbox"
                id={id}
                checked={isDone}
                onChange={() => onToggle(m.number)}
                class={`mt-1 size-6 shrink-0 accent-accent ${focus}`}
              />
              <div class="min-w-0 flex-1">
                <label for={id} class="block cursor-pointer">
                  <span class={`block ${eyebrow}`}>
                    Module {m.number} deliverable{isDone && <span class="sr-only"> (done)</span>}
                  </span>
                  <span class={`block text-lg font-bold ${isDone ? 'text-muted line-through' : ''}`}>
                    {m.deliverable}
                  </span>
                </label>
                <p class="mt-1">
                  <Title m={m} />
                  <span class="text-muted">
                    {' · Due '}
                    <Due iso={m.due} />
                  </span>
                </p>
                {isNext && (
                  <p class="mt-2 inline-block rounded-full bg-highlight px-3 text-sm font-bold text-highlight-contrast">
                    Next step
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {notSaved && (
        <p class="mt-3 text-sm text-muted">
          Your browser isn't saving progress, so your ticks will reset when you close this page.
        </p>
      )}

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onCopy}
          class={`${smallButton} bg-accent text-accent-contrast hover:bg-accent-strong hover:text-white ${focus}`}
        >
          Copy progress for my mentor
        </button>
        <span role="status" class="font-bold">
          {copyStatus}
        </span>
      </div>
      {fallbackText !== null && (
        <div class="mt-4">
          <label for="progress-copy" class="font-bold">
            Progress text to copy
          </label>
          <textarea
            id="progress-copy"
            ref={fallbackRef}
            readOnly
            rows={4}
            value={fallbackText}
            class={`mt-1 w-full rounded-md border-2 border-border bg-surface p-3 text-text ${focus}`}
          />
        </div>
      )}
    </div>
  );
}
