import { useEffect, useRef, useState } from 'preact/hooks';
import {
  companies,
  interests,
  styleChoices,
  styleLabels,
  type Company,
  type InterestId,
  type StyleChoice,
} from '../data/matchmaker';
import {
  MAX_INTERESTS,
  matchCompanies,
  parseShortlist,
  shortlistText,
  toggleInterest,
  toggleShortlist,
} from '../lib/matchmaker';
import { storage } from '../lib/storage';
import { buttonPrimary, card, fadeDelay, fadeUp, focus } from '../lib/styles';

const SHORTLIST_KEY = 'matchmaker-shortlist';

const interestLabel = new Map(interests.map((i) => [i.id, i.label]));
const byTicker = new Map(companies.map((c) => [c.ticker, c]));

const chipBase = `rounded-full border-2 px-4 py-2 text-base transition-colors duration-200 ${focus}`;
const chipOff = 'border-border bg-surface text-text hover:border-accent';
const chipOn = 'border-accent bg-accent font-bold text-accent-contrast';

const segBase = `px-4 py-2 text-base transition-colors duration-200 ${focus}`;
const segOff = 'bg-surface text-text hover:bg-tint';
const segOn = 'bg-text font-bold text-bg';

const smallButton = 'rounded-md px-4 py-2 font-bold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50';

