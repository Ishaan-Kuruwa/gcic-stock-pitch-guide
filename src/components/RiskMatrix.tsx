import { useEffect, useRef, useState } from 'preact/hooks';
import {
  RISK_KEY,
  addRisk,
  parseRisks,
  ratingLabel,
  ratings,
  removeRisk,
  riskGrid,
  riskScore,
  riskTableHtml,
  riskTableText,
  sortRisks,
  updateRisk,
  type Rating,
  type Risk,
} from '../lib/riskMatrix';
import { storage } from '../lib/storage';
import { focus } from '../lib/styles';

const fieldClass = `mt-1 w-full rounded-md border-2 border-muted bg-surface p-3 text-text ${focus}`;
const smallButton = `rounded-md border-2 border-muted px-4 py-2 font-bold text-text transition-colors duration-200 enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;
const primaryButton = `rounded-md px-4 py-2 font-bold transition-colors duration-200 bg-accent text-accent-contrast enabled:hover:bg-accent-strong enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;

/** Grid cells at or above this likelihood × impact are marked High. */
const HIGH_SCORE = 6;

type RatingField = 'likelihood' | 'impact';
const ratingFields: { field: RatingField; label: string }[] = [
  { field: 'likelihood', label: 'Likelihood' },
  { field: 'impact', label: 'Impact' },
];

