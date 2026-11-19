import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatCurrency, formatMultiple } from '../lib/format';
import { storage } from '../lib/storage';
import { focus } from '../lib/styles';
import {
  MAX_PEERS,
  PE_KEY,
  displayedPeers,
  displayedSensitivity,
  displayedValuation,
  emptyPECalculator,
  mathLines,
  parseNumberInput,
  parsePECalculator,
  upsideLabel,
  type PECalculatorState,
} from '../lib/valuation';

type MainField = 'price' | 'eps' | 'pe';

const fields: { id: MainField; label: ComponentChildren }[] = [
  { id: 'price', label: 'Current share price ($)' },
  {
    id: 'eps',
    label: (
      <>
        Forecast <a href="/glossary#eps">EPS</a> ($)
      </>
    ),
  },
  {
    id: 'pe',
    label: (
      <>
        Target <a href="/glossary#pe-ratio">P/E</a>
      </>
    ),
  },
];

const inputClass = `w-full rounded-md border-2 border-muted bg-surface p-3 text-lg text-text aria-[invalid=true]:border-l-8 ${focus}`;
const smallButton = `rounded-md border-2 border-muted px-4 py-2 font-bold text-text transition-colors duration-200 hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;

interface Props {
  /** Level for this tool's section headings, so they fit under the page's own headings. */
  headingLevel?: 2 | 3 | 4;
}

export default function PECalculator({ headingLevel = 2 }: Props) {
  const Heading = `h${headingLevel}` as 'h2';
  const [state, setState] = useState<PECalculatorState>(emptyPECalculator);
  const peerInputs = useRef<(HTMLInputElement | null)[]>([]);
  const addButton = useRef<HTMLButtonElement>(null);
  const focusPeer = useRef<number | null>(null);

  // Load saved numbers after mount, so the server render and first client render match.
  useEffect(() => {
    setState(parsePECalculator(storage.getJson(PE_KEY)));
  }, []);

  useEffect(() => {
    if (focusPeer.current !== null) {
      peerInputs.current[focusPeer.current]?.focus();
      focusPeer.current = null;
    }
  });

  function update(next: PECalculatorState) {
    setState(next);
    storage.setJson(PE_KEY, next);
  }

  function setPeer(index: number, value: string) {
    update({ ...state, peers: state.peers.map((p, i) => (i === index ? value : p)) });
  }

  function addPeer() {
    if (state.peers.length >= MAX_PEERS) return;
    focusPeer.current = state.peers.length;
    update({ ...state, peers: [...state.peers, ''] });
  }

  function removePeer(index: number) {
    update({ ...state, peers: state.peers.filter((_, i) => i !== index) });
    addButton.current?.focus();
  }

  const check = displayedValuation({
    price: parseNumberInput(state.price),
    eps: parseNumberInput(state.eps),
    pe: parseNumberInput(state.pe),
  });
  const peers = displayedPeers(state.peers);
  const value = check.ok ? check.value : null;
  const grid = value ? displayedSensitivity(value.eps, value.pe) : null;
  const lines = value ? mathLines(value, peers) : [];

  /** Only flag a box once something is typed in it; blank boxes get the prompt below. */
  function errorFor(id: MainField): string | null {
    return state[id].trim() === '' ? null : (check.errors[id] ?? null);
  }

  return (
    <div class="max-w-prose">
      <div class="grid gap-5 sm:grid-cols-3 sm:gap-4">
        {fields.map(({ id, label }) => {
          const error = errorFor(id);
          const inputId = `pe-calc-${id}`;
          return (
            <div key={id}>
              <label for={inputId} class="block text-lg font-bold">
                {label}
              </label>
              <input
                id={inputId}
                type="text"
                inputMode="decimal"
                autocomplete="off"
                value={state[id]}
                onInput={(e) => update({ ...state, [id]: e.currentTarget.value })}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? `${inputId}-error` : undefined}
                class={`mt-1 ${inputClass}`}
              />
              {error && (
                <p id={`${inputId}-error`} class="mt-1 font-bold text-text">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <fieldset class="mt-8 rounded-xl border border-border bg-surface p-4">
        <legend class="px-1 text-lg font-bold">
          Peer P/E ratios <span class="font-normal text-muted">(optional)</span>
        </legend>
        {state.peers.length > 0 && (
          <ol class="m-0 grid list-none gap-3 p-0">
            {state.peers.map((peer, i) => {
              const inputId = `pe-calc-peer-${i}`;
              const error = peers.rowErrors[i];
              return (
                <li key={i}>
                  <label for={inputId} class="block font-bold">
                    Peer {i + 1} P/E
                  </label>
                  <div class="mt-1 flex gap-2">
                    <input
                      id={inputId}
                      ref={(el) => {
                        peerInputs.current[i] = el;
                      }}
                      type="text"
                      inputMode="decimal"
                      autocomplete="off"
                      value={peer}
                      onInput={(e) => setPeer(i, e.currentTarget.value)}
                      aria-invalid={error ? 'true' : undefined}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      class={`min-w-0 flex-1 ${inputClass}`}
                    />
                    <button
                      type="button"
                      onClick={() => removePeer(i)}
                      aria-label={`Remove peer ${i + 1}`}
                      class={smallButton}
                    >
                      Remove
                    </button>
                  </div>
                  {error && (
                    <p id={`${inputId}-error`} class="mt-1 font-bold text-text">
                      {error}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <button
          type="button"
          ref={addButton}
          onClick={addPeer}
          disabled={state.peers.length >= MAX_PEERS}
          class={`${state.peers.length > 0 ? 'mt-4' : ''} ${smallButton}`}
        >
          Add peer
        </button>

        {peers.stats && (
          <div class="mt-4 border-t border-border pt-4" aria-live="polite">
            <dl class="grid grid-cols-3 gap-2">
              <div>
                <dt class="text-muted">Peers</dt>
                <dd class="font-display text-2xl font-extrabold">{peers.stats.count}</dd>
              </div>
              <div>
                <dt class="text-muted">Average P/E</dt>
                <dd class="font-display text-2xl font-extrabold">{formatMultiple(peers.stats.average)}</dd>
              </div>
              <div>
                <dt class="text-muted">Median P/E</dt>
                <dd class="font-display text-2xl font-extrabold">{formatMultiple(peers.stats.median)}</dd>
              </div>
            </dl>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => peers.stats && update({ ...state, pe: String(peers.stats.average) })}
                class={smallButton}
              >
                Use average as target P/E
              </button>
              <button
                type="button"
                onClick={() => peers.stats && update({ ...state, pe: String(peers.stats.median) })}
                class={smallButton}
              >
                Use median as target P/E
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <section aria-labelledby="pe-calc-result-heading" class="mt-8 rounded-xl bg-tint p-card">
        <Heading id="pe-calc-result-heading" class="text-3xl font-extrabold">
          Result
        </Heading>
        <div aria-live="polite">
          {value ? (
            <>
              <p class="mt-2 text-muted">
                <a href="/glossary#target-price">Target price</a>
              </p>
              <p class="font-display text-5xl font-black">{formatCurrency(value.target)}</p>
              <p class="mt-1 text-xl font-bold">
                {value.upside !== null
                  ? `${upsideLabel(value.upside)} from ${formatCurrency(value.price as number)}`
                  : 'Enter the current price to see upside or downside.'}
              </p>
            </>
          ) : (
            <p class="mt-2 text-muted">Enter a forecast EPS and a target P/E to see a target price.</p>
          )}
        </div>
        <button type="button" onClick={() => update(emptyPECalculator())} class={`mt-4 ${smallButton}`}>
          Clear all
        </button>
      </section>

      {value && grid && (
        <>
          <section aria-labelledby="pe-calc-math-heading" class="mt-8">
            <Heading id="pe-calc-math-heading" class="text-3xl font-extrabold">
              Show the math
            </Heading>
            <p class="mt-2 text-muted">
              These lines use the rounded numbers shown above, so they add up when you copy them.
            </p>
            <div class="mt-3 grid gap-2 rounded-xl border border-border bg-surface p-4">
              {lines.map((line) => (
                <p key={line} class="break-words">
                  {line}
                </p>
              ))}
            </div>
          </section>

          <section aria-labelledby="pe-calc-grid-heading" class="mt-8">
            <Heading id="pe-calc-grid-heading" class="text-3xl font-extrabold">
              Sensitivity grid
            </Heading>
            <p id="pe-calc-grid-note" class="mt-2 text-muted">
              Target price for each forecast EPS (rows) and target P/E (columns). Steps are 10% and 20%
              below and above your numbers. The highlighted middle cell uses your numbers.
            </p>
            <div
              role="region"
              aria-labelledby="pe-calc-grid-heading"
              tabIndex={0}
              class={`mt-3 overflow-x-auto rounded-xl border border-border bg-surface ${focus}`}
            >
              <table class="w-full border-collapse text-right tabular-nums">
                <caption class="sr-only">
                  Target price for each forecast EPS (rows) and target P/E (columns)
                </caption>
                <thead>
                  <tr>
                    <th scope="col" class="border-b border-border p-2 text-left">
                      EPS <span aria-hidden="true">\</span>
                      <span class="sr-only">by</span> P/E
                    </th>
                    {grid.peAxis.map((pe, c) => (
                      <th
                        key={c}
                        scope="col"
                        class={`border-b border-border p-2 ${c === grid.centerCol ? 'bg-tint' : ''}`}
                      >
                        {formatMultiple(pe)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.grid.map((row, r) => (
                    <tr key={r}>
                      <th
                        scope="row"
                        class={`border-b border-border p-2 text-left ${r === grid.centerRow ? 'bg-tint' : ''}`}
                      >
                        {formatCurrency(grid.epsAxis[r])}
                      </th>
                      {row.map((cell, c) => {
                        const center = r === grid.centerRow && c === grid.centerCol;
                        return (
                          <td
                            key={c}
                            class={`border-b border-border p-2 ${center ? 'bg-tint font-extrabold outline-2 -outline-offset-2 outline-accent' : ''}`}
                          >
                            {formatCurrency(cell)}
                            {center && <span class="sr-only"> (your numbers)</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
