/**
 * Test stand-in for the `cloudflare:workers` module (aliased in
 * vitest.config.ts). Route tests fill `env` with a local D1 database and the
 * secrets a route reads; app code imports it exactly as it would in the Worker.
 */
export const env: Record<string, unknown> = {};