export default function RiskMatrix() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [copyStatus, setCopyStatus] = useState('');
  const [fallbackText, setFallbackText] = useState<string | null>(null);

  const addButton = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const focusRiskId = useRef<string | null>(null);

  // Load saved risks after mount, so the server render and first client render match.
  useEffect(() => {
    setRisks(parseRisks(storage.getJson(RISK_KEY)));
  }, []);

  // After adding a risk, move focus to its first box.
  useEffect(() => {
    if (focusRiskId.current !== null) {
      document.getElementById(`${focusRiskId.current}-text`)?.focus();
      focusRiskId.current = null;
    }
  });

  useEffect(() => {
    if (fallbackText !== null) {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [fallbackText]);

  function update(next: Risk[]) {
    setRisks(next);
    setCopyStatus('');
    setFallbackText(null);
    storage.setJson(RISK_KEY, next);
  }

  function onAdd() {
    const next = addRisk(risks);
    focusRiskId.current = next[next.length - 1]!.id;
    update(next);
  }

  function onRemove(id: string) {
    update(removeRisk(risks, id));
    addButton.current?.focus();
  }

  const sorted = sortRisks(risks);
  const grid = riskGrid(sorted);
  const empty = risks.length === 0;

  async function onCopy() {
    const text = riskTableText(sorted);
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        // Both formats, so docs paste a real table and plain-text boxes get tabs.
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([riskTableHtml(sorted)], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('No clipboard');
      }
      setFallbackText(null);
      setCopyStatus('Copied. Paste it into your report.');
    } catch {
      setFallbackText(text);
      setCopyStatus('Select the text below and copy it.');
    }
  }

  return (
    <div>
      <section aria-labelledby="risk-list-heading" class="max-w-prose">
        <h2 id="risk-list-heading" class="text-3xl font-extrabold">
          Your risks
        </h2>
        {empty && <p class="mt-2 text-muted">No risks yet. Add your first one below.</p>}
        <ol class="mt-4 grid gap-4">
          {risks.map((risk, i) => (
            <li key={risk.id} class="rounded-xl border border-border bg-surface p-4">
              <fieldset>
                <legend class="text-xl font-extrabold">Risk {i + 1}</legend>

                <label for={`${risk.id}-text`} class="mt-2 block font-bold">
                  What could go wrong?
                </label>
                <textarea
                  id={`${risk.id}-text`}
                  rows={2}
                  value={risk.text}
                  onInput={(e) => update(updateRisk(risks, risk.id, { text: e.currentTarget.value }))}
                  class={fieldClass}
                />

                <div class="mt-4 grid gap-4 sm:grid-cols-2">
                  {ratingFields.map(({ field, label }) => (
                    <fieldset key={field}>
                      <legend class="font-bold">{label}</legend>
                      <div class="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                        {ratings.map(({ value, label: valueLabel }) => {
                          const id = `${risk.id}-${field}-${value}`;
                          return (
                            <div key={value} class="flex items-center gap-2">
                              <input
                                type="radio"
                                id={id}
                                name={`${risk.id}-${field}`}
                                value={value}
                                checked={risk[field] === value}
                                onChange={() =>
                                  update(updateRisk(risks, risk.id, { [field]: value as Rating }))
                                }
                                class={`size-5 accent-accent ${focus}`}
                              />
                              <label for={id} class="cursor-pointer">
                                {valueLabel}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>

                <p class="mt-4">
                  <label for={`${risk.id}-mitigant`} class="font-bold">
                    Mitigant
                  </label>{' '}
                  <a href="/glossary#mitigant" class="text-sm">
                    What's a mitigant?
                  </a>
                </p>
                <textarea
                  id={`${risk.id}-mitigant`}
                  rows={2}
                  value={risk.mitigant}
                  onInput={(e) =>
                    update(updateRisk(risks, risk.id, { mitigant: e.currentTarget.value }))
                  }
                  class={fieldClass}
                />

                <button type="button" onClick={() => onRemove(risk.id)} class={`mt-4 ${smallButton}`}>
                  Remove risk {i + 1}
                </button>
              </fieldset>
            </li>
          ))}
        </ol>
        <button
          ref={addButton}
          type="button"
          onClick={onAdd}
          class={`${empty ? 'mt-2' : 'mt-4'} ${primaryButton}`}
        >
          Add a risk
        </button>
      </section>

      {!empty && (
        <section aria-labelledby="risk-sorted-heading" class="mt-10">
          <h2 id="risk-sorted-heading" class="text-3xl font-extrabold">
            Sorted by likelihood × impact
          </h2>
          <div class="mt-4 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div
              role="region"
              aria-labelledby="risk-sorted-heading"
              tabIndex={0}
              class={`overflow-x-auto rounded-xl border border-border bg-surface ${focus}`}
            >
              <table class="w-full border-collapse text-left">
                <caption class="sr-only">Your risks, highest likelihood × impact first</caption>
                <thead>
                  <tr>
                    {['#', 'Risk', 'Likelihood', 'Impact', 'Score', 'Mitigant'].map((h) => (
                      <th key={h} scope="col" class="border-b border-border p-2 align-bottom">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((risk, i) => {
                    const score = riskScore(risk);
                    return (
                      <tr key={risk.id} class="align-top">
                        <th scope="row" class="border-b border-border p-2 font-display text-xl">
                          {i + 1}
                        </th>
                        <td class="min-w-40 border-b border-border p-2">
                          {risk.text.trim() || <span class="text-muted">(not written yet)</span>}
                        </td>
                        <td class="border-b border-border p-2">{ratingLabel(risk.likelihood)}</td>
                        <td class="border-b border-border p-2">{ratingLabel(risk.impact)}</td>
                        <td class="border-b border-border p-2 tabular-nums">
                          {score ?? <span class="text-muted">–</span>}
                        </td>
                        <td class="min-w-40 border-b border-border p-2">
                          {risk.mitigant.trim() || <span class="text-muted">(not written yet)</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <h3 id="risk-grid-heading" class="text-2xl font-extrabold">
                Risk grid
              </h3>
              <p class="mt-1 text-sm text-muted">
                Numbers match the table. Rate a risk's likelihood and impact to place it here.
                Cells marked High have a likelihood × impact of {HIGH_SCORE} or more.
              </p>
              <table class="mt-3 w-full table-fixed border-collapse text-center">
                <caption class="sr-only">
                  Risk numbers by likelihood (rows, high at top) and impact (columns, low at left)
                </caption>
                <thead>
                  <tr>
                    <td class="p-1 text-left text-sm text-muted">
                      <span aria-hidden="true">Likelihood ↓ Impact →</span>
                    </td>
                    {grid[0]!.map((cell) => (
                      <th key={cell.impact} scope="col" class="p-1 text-sm">
                        <span class="sr-only">Impact </span>
                        {ratingLabel(cell.impact)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row) => (
                    <tr key={row[0]!.likelihood}>
                      <th scope="row" class="p-1 text-left text-sm">
                        <span class="sr-only">Likelihood </span>
                        {ratingLabel(row[0]!.likelihood)}
                      </th>
                      {row.map((cell) => {
                        const high = cell.likelihood * cell.impact >= HIGH_SCORE;
                        return (
                          <td
                            key={cell.impact}
                            class={`h-16 border border-border p-1 align-top ${
                              high ? 'bg-highlight text-highlight-contrast' : 'bg-surface'
                            }`}
                          >
                            {high && (
                              <span class="block text-xs font-bold uppercase tracking-wider">
                                High
                                <span class="sr-only"> score</span>
                              </span>
                            )}
                            <span class="block font-display text-xl font-extrabold">
                              {cell.ranks.length > 0 ? (
                                cell.ranks.join(', ')
                              ) : (
                                <span class="sr-only">None</span>
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onCopy} class={primaryButton}>
              Copy as table
            </button>
            <span role="status" class="font-bold">
              {copyStatus}
            </span>
          </div>
          {fallbackText !== null && (
            <div class="mt-4 max-w-prose">
              <label for="risk-copy" class="font-bold">
                Risk table to copy
              </label>
              <textarea
                id="risk-copy"
                ref={fallbackRef}
                readOnly
                rows={Math.min(8, risks.length + 2)}
                value={fallbackText}
                class={fieldClass}
              />
            </div>
          )}
          <p class="mt-3 max-w-prose text-sm text-muted">
            Paste into Google Docs or Word and it becomes a table. If your browser can't copy
            straight to the clipboard, the text below has tabs between columns: paste it into a
            spreadsheet, or into your document and convert it to a table.
          </p>
        </section>
      )}
    </div>
  );
}
