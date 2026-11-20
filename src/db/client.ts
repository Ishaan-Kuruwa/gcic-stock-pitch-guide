/**
 * Drizzle client for the Worker's D1 binding. Server-only: import from
 * on-demand routes and middleware, never from prerendered pages.
 */
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { appSchema } from './schema';
import type { Db } from './accounts';

let instance: Db | undefined;

export function getDb(): Db {
  instance ??= drizzle(env.DB, { schema: appSchema });
  return instance;
}
