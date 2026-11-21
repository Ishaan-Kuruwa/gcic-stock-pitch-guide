/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    // Route tests (src/test) render on-demand pages, which read the Worker's
    // bindings from cloudflare:workers. In Node that module doesn't exist.
    alias: { 'cloudflare:workers': new URL('./src/test/cloudflareWorkersStub.ts', import.meta.url).pathname },
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    // A US time zone, so date tests catch dates that shift a day when shown locally.
    env: { TZ: 'America/Los_Angeles' },
  },
});
