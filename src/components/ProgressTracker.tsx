import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDate } from '../lib/format';
import { loadProgress, nextModule, progressSummary, saveProgress, toggleDone } from '../lib/progress';
import {
  clearIfSignedOut,
  createProgressClient,
  hasSignInHint,
  pushTick,
  syncOnLoad,
  type ProgressClient,
  type Synced,
} from '../lib/progressSync';
import { storage } from '../lib/storage';
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

/** Is someone signed in? The header's hint cookie says so (it grants nothing). */
function isHinted(): boolean {
  try {
    return hasSignInHint(document.cookie);
  } catch {
    return false;
  }
}

type SyncPhase = 'off' | 'loading' | 'ready' | 'failed';

/**
 * Done modules, from localStorage, and from the account when signed in
 * (src/lib/progressSync.ts). Signed out, this behaves exactly as before.
 */
function useProgress() {
  const [done, setDoneState] = useState<Set<number>>(() => new Set());
  const [notSaved, setNotSaved] = useState(false);
  const [accountNotSaved, setAccountNotSaved] = useState(false);
  const doneRef = useRef<Set<number>>(new Set());
  const phaseRef = useRef<SyncPhase>('off');
  const clientRef = useRef<ProgressClient | null>(null);
  const syncedRef = useRef<Synced | null>(null);
  /** Ticks made while the account was still loading: module → done. */
  const pendingRef = useRef(new Map<number, boolean>());
  /** Requests run one after another, the load first. */
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());

  function setDone(next: Set<number>) {
    doneRef.current = next;
    setDoneState(next);
  }

  function push(n: number, want: boolean) {
    const client = clientRef.current;
    const synced = syncedRef.current;
    if (!client || !synced) return;
    chainRef.current = chainRef.current
      .then(() => pushTick(client, synced.catalog, n, want))
      .then((ok) => {
        if (!ok) setAccountNotSaved(true);
      });
  }

  // Load after mount, so the server render and first client render match.
  useEffect(() => {
    const hinted = isHinted();
    clearIfSignedOut(storage, hinted);
    setDone(loadProgress());
    if (!hinted) return;

    let cancelled = false;
    const client = createProgressClient();
    clientRef.current = client;
    phaseRef.current = 'loading';
    chainRef.current = syncOnLoad(client).then((synced) => {
      if (cancelled) return;
      if (!synced) {
        phaseRef.current = 'failed';
        if (pendingRef.current.size > 0) setAccountNotSaved(true);
        return;
      }
      syncedRef.current = synced;
      phaseRef.current = 'ready';
      if (!synced.saved) setAccountNotSaved(true);
      // Ticks made while loading go on top of the account's progress.
      let next = synced.done;
      for (const [n, want] of pendingRef.current) {
        if (next.has(n) !== want) next = toggleDone(next, n);
      }
      setDone(next);
      if (pendingRef.current.size > 0) saveProgress(next);
      const pending = [...pendingRef.current];
      pendingRef.current.clear();
      for (const [n, want] of pending) push(n, want);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(n: number) {
    const next = toggleDone(doneRef.current, n);
    setDone(next);
    setNotSaved(!saveProgress(next));
    const want = next.has(n);
    switch (phaseRef.current) {
      case 'loading':
        pendingRef.current.set(n, want);
        break;
      case 'ready':
        push(n, want);
        break;
      case 'failed':
        setAccountNotSaved(true);
        break;
      case 'off':
        break;
    }
  }

  return { done, toggle, notSaved, accountNotSaved };
}

export default function ProgressTracker({ modules, variant }: Props) {
  const { done, toggle, notSaved, accountNotSaved } = useProgress();
  const [copyStatus, setCopyStatus] = useState('');
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

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
    toggle(n);
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
      {accountNotSaved && (
        <p role="status" class="mt-3 text-sm text-muted">
          Not saved, you're offline or signed out
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
            class={`mt-1 w-full rounded-md border-2 border-muted bg-surface p-3 text-text ${focus}`}
          />
        </div>
      )}
    </div>
  );
}
