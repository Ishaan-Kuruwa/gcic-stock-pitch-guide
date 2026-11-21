import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getDb } from '../../db/client';
import { moduleCatalog } from '../../lib/modules';
import { handleProgressRequest } from '../../lib/progressApi';

// The signed-in user's module ticks (see src/lib/progressApi.ts).
export const prerender = false;

export const ALL: APIRoute = async ({ request, locals }) =>
  handleProgressRequest(request, locals, {
    db: getDb(),
    catalog: moduleCatalog(await getCollection('modules')),
  });
