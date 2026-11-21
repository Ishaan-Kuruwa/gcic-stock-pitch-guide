/**
 * Permission audit: every on-demand page and API route (GET and each POST
 * action), requested by each kind of viewer, against a real local D1.
 *
 * Read the table as: route → what each viewer gets. A status ending in "w"
 * means the request must change the database; any other status means it
 * must change nothing at all (every table is compared before and after).
 *
 *   200 page or JSON   303 redirect   401 signed out (API)   403 no access   404 hidden
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { completeProfile, syncRole, type Db } from '../db/accounts';
import { checkins, mentorInvites, teamMembers, teams } from '../db/schema';
import { resetDb, signUp, startTestDb, type TestDb } from '../db/testDb';
import { env } from './cloudflareWorkersStub';
import { call, snapshotDb, type CallOptions, type RoutePattern } from './routes';

vi.mock('astro:content', () => ({
  getCollection: async (name: string) =>
    name === 'modules'
      ? [
          { id: '01-intro', data: { number: 1, status: 'live', title: 'Intro' } },
          { id: '02-value', data: { number: 2, status: 'live', title: 'Value' } },
        ]
      : [],
}));

// No Google in tests: Better Auth's calls answer the way they would.
vi.mock('../auth', () => ({
  getAuth: () => ({
    handler: async () => new Response('better-auth', { status: 200 }),
    api: {
      signOut: async () =>
        new Response(null, { headers: { 'Set-Cookie': 'better-auth.session_token=; Max-Age=0; Path=/' } }),
      signInSocial: async () => Response.json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }),
    },
  }),
}));

const ADMIN_EMAILS = ['admin-b@example.com', 'admin-d@example.com'];
const CLUB_CODE = 'GREENHOPE';

let testDb: TestDb;
let db: Db;

beforeAll(async () => {
  testDb = await startTestDb();
  db = testDb.db;
  env.DB = testDb.d1;
  env.ADMIN_EMAILS = ADMIN_EMAILS.join(',');
  env.CLUB_CODE = CLUB_CODE;
}, 60_000);

afterAll(async () => {
  await testDb?.dispose();
});

beforeEach(async () => {
  await resetDb(db);
  await seed();
});

// ---------------------------------------------------------------------------
// The club in every test
// ---------------------------------------------------------------------------

/** The eight viewers, in table column order. */
const VIEWERS = [
  'signedOut',
  'noProfile',
  'menteeOnTeam',
  'menteeOffTeam',
  'mentorAssigned',
  'mentorUnassigned',
  'admin',
  'adminAsMentor',
] as const;
type Viewer = (typeof VIEWERS)[number];

const USER: Record<Viewer, string | null> = {
  signedOut: null,
  noProfile: 'no-profile',
  menteeOnTeam: 'm1', // on team T
  menteeOffTeam: 'm2', // on no team
  mentorAssigned: 'mentor-a', // mentors team T
  mentorUnassigned: 'mentor-c', // mentors nothing
  admin: 'admin-d', // assigned to nothing
  adminAsMentor: 'admin-b', // mentors team V
};

/**
 * Team routes target team T, where each viewer is what their name says.
 * The admin-as-mentor targets team V, the team they mentor.
 */
function target(viewer: Viewer) {
  return viewer === 'adminAsMentor'
    ? { teamId: 'team-v', checkinId: 'checkin-v', joinCode: 'VVVVVV' }
    : { teamId: 'team-t', checkinId: 'checkin-t', joinCode: 'TTTTTT' };
}

async function person(id: string, email: string, role: 'mentee' | 'mentor' | 'admin') {
  await signUp(db, id, email);
  if (role === 'mentor') await db.insert(mentorInvites).values({ email });
  await syncRole(db, id, ADMIN_EMAILS);
  await completeProfile(db, id, { name: `Person ${id}`, grade: role === 'mentee' ? 10 : 12, codeOk: role === 'mentee' });
}