export default function Matchmaker() {
  const [picked, setPicked] = useState<InterestId[]>([]);
  const [style, setStyle] = useState<StyleChoice>('both');
  const [error, setError] = useState('');
  const [results, setResults] = useState<Company[] | null>(null);
  // Bumped on each search so cards remount and fade in again.
  const [run, setRun] = useState(0);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState('');
  const [fallbackText, setFallbackText] = useState<string | null>(null);

  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  // Load the saved shortlist after mount, so the server render and first
  // client render match. On a return visit, show the saved companies.
  useEffect(() => {
    const saved = parseShortlist(storage.getJson(SHORTLIST_KEY), companies);
    if (saved.length > 0) {
      setShortlist(saved);
      setResults(saved.map((t) => byTicker.get(t)!));
    }
  }, []);

  // After a search, move focus to the results so keyboard and screen reader
  // users land on them. Focusing also scrolls them into view.
  useEffect(() => {
    if (run > 0) resultsHeading.current?.focus();
  }, [run]);

  useEffect(() => {
    if (fallbackText !== null) {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [fallbackText]);

  function onInterest(id: InterestId) {
    const next = toggleInterest(picked, id);
    setPicked(next.picked);
    setError(next.atLimit ? 'You can pick up to three. Unpick one to choose another.' : '');
  }

  function onFind() {
    if (picked.length === 0) {
      setError('Pick at least one interest to see your matches.');
      return;
    }
    setError('');
    setResults(matchCompanies(companies, picked, style));
    setRun((r) => r + 1);
  }

  function updateShortlist(next: string[]) {
    setShortlist(next);
    setCopyStatus('');
    setFallbackText(null);
    storage.setJson(SHORTLIST_KEY, next);
  }

  async function onCopy() {
    const text = shortlistText(shortlist, companies);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('No clipboard');
      await navigator.clipboard.writeText(text);
      setFallbackText(null);
      setCopyStatus('Copied. Paste it in the club chat.');
    } catch {
      setFallbackText(text);
      setCopyStatus('Select the text below and copy it.');
    }
  }

  const empty = shortlist.length === 0;

  return (
    <div>
      <div class="max-w-prose">
        <fieldset>
          <legend class="mb-3 text-lg font-bold">What are you into? Pick up to three.</legend>
          <div class="flex flex-wrap gap-2">
            {interests.map(({ id, label }) => {
              const on = picked.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onInterest(id)}
                  class={`${chipBase} ${on ? chipOn : chipOff}`}
                >
                  {on && <span aria-hidden="true">✓ </span>}
                  {label}
                </button>
              );
            })}
          </div>
          <p class="mt-2 text-muted" aria-live="polite">
            {picked.length} of {MAX_INTERESTS} picked
          </p>
        </fieldset>

        <fieldset class="mt-6">
          <legend class="mb-3 text-lg font-bold">What kind of company sounds more fun to pitch?</legend>
          <div class="inline-flex flex-wrap overflow-hidden rounded-md border-2 border-border">
            {styleChoices.map(({ id, label }, i) => (
              <button
                key={id}
                type="button"
                aria-pressed={style === id}
                onClick={() => setStyle(id)}
                class={`${segBase} ${style === id ? segOn : segOff} ${i > 0 ? 'border-l-2 border-border' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="button" onClick={onFind} class={`mt-8 ${buttonPrimary} ${focus}`}>
          Find my companies
        </button>
        <p role="alert" class="mt-3 min-h-[1.6em] font-bold">
          {error}
        </p>
      </div>

      {results && (
        <section aria-labelledby="matches-heading" class="mt-8">
          <h2 id="matches-heading" ref={resultsHeading} tabIndex={-1} class="text-4xl font-extrabold sm:text-5xl">
            Your matches
          </h2>
          <p class="mt-3 max-w-prose text-muted">
            Each card shows a company's <a href="/glossary#ticker">ticker</a> and a question to start your
            research. Add the ones you'd want to dig into to your shortlist, then bring it to the next GHIC
            meeting.
          </p>

          <ul class="mt-6 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-5">
            {results.map((c, i) => {
              const on = shortlist.includes(c.ticker);
              return (
                <li key={`${run}-${c.ticker}`} class={`flex ${fadeUp}`} style={fadeDelay(i, 70)}>
                  <article class={`flex w-full flex-col ${card}`}>
                    <h3>
                      <span class="block font-display text-6xl font-black leading-none text-accent">{c.ticker}</span>
                      <span class="-mx-card mt-3 block bg-highlight px-card py-2 font-sans text-lg font-bold text-highlight-contrast">
                        {c.name}
                      </span>
                    </h3>
                    <p class="mt-3 text-sm text-muted">
                      Matched on {interestLabel.get(c.interest)?.toLowerCase()}, {styleLabels[c.style]}
                    </p>
                    <p class="mt-2 mb-5">
                      <span class="block text-sm text-muted">Start your research with</span>
                      {c.question}
                    </p>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => updateShortlist(toggleShortlist(shortlist, c.ticker))}
                      class={`mt-auto border-2 border-accent text-left ${smallButton} ${focus} ${
                        on ? 'bg-accent text-accent-contrast' : 'text-accent hover:bg-tint'
                      }`}
                    >
                      <span aria-hidden="true">{on ? '★ ' : '☆ '}</span>
                      {on ? 'On your shortlist' : 'Add to shortlist'}
                      <span class="sr-only">: {c.name}</span>
                    </button>
                  </article>
                </li>
              );
            })}
          </ul>

          <section aria-labelledby="shortlist-heading" class="mt-10 max-w-prose rounded-xl bg-tint p-card">
            <h3 id="shortlist-heading" class="text-3xl font-extrabold">
              Your shortlist
            </h3>
            {empty ? (
              <p class="mt-2 text-muted">Nothing here yet. Tap “Add to shortlist” on any card.</p>
            ) : (
              <ul class="mt-2 list-disc pl-6">
                {shortlist.map((t) => (
                  <li key={t}>
                    {t}, {byTicker.get(t)?.name}
                  </li>
                ))}
              </ul>
            )}
            <div class="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onCopy}
                disabled={empty}
                class={`${smallButton} bg-accent text-accent-contrast enabled:hover:bg-accent-strong enabled:hover:text-white ${focus}`}
              >
                Copy shortlist
              </button>
              <button
                type="button"
                onClick={() => updateShortlist([])}
                disabled={empty}
                class={`${smallButton} border-2 border-border text-text enabled:hover:border-accent ${focus}`}
              >
                Clear shortlist
              </button>
              <span role="status" class="font-bold">
                {copyStatus}
              </span>
            </div>
            {fallbackText !== null && (
              <div class="mt-4">
                <label for="shortlist-copy" class="font-bold">
                  Shortlist text to copy
                </label>
                <textarea
                  id="shortlist-copy"
                  ref={fallbackRef}
                  readOnly
                  rows={3}
                  value={fallbackText}
                  class={`mt-1 w-full rounded-md border-2 border-border bg-surface p-3 text-text ${focus}`}
                />
              </div>
            )}
          </section>
        </section>
      )}
    </div>
  );
}
