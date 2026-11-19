import { useEffect, useState } from 'preact/hooks';
import {
  SUBMISSION_CHECK_KEY,
  allSubmissionIds,
  parseSubmissionCheck,
  submissionChecklist,
  toggleSubmissionItem,
} from '../lib/submissionCheck';
import { progressLabel } from '../lib/reportCheck';
import { storage } from '../lib/storage';
import { focus } from '../lib/styles';

const groups = submissionChecklist();
const total = allSubmissionIds(groups).length;

const smallButton = `rounded-md border-2 border-muted px-4 py-2 font-bold text-text transition-colors duration-200 enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;

export default function SubmissionCheck() {
  const [checked, setChecked] = useState<string[]>([]);

  // Load saved ticks after mount, so the server render and first client render match.
  useEffect(() => {
    setChecked(parseSubmissionCheck(storage.getJson(SUBMISSION_CHECK_KEY)));
  }, []);

  function update(next: string[]) {
    setChecked(next);
    storage.setJson(SUBMISSION_CHECK_KEY, next);
  }

  const done = new Set(checked);
  const allDone = checked.length === total;

  return (
    <div class="max-w-prose">
      <div class="flex flex-wrap items-center gap-4 rounded-xl bg-tint p-4">
        <p role="status" class="font-display text-3xl font-extrabold">
          {progressLabel(checked, total)}
          {allDone && <span class="block font-sans text-lg font-bold">Ready to send.</span>}
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
            <ul class="mt-2 grid list-none gap-3 pl-0">
              {group.items.map((item) => {
                const id = `submission-check-${item.id.replace(/[^a-z0-9-]/gi, '-')}`;
                return (
                  <li key={item.id} class="mt-0 flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={id}
                      checked={done.has(item.id)}
                      onChange={(e) =>
                        update(toggleSubmissionItem(checked, item.id, e.currentTarget.checked))
                      }
                      class={`mt-1 size-5 shrink-0 accent-accent ${focus}`}
                    />
                    <label for={id} class="cursor-pointer text-lg [overflow-wrap:anywhere]">
                      {item.label}
                    </label>
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