async function seed() {
  await signUp(db, 'no-profile', 'no-profile@example.com');
  await person('m1', 'm1@example.com', 'mentee');
  await person('m2', 'm2@example.com', 'mentee');
  await person('m3', 'm3@example.com', 'mentee');
  await person('mentor-a', 'mentor-a@example.com', 'mentor');
  await person('mentor-c', 'mentor-c@example.com', 'mentor');
  await person('admin-b', 'admin-b@example.com', 'admin');
  await person('admin-d', 'admin-d@example.com', 'admin');
  await db.insert(teams).values([
    { id: 'team-t', name: 'Team T', joinCode: 'TTTTTT', mentorshipStatus: 'mentored', mentorId: 'mentor-a' },
    { id: 'team-v', name: 'Team V', joinCode: 'VVVVVV', mentorshipStatus: 'mentored', mentorId: 'admin-b' },
  ]);
  await db.insert(teamMembers).values([
    { teamId: 'team-t', userId: 'm1' },
    { teamId: 'team-v', userId: 'm3' },
  ]);
  const note = { metOn: '2026-11-01', covered: 'Comps.', nextStep: '', status: 'on-track' as const };
  await db.insert(checkins).values([
    { id: 'checkin-t', teamId: 'team-t', mentorId: 'mentor-a', ...note },
    { id: 'checkin-v', teamId: 'team-v', mentorId: 'admin-b', ...note },
  ]);
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

type Request = Omit<CallOptions, 'userId'> & { route: RoutePattern };
type Expected = [string, string, string, string, string, string, string, string];

interface Row {
  name: string;
  request: (viewer: Viewer) => Request;
  expect: Expected;
}

const get = (route: RoutePattern): Row['request'] => () => ({ route });
const post =
  (route: RoutePattern, form: Record<string, string | string[]> = {}): Row['request'] =>
  () => ({ route, method: 'POST', form });

/** A team-page request, aimed at the viewer's target team. */
function team(
  form?: (t: ReturnType<typeof target>) => Record<string, string | string[]>,
  suffix = '',
): Row['request'] {
  return (viewer) => {
    const t = target(viewer);
    return {
      route: suffix ? '/team/[id]/leave' : '/team/[id]',
      path: `/team/${t.teamId}${suffix}`,
      params: { id: t.teamId },
      ...(form ? { method: 'POST' as const, form: form(t) } : {}),
    };
  };
}

const checkinForm = { met_on: '2026-11-10', covered: 'Went over the thesis.', next_step: '', status: 'behind' };

// prettier-ignore
const matrix: Row[] = [
  //                                                                         signedOut noProfile onTeam offTeam mentorA mentorC admin  adminMentor
  { name: 'GET /account',                  request: get('/account'),              expect: ['200', '303', '200', '200', '200', '200', '200', '200'] },
  { name: 'GET /join',                     request: get('/join'),                 expect: ['303', '200w', '303', '303', '303', '303', '303', '303'] },
  { name: 'POST /join',                    request: post('/join', { name: 'New Person', grade: '10', code: CLUB_CODE }),
                                                                                  expect: ['303', '303w', '303', '303', '303', '303', '303', '303'] },
  { name: 'GET /account/delete',           request: get('/account/delete'),       expect: ['303', '200', '200', '200', '200', '200', '200', '200'] },
  { name: 'POST /account/delete',          request: post('/account/delete'),      expect: ['303', '303w', '303w', '303w', '303w', '303w', '303w', '303w'] },
  { name: 'POST /account/sign-in',         request: post('/account/sign-in'),     expect: ['303', '303', '303', '303', '303', '303', '303', '303'] },
  { name: 'POST /account/sign-out',        request: post('/account/sign-out'),    expect: ['303', '303', '303', '303', '303', '303', '303', '303'] },
  { name: 'GET /api/auth/*',               request: () => ({ route: '/api/auth/[...all]', path: '/api/auth/get-session' }),
                                                                                  expect: ['200', '200', '200', '200', '200', '200', '200', '200'] },
  { name: 'GET /api/progress',             request: get('/api/progress'),         expect: ['401', '403', '200', '200', '200', '200', '200', '200'] },
  { name: 'POST /api/progress',            request: () => ({ route: '/api/progress', method: 'POST', json: { slug: 'intro', done: true } }),
                                                                                  expect: ['401', '403', '200w', '200w', '200w', '200w', '200w', '200w'] },
  { name: 'GET /mentor',                   request: get('/mentor'),               expect: ['303', '303', '403', '403', '200', '200', '200', '200'] },
  { name: 'GET /admin/teams',              request: get('/admin/teams'),          expect: ['303', '303', '403', '403', '403', '403', '200', '200'] },
  { name: 'GET /admin/teams.csv',          request: get('/admin/teams.csv'),      expect: ['303', '303', '403', '403', '403', '403', '200', '200'] },
  { name: 'GET /admin/mentors',            request: get('/admin/mentors'),        expect: ['303', '303', '403', '403', '403', '403', '200', '200'] },
  { name: 'POST /admin/mentors add',       request: post('/admin/mentors', { action: 'add', email: 'new-mentor@example.com' }),
                                                                                  expect: ['303', '303', '403', '403', '403', '403', '303w', '303w'] },
  { name: 'POST /admin/mentors remove',    request: post('/admin/mentors', { action: 'remove', email: 'mentor-c@example.com' }),
                                                                                  expect: ['303', '303', '403', '403', '403', '403', '303w', '303w'] },
  { name: 'GET /admin/season',             request: get('/admin/season'),         expect: ['303', '303', '403', '403', '403', '403', '200', '200'] },
  { name: 'POST /admin/season wrong',      request: post('/admin/season', { confirm: 'delete season' }),
                                                                                  expect: ['303', '303', '403', '403', '403', '403', '200', '200'] },
  { name: 'POST /admin/season',            request: post('/admin/season', { confirm: 'DELETE SEASON' }),
                                                                                  expect: ['303', '303', '403', '403', '403', '403', '303w', '303w'] },
  { name: 'GET /team/new',                 request: get('/team/new'),             expect: ['303', '303', '200', '200', '403', '403', '403', '403'] },
  { name: 'POST /team/new',                request: post('/team/new', { name: 'Fresh Team' }),
                                                                                  expect: ['303', '303', '200', '303w', '403', '403', '403', '403'] },
  { name: 'GET /team/join',                request: get('/team/join'),            expect: ['303', '303', '200', '200', '403', '403', '403', '403'] },
  { name: 'POST /team/join',               request: post('/team/join', { code: 'TTTTTT' }),
                                                                                  expect: ['303', '303', '200', '303w', '403', '403', '403', '403'] },
  { name: 'POST /team/join wrong code',    request: post('/team/join', { code: 'ZZZZZZ' }),
                                                                                  expect: ['303', '303', '200', '200w', '403', '403', '403', '403'] },
  { name: 'GET /team/[id]',                request: team(),                       expect: ['303', '303', '200', '404', '200', '404', '200', '200'] },
  { name: 'GET /team/[id] missing team',   request: () => ({ route: '/team/[id]', path: '/team/nope', params: { id: 'nope' } }),
                                                                                  expect: ['303', '303', '404', '404', '404', '404', '404', '404'] },
  { name: 'POST /team/[id] details',       request: team(() => ({ action: 'details', company: 'Apple', ticker: 'AAPL' })),
                                                                                  expect: ['303', '303', '303w', '404', '303', '404', '303', '303'] },
  { name: 'POST /team/[id] links',         request: team(() => ({ action: 'links', 'link-report': 'https://docs.google.com/document/d/abc' })),
                                                                                  expect: ['303', '303', '303w', '404', '303', '404', '303', '303'] },
  { name: 'POST /team/[id] new-code',      request: team(() => ({ action: 'new-code' })),
                                                                                  expect: ['303', '303', '303w', '404', '303', '404', '303', '303'] },
  { name: 'POST /team/[id] milestones (member)',
                                           request: team(() => ({ action: 'milestones', shown: 'company-picked:0', milestone: 'company-picked' })),
                                                                                  expect: ['303', '303', '303w', '404', '303', '404', '303', '303'] },
  { name: 'POST /team/[id] milestones (mentor review)',
                                           request: team(() => ({ action: 'milestones', shown: 'mentor-review:0', milestone: 'mentor-review' })),
                                                                                  expect: ['303', '303', '303', '404', '303w', '404', '303', '303w'] },
  { name: 'POST /team/[id] checkin-add',   request: team(() => ({ action: 'checkin-add', ...checkinForm })),
                                                                                  expect: ['303', '303', '303', '404', '303w', '404', '303', '303w'] },
  { name: 'POST /team/[id] checkin-edit',  request: team((t) => ({ action: 'checkin-edit', checkin_id: t.checkinId, ...checkinForm })),
                                                                                  expect: ['303', '303', '303', '404', '303w', '404', '303', '303w'] },
  { name: 'POST /team/[id] mentorship',    request: team(() => ({ action: 'mentorship', mentorship_status: 'mentored', mentor_id: 'mentor-c' })),
                                                                                  expect: ['303', '303', '303', '404', '303', '404', '303w', '303w'] },
  { name: 'GET /team/[id]/leave',          request: team(undefined, '/leave'),    expect: ['303', '303', '200', '404', '404', '404', '404', '404'] },
  { name: 'POST /team/[id]/leave',         request: team(() => ({}), '/leave'),   expect: ['303', '303', '303w', '404', '404', '404', '404', '404'] },
];

/** Where each redirect a denial sends people. */
const deniedLocation: Partial<Record<Viewer, string>> = { signedOut: '/account', noProfile: '/join' };

describe.each(matrix)('$name', ({ request, expect: expected }) => {
  it.each(VIEWERS.map((viewer, i) => ({ viewer, want: expected[i] })))('$viewer → $want', async ({ viewer, want }) => {
    const { route, ...options } = request(viewer);
    const before = await snapshotDb(testDb.d1);
    const res = await call(db, route, { ...options, userId: USER[viewer] });
    const after = await snapshotDb(testDb.d1);

    const status = want.replace('w', '');
    expect(res.status).toBe(Number(status));
    if (want.endsWith('w')) expect(after, 'expected a write').not.toBe(before);
    else expect(after, 'expected no write').toBe(before);
    // Personal answers are never kept in a shared cache.
    if (res.status === 200 && route !== '/api/auth/[...all]') {
      expect(res.headers.get('Cache-Control')).toMatch(/private, no-store/);
    }
  });
});

// Signed out and unfinished profiles are always sent to sign in or /join,
// on pages (APIs answer 401/403 instead).
describe('denials redirect to the right place', () => {
  it.each(
    matrix
      .filter((row) => !row.name.includes('/api/') && !row.name.includes('sign-'))
      .flatMap((row) =>
        (['signedOut', 'noProfile'] as const).map((viewer) => ({
          name: row.name,
          viewer,
          row,
          want: row.expect[VIEWERS.indexOf(viewer)],
        })),
      )
      .filter(({ want, viewer, name }) => want === '303' && !(viewer === 'noProfile' && name.startsWith('POST /join'))),
  )('$name as $viewer', async ({ row, viewer }) => {
    const { route, ...options } = row.request(viewer);
    const res = await call(db, route, { ...options, userId: USER[viewer] });
    // /account sends an unfinished profile to /join; /join sends a finished one to /account.
    expect(res.headers.get('Location')).toBe(deniedLocation[viewer]);
  });
});

// A POST from another site is refused and changes nothing, even from a viewer
// who could send that form. (Better Auth's own /api/auth routes do their own
// origin check and aren't listed.)
describe('cross-site POSTs are refused', () => {
  const rows = matrix.filter((row) => row.name.startsWith('POST') && row.expect.some((e) => e.endsWith('w')));
  it.each(
    rows.map((row) => ({ name: row.name, row, viewer: VIEWERS[row.expect.findIndex((e) => e.endsWith('w'))] })),
  )('$name as $viewer', async ({ row, viewer }) => {
    const { route, ...options } = row.request(viewer);
    const before = await snapshotDb(testDb.d1);
    const res = await call(db, route, { ...options, userId: USER[viewer], origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(await snapshotDb(testDb.d1)).toBe(before);
  });

  it.each([
    { route: '/account/sign-in' as const, viewer: 'signedOut' as const },
    { route: '/account/sign-out' as const, viewer: 'menteeOnTeam' as const },
    { route: '/team/new' as const, viewer: 'menteeOnTeam' as const },
    { route: '/team/join' as const, viewer: 'menteeOnTeam' as const },
  ])('$route as $viewer', async ({ route, viewer }) => {
    const res = await call(db, route, { method: 'POST', form: {}, userId: USER[viewer], origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });
});
