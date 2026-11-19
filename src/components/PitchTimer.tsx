import { useEffect, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_SECTIONS,
  LIMIT_MS,
  MAX_SECTION_SEC,
  PITCH_TIMER_KEY,
  WARN_MS,
  addSection,
  budgetEndsAt,
  budgetFromParts,
  budgetParts,
  formatClock,
  formatSpoken,
  isFinished,
  isRunning,
  newClock,
  next,
  parseSections,
  pause,
  removeSection,
  sectionElapsed,
  sectionOverBy,
  start,
  statusMessage,
  timeStatus,
  totalBudgetSec,
  totalElapsed,
  updateSection,
  type ClockState,
  type PitchSection,
  type TimeStatus,
} from '../lib/pitchTimer';
import { storage } from '../lib/storage';
import { focus } from '../lib/styles';

const fieldClass = `mt-1 w-full rounded-md border-2 border-muted bg-surface p-2 text-text ${focus}`;
const smallButton = `rounded-md border-2 border-muted px-4 py-2 font-bold text-text transition-colors duration-200 enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;
const primaryButton = `rounded-md px-5 py-3 text-lg font-bold transition-colors duration-200 bg-accent text-accent-contrast enabled:hover:bg-accent-strong enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;
const bigSecondary = `rounded-md border-2 border-accent px-5 py-3 text-lg font-bold text-accent transition-colors duration-200 enabled:hover:bg-tint disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;

/** How often the display refreshes while running. Fast enough that seconds never look stuck. */
const TICK_MS = 200;

/** Boxes for warn and over. Colors always come with words, never alone. */
const statusBox: Record<TimeStatus, string> = {
  ok: '',
  warn: 'rounded-lg border-2 border-text bg-highlight p-3 font-bold text-highlight-contrast',
  over: 'rounded-lg border-2 border-danger bg-danger p-3 font-bold text-danger-contrast',
};

const statusPrefix: Record<TimeStatus, string> = { ok: '', warn: 'Warning: ', over: 'Error: ' };

const clockColor: Record<TimeStatus, string> = {
  ok: 'text-text',
  warn: 'text-text',
  over: 'text-danger',
};

interface Props {
  headingLevel?: 2 | 3 | 4;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export default function PitchTimer({ headingLevel = 2 }: Props) {
  const Heading = `h${headingLevel}` as 'h2';

  const [sections, setSections] = useState<PitchSection[]>(() => DEFAULT_SECTIONS.map((s) => ({ ...s })));
  const [clock, setClock] = useState<ClockState>(() => newClock(DEFAULT_SECTIONS.length));
  const [time, setTime] = useState(0);
  const focusSectionId = useRef<string | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  // Load saved budgets after mount, so the server render and first client render match.
  useEffect(() => {
    const saved = parseSections(storage.getJson(PITCH_TIMER_KEY));
    setSections(saved);
    setClock(newClock(saved.length));
  }, []);

  // Tick only while running.
  const running = isRunning(clock);
  useEffect(() => {
    if (!running) return;
    setTime(now());
    const timer = setInterval(() => setTime(now()), TICK_MS);
    return () => clearInterval(timer);
  }, [running]);

  // After adding a section, move focus to its name box.
  useEffect(() => {
    if (focusSectionId.current !== null) {
      document.getElementById(`pitch-${focusSectionId.current}-label`)?.focus();
      focusSectionId.current = null;
    }
  });

  function saveSections(nextSections: PitchSection[]) {
    setSections(nextSections);
    storage.setJson(PITCH_TIMER_KEY, nextSections);
  }

  /** Adding or removing sections changes the clock's shape, so start it over. */
  function reshape(nextSections: PitchSection[]) {
    saveSections(nextSections);
    setClock(newClock(nextSections.length));
  }

  function onAdd() {
    const nextSections = addSection(sections);
    focusSectionId.current = nextSections[nextSections.length - 1]!.id;
    reshape(nextSections);
  }

  function onRemove(id: string) {
    reshape(removeSection(sections, id));
    addButton.current?.focus();
  }

  function setBudget(section: PitchSection, part: 'minutes' | 'seconds', value: string) {
    const parts = budgetParts(section.budgetSec);
    const n = value === '' ? 0 : Number(value);
    const budgetSec =
      part === 'minutes' ? budgetFromParts(n, parts.seconds) : budgetFromParts(parts.minutes, n);
    saveSections(updateSection(sections, section.id, { budgetSec }));
  }

  // Clock actions read the real time at the moment of the tap.
  const t = running ? Math.max(time, 0) : 0;
  const total = totalElapsed(clock, t);
  const status = timeStatus(total);
  const message = statusMessage(status);
  const finished = isFinished(clock);
  const started = total > 0 || running || clock.current > 0;
  const current = sections[clock.current];
  const ends = budgetEndsAt(sections);

  const budgetTotalMs = totalBudgetSec(sections) * 1000;
  const budgetStatus = timeStatus(budgetTotalMs);

  const startLabel = running ? 'Pause' : started && !finished ? 'Resume' : 'Start';
  const barPercent = Math.min(100, (total / LIMIT_MS) * 100);

  return (
    <div class="max-w-prose">
      {/* ------------------------------------------------------------ Budget */}
      <section aria-labelledby="pitch-budget-heading">
        <Heading id="pitch-budget-heading" class="text-3xl font-extrabold">
          Your time budget
        </Heading>
        <p class="mt-2 text-muted">
          Set how long each part of your pitch should take. Aim for about 8 minutes in total. Your
          budget is saved in this browser.
        </p>

        <ol class="mt-4 grid list-none gap-3 pl-0">
          {sections.map((section, i) => {
            const parts = budgetParts(section.budgetSec);
            const base = `pitch-${section.id}`;
            const name = section.label.trim() || `Part ${i + 1}`;
            return (
              <li key={section.id} class="mt-0 rounded-xl border border-border bg-surface p-4">
                <div class="flex flex-wrap items-end gap-3">
                  <div class="min-w-0 flex-[1_1_14rem]">
                    <label for={`${base}-label`} class="font-bold">
                      Part {i + 1} name
                    </label>
                    <input
                      id={`${base}-label`}
                      type="text"
                      value={section.label}
                      maxLength={200}
                      onInput={(e) =>
                        saveSections(updateSection(sections, section.id, { label: e.currentTarget.value }))
                      }
                      class={fieldClass}
                    />
                  </div>
                  <div class="w-20">
                    <label for={`${base}-min`} class="font-bold">
                      Min<span class="sr-only">utes for {name}</span>
                    </label>
                    <input
                      id={`${base}-min`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={Math.floor(MAX_SECTION_SEC / 60)}
                      step={1}
                      value={parts.minutes}
                      onInput={(e) => setBudget(section, 'minutes', e.currentTarget.value)}
                      class={fieldClass}
                    />
                  </div>
                  <div class="w-20">
                    <label for={`${base}-sec`} class="font-bold">
                      Sec<span class="sr-only">onds for {name}</span>
                    </label>
                    <input
                      id={`${base}-sec`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={59}
                      step={1}
                      value={parts.seconds}
                      onInput={(e) => setBudget(section, 'seconds', e.currentTarget.value)}
                      class={fieldClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(section.id)}
                    disabled={started || sections.length <= 1}
                    class={smallButton}
                  >
                    Remove<span class="sr-only"> {name}</span>
                  </button>
                </div>
                <p class="mt-2 text-sm text-muted">Ends at {formatClock((ends[i] ?? 0) * 1000)}</p>
              </li>
            );
          })}
        </ol>

        <div class="mt-4 flex flex-wrap gap-3">
          <button ref={addButton} type="button" onClick={onAdd} disabled={started} class={smallButton}>
            Add a part
          </button>
          <button
            type="button"
            onClick={() => reshape(DEFAULT_SECTIONS.map((s) => ({ ...s })))}
            disabled={started}
            class={smallButton}
          >
            Use module 9's plan
          </button>
        </div>
        {started && (
          <p class="mt-2 text-sm text-muted">Reset the clock to add or remove parts.</p>
        )}

        <div class="mt-4 rounded-xl bg-tint p-4">
          <p class="mt-0 text-lg">
            Planned total:{' '}
            <strong class="font-display text-3xl font-extrabold">{formatClock(budgetTotalMs)}</strong>
          </p>
          {budgetStatus !== 'ok' && (
            <p class={`mt-2 ${statusBox[budgetStatus]}`}>
              {statusPrefix[budgetStatus]}
              {budgetStatus === 'over'
                ? `Your plan is ${formatClock(LIMIT_MS)} or longer. The video must be under ${formatClock(LIMIT_MS)}, so cut some time.`
                : `Your plan runs past ${formatClock(WARN_MS)}, leaving almost no margin. Aim for about 8:00.`}
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ Clock */}
      <section aria-labelledby="pitch-clock-heading" class="mt-10">
        <Heading id="pitch-clock-heading" class="text-3xl font-extrabold">
          Rehearse
        </Heading>
        <p class="mt-2 text-muted">
          Press Start and give your pitch out loud. Press Next part each time you move on.
        </p>

        <div class="mt-4 rounded-xl border border-border bg-surface p-4 shadow-card">
          <p class="mt-0 text-muted">Total</p>
          <p
            role="timer"
            aria-label={`Total time ${formatSpoken(total)}`}
            class={`mt-0 font-display text-7xl font-extrabold tabular-nums ${clockColor[status]}`}
          >
            {formatClock(total)}
          </p>

          {/* Progress toward the limit. The tick marks 9:30. */}
          <div aria-hidden="true" class="decorative relative mt-3 h-3 overflow-hidden rounded-full bg-tint">
            <div
              class={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-soft ${status === 'over' ? 'bg-danger' : status === 'warn' ? 'bg-highlight' : 'bg-accent'}`}
              style={{ width: `${barPercent}%` }}
            />
            <div class="absolute inset-y-0 w-0.5 bg-text" style={{ left: `${(WARN_MS / LIMIT_MS) * 100}%` }} />
          </div>
          <p aria-hidden="true" class="decorative mt-1 flex justify-between text-sm text-muted">
            <span>0:00</span>
            <span>Limit {formatClock(LIMIT_MS)}</span>
          </p>

          {/* Always in the page, so screen readers announce changes. */}
          <div role="status" class="mt-3">
            {message && (
              <p class={statusBox[status]}>
                {statusPrefix[status]}
                {message}
              </p>
            )}
          </div>

          <p class="mt-4 text-lg">
            {finished ? (
              'Done. Check your times below.'
            ) : (
              <>
                Now: <strong>{current?.label.trim() || `Part ${clock.current + 1}`}</strong>{' '}
                <span class="tabular-nums">
                  {formatClock(sectionElapsed(clock, clock.current, t))} of{' '}
                  {formatClock((current?.budgetSec ?? 0) * 1000)}
                </span>
              </>
            )}
          </p>

          <div class="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setClock(running ? pause(clock, now()) : start(clock, now()))}
              disabled={finished || sections.length === 0}
              class={primaryButton}
            >
              {startLabel}
            </button>
            <button
              type="button"
              onClick={() => setClock(next(clock, now()))}
              disabled={finished}
              class={bigSecondary}
            >
              {clock.current === sections.length - 1 ? 'Finish' : 'Next part'}
            </button>
            <button
              type="button"
              onClick={() => setClock(newClock(sections.length))}
              disabled={!started}
              class={smallButton}
            >
              Reset
            </button>
          </div>
        </div>

        <div class="mt-6 overflow-x-auto" role="region" aria-labelledby="pitch-times-caption" tabindex={0}>
          <table class="w-full min-w-0 border-collapse text-left text-sm sm:text-base">
            <caption id="pitch-times-caption" class="mb-2 text-left text-xl font-extrabold">
              Time by part
            </caption>
            <thead>
              <tr class="bg-tint">
                <th scope="col" class="border border-border p-2">Part</th>
                <th scope="col" class="border border-border p-2">Actual</th>
                <th scope="col" class="border border-border p-2">Budget</th>
                <th scope="col" class="border border-border p-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section, i) => {
                const elapsed = sectionElapsed(clock, i, t);
                const over = sectionOverBy(elapsed, section.budgetSec);
                const isCurrent = i === clock.current && !finished;
                const reached = i < clock.current || elapsed > 0;
                return (
                  <tr key={section.id} aria-current={isCurrent ? 'step' : undefined} class={isCurrent ? 'bg-surface font-bold' : ''}>
                    <th scope="row" class="border border-border p-2 font-normal [hyphens:auto] [overflow-wrap:anywhere]">
                      {isCurrent && (
                        <span aria-hidden="true" class="decorative mr-1 inline-block size-2 rounded-full bg-highlight align-middle" />
                      )}
                      {section.label.trim() || `Part ${i + 1}`}
                    </th>
                    <td class="border border-border p-2 tabular-nums">{formatClock(elapsed)}</td>
                    <td class="border border-border p-2 tabular-nums">{formatClock(section.budgetSec * 1000)}</td>
                    <td class={`border border-border p-2 ${over > 0 ? 'font-bold text-danger' : 'text-muted'}`}>
                      {over > 0 ? `${formatClock(over * 1000)} over` : reached ? 'On time' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" class="border border-border p-2">Total</th>
                <td class={`border border-border p-2 font-bold tabular-nums ${status === 'over' ? 'text-danger' : ''}`}>
                  {formatClock(total)}
                </td>
                <td class="border border-border p-2 tabular-nums">{formatClock(budgetTotalMs)}</td>
                <td class={`border border-border p-2 font-bold ${status === 'over' ? 'text-danger' : ''}`}>
                  {status === 'over' ? 'Over the limit' : status === 'warn' ? `Past ${formatClock(WARN_MS)}` : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
