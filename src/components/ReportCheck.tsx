import { useEffect, useState } from 'preact/hooks';
import {
  REPORT_CHECK_KEY,
  allItemIds,
  parseReportCheck,
  progressLabel,
  reportChecklist,
  toggleItem,
} from '../lib/reportCheck';
import { storage } from '../lib/storage';
import { focus } from '../lib/styles';

const groups = reportChecklist();
const total = allItemIds(groups).length;

const smallButton = `rounded-md border-2 border-muted px-4 py-2 font-bold text-text transition-colors duration-200 enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;

export default function ReportCheck() {
  const [checked, setChecked] = useState<string[]>([]);

  // Load saved ticks after mount, so the server render and first client render match.
  useEffect(() => {
    setChecked(parseReportCheck(storage.getJson(REPORT_CHECK_KEY)));
  }, []);

  function update(next: string[]) {
    setChecked(next);
    storage.setJson(REPORT_CHECK_KEY, next);
  }

  const done = new Set(checked);

  return (
    <div class="max-w-prose">
      <div class="flex flex-wrap items-center gap-4 rounded-xl bg-tint p-4">
        <p role="status" class="font-display text-3xl font-extrabold">
          {progressLabel(checked, total)}
        </p>
        <button
          type="button"
          onClick={() => update([])}
          disabled={checked.length === 0}
          class={`ml-auto ${smallButton}`}
        >
          Clear all
        </button>
      </div>

      <div class="mt-6 grid gap-6">
        {groups.map((group) => (
          <fieldset key={group.id} class="rounded-xl border border-border bg-surface p-4">
            <legend class="px-1 text-2xl font-extrabold">{group.label}</legend>
            <ul class="mt-2 grid gap-3">
              {group.items.map((item) => {
                const id = `report-check-${item.id.replace(/[^a-z0-9-]/gi, '-')}`;
                return (
                  <li key={item.id} class="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={id}
                      checked={done.has(item.id)}
                      onChange={(e) => update(toggleItem(checked, item.id, e.currentTarget.checked))}
                      class={`mt-1 size-5 shrink-0 accent-accent ${focus}`}
                    />
                    <span>
                      <label for={id} class="cursor-pointer text-lg [overflow-wrap:anywhere]">
                        {item.label}
                      </label>
                      {item.glossaryId && (
                        <>
                          {' '}
                          <a href={`/glossary#${item.glossaryId}`} class="text-sm">
                            What's this?<span class="sr-only"> ({item.label})</span>
                          </a>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
