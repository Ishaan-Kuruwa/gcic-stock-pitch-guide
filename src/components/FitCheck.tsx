import { useEffect, useState } from 'preact/hooks';
import { claimBoardUrl } from '../data/club';
import { fitQuestions } from '../data/fitcheck';
import {
  FIT_KEY,
  emptyAnswers,
  fitHeadline,
  fitResult,
  parseFitCheck,
  type Answer,
  type Answers,
} from '../lib/fitcheck';
import { storage } from '../lib/storage';
import { focus } from '../lib/styles';

const choices: { value: Answer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const smallButton = 'rounded-md px-4 py-2 font-bold transition-colors duration-200';

export default function FitCheck() {
  const [company, setCompany] = useState('');
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);

  // Load the last answers after mount, so the server render and first client render match.
  useEffect(() => {
    const saved = parseFitCheck(storage.getJson(FIT_KEY));
    setCompany(saved.company);
    setAnswers(saved.answers);
  }, []);

  function save(nextCompany: string, nextAnswers: Answers) {
    storage.setJson(FIT_KEY, { company: nextCompany, answers: nextAnswers });
  }

  function onCompany(value: string) {
    setCompany(value);
    save(value, answers);
  }

  function onAnswer(index: number, value: Answer) {
    const next = answers.map((a, i) => (i === index ? value : a));
    setAnswers(next);
    save(company, next);
  }

  function onReset() {
    const cleared = emptyAnswers();
    setCompany('');
    setAnswers(cleared);
    save('', cleared);
  }

  const result = fitResult(answers);
  const headline = fitHeadline(result, company);

  return (
    <div class="max-w-prose">
      <label for="fit-company" class="block text-lg font-bold">
        Company name <span class="font-normal text-muted">(optional)</span>
      </label>
      <input
        id="fit-company"
        type="text"
        autocomplete="off"
        value={company}
        onInput={(e) => onCompany(e.currentTarget.value)}
        class={`mt-1 w-full rounded-md border-2 border-muted bg-surface p-3 text-text ${focus}`}
      />

      <ol class="mt-6 grid gap-4">
        {fitQuestions.map((question, i) => (
          <li key={question} class="rounded-xl border border-border bg-surface p-4">
            <fieldset>
              <legend class="text-lg font-bold">
                <span class="text-muted">{i + 1}. </span>
                {question}
              </legend>
              <div class="mt-3 flex flex-wrap gap-6">
                {choices.map(({ value, label }) => {
                  const id = `fit-q${i}-${value}`;
                  return (
                    <div key={value} class="flex items-center gap-2">
                      <input
                        type="radio"
                        id={id}
                        name={`fit-q${i}`}
                        value={value}
                        checked={answers[i] === value}
                        onChange={() => onAnswer(i, value)}
                        class={`size-5 accent-accent ${focus}`}
                      />
                      <label for={id} class="cursor-pointer text-lg">
                        {label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <section aria-labelledby="fit-result-heading" class="mt-8 rounded-xl bg-tint p-card">
        <h2 id="fit-result-heading" class="text-3xl font-extrabold">
          Result
        </h2>
        <div aria-live="polite">
          {result === 'incomplete' && (
            <p class="mt-2 text-muted">Answer the questions above to see your result.</p>
          )}
          {headline && <p class="mt-2 text-xl font-bold">{headline}</p>}
          {result === 'good' && (
            <p class="mt-2">
              Next, check the <a href={claimBoardUrl}>claim board</a> and claim it if it's open.
            </p>
          )}
          {result === 'mixed' && (
            <aside
              role="note"
              class="my-4 rounded-lg border-2 border-dashed border-border border-l-[6px] border-l-highlight bg-surface p-4 [border-left-style:solid]"
            >
              <p class="font-bold">TODO: Guidance when question 4 or 5 is "no"</p>
              <p class="text-muted">
                Module 1 doesn't say what to do yet when a company passes questions 1–3 but not 4 or 5. A
                GHIC officer needs to write this guidance.
              </p>
            </aside>
          )}
        </div>
        <button
          type="button"
          onClick={onReset}
          class={`mt-4 border-2 border-muted text-text hover:border-accent ${smallButton} ${focus}`}
        >
          Check another company
        </button>
      </section>
    </div>
  );
}
