/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    // A US time zone, so date tests catch dates that shift a day when shown locally.
    env: { TZ: 'America/Los_Angeles' },
  },
});
