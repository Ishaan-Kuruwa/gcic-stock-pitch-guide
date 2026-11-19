import { describe, expect, it } from 'vitest';
import { fitQuestions } from '../data/fitcheck';
import { emptyAnswers, fitHeadline, fitResult, parseFitCheck, type Answers } from './fitcheck';
import { createStore, type StorageLike } from './storage';
import module1 from '../content/modules/01-pick-your-company.mdx?raw';

const yes5: Answers = ['yes', 'yes', 'yes', 'yes', 'yes'];

describe('fitQuestions', () => {
  it("match module 1's five questions word for word", () => {
    const section = module1.split('### What makes a good first pick')[1]?.split('###')[0] ?? '';
    fitQuestions.forEach((q, i) => {
      expect(section).toContain(`${i + 1}. **${q}**`);
    });
  });
});

describe('fitResult', () => {
  it('is incomplete with no answers', () => {
    expect(fitResult(emptyAnswers())).toBe('incomplete');
  });

  it('says cross off as soon as question 1, 2, or 3 is no', () => {
    for (const i of [0, 1, 2]) {
      const a = emptyAnswers();
      a[i] = 'no';
      expect(fitResult(a)).toBe('cross-off');
    }
  });

  it('is good when all five are yes', () => {
    expect(fitResult(yes5)).toBe('good');
  });

  it('is mixed when 1–3 are yes and 4 or 5 is no', () => {
    expect(fitResult(['yes', 'yes', 'yes', 'no', 'yes'])).toBe('mixed');
    expect(fitResult(['yes', 'yes', 'yes', 'yes', 'no'])).toBe('mixed');
  });

  it('a no on 4 or 5 alone is not a cross-off', () => {
    expect(fitResult([null, null, null, 'no', null])).toBe('incomplete');
  });
});

describe('fitHeadline', () => {
  it('uses the company name', () => {
    expect(fitHeadline('good', ' Costco ')).toBe('Costco looks like a good first pick.');
    expect(fitHeadline('cross-off', 'Costco')).toBe('Cross Costco off your list and pick another company.');
  });

  it('falls back when no name is given', () => {
    expect(fitHeadline('good', '  ')).toBe('This company looks like a good first pick.');
    expect(fitHeadline('cross-off', '')).toBe('Cross this company off your list and pick another company.');
  });

  it('has no headline for mixed or incomplete', () => {
    expect(fitHeadline('mixed', 'Costco')).toBeNull();
    expect(fitHeadline('incomplete', 'Costco')).toBeNull();
  });
});

describe('parseFitCheck', () => {
  it('reads saved state', () => {
    expect(parseFitCheck({ company: 'Costco', answers: ['yes', 'no', null, 'yes', 'no'] })).toEqual({
      company: 'Costco',
      answers: ['yes', 'no', null, 'yes', 'no'],
    });
  });

  it('resets malformed data', () => {
    expect(parseFitCheck(null)).toEqual({ company: '', answers: emptyAnswers() });
    expect(parseFitCheck({ company: 5, answers: ['maybe', true] })).toEqual({
      company: '',
      answers: emptyAnswers(),
    });
  });

  it('round-trips through a blocked store in memory', () => {
    const throwing: StorageLike = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
    };
    const store = createStore(() => throwing);
    expect(store.setJson('fit-check', { company: 'Costco', answers: yes5 })).toBe(false);
    expect(parseFitCheck(store.getJson('fit-check'))).toEqual({ company: 'Costco', answers: yes5 });
  });
});
