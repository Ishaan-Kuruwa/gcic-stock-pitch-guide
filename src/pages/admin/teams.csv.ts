import type { APIRoute } from 'astro';
import { getDb } from '../../db/client';
import { getTeamsOverview } from '../../db/mentorship';
import { toCsv } from '../../lib/csv';
import { denied, requireRole } from '../../lib/guards';
import { teamsCsvFilename, teamsCsvRows } from '../../lib/mentorship';
import { todayIn } from '../../lib/milestones';

export const prerender = false;

/**
 * /admin/teams.csv: the All teams table as a spreadsheet, for admins only.
 * No emails and no check-in notes (see teamsCsvRows).
 */
export const GET: APIRoute = async (context) => {
  const access = requireRole(context.locals, 'admin');
  if (!access.ok) return denied(context, access);

  const today = todayIn();
  const csv = toCsv(teamsCsvRows(await getTeamsOverview(getDb()), today));
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${teamsCsvFilename(today)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
};
