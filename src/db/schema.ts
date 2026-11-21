/**
 * Accounts database (Cloudflare D1, SQLite). The first four are Better Auth's
 * core tables, matching `getAuthTables()` in better-auth 1.7; the club tables
 * (profiles, mentor_invites, club_code_attempts), team tables, progress
 * tables and check-ins follow. Change this file, then run `npm run db:generate`
 * to write a new migration in drizzle/migrations.
 *
 * Data rule (CLAUDE.md): Google name and email only. `user.image` and the
 * token columns on `account` exist because Better Auth expects them, but
 * src/lib/authOptions.ts always writes null to them.
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Milliseconds since the epoch, as Better Auth's own generator writes it. */
const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(nowMs)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(nowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

/** Passed to Better Auth's Drizzle adapter; keys are Better Auth's model names. */
export const authSchema = { user, session, account, verification };

// ---------------------------------------------------------------------------
// Club tables (Phase B). Ours, not Better Auth's.
// ---------------------------------------------------------------------------

export const ROLES = ['mentee', 'mentor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/**
 * One row per signed-in user, created on their first sign-in. `name` and
 * `grade` stay null until they finish /join. `clubCodeAt` is when a mentee
 * entered the right club code (mentors and admins skip it), so a mentor who
 * is later removed has to enter the code before they can continue.
 */
export const profiles = sqliteTable(
  'profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name'),
    grade: integer('grade'),
    role: text('role', { enum: ROLES }).default('mentee').notNull(),
    clubCodeAt: integer('club_code_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
  },
  (table) => [
    check('profiles_grade_check', sql`${table.grade} is null or ${table.grade} between 9 and 12`),
    check('profiles_role_check', sql`${table.role} in ('mentee', 'mentor', 'admin')`),
  ],
);

/** Emails an admin has listed as mentors, stored lowercased. */
export const mentorInvites = sqliteTable('mentor_invites', {
  email: text('email').primaryKey(),
  addedAt: integer('added_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
});

/** Wrong club-code tries, for the limit of 5 per account per hour. */
export const clubCodeAttempts = sqliteTable(
  'club_code_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
  },
  (table) => [index('club_code_attempts_userId_idx').on(table.userId)],
);

// ---------------------------------------------------------------------------
// Teams (Phase C). A student is on at most one team (team_members.user_id is
// the primary key). The site stores links to students' own files, never the
// files' contents.
// ---------------------------------------------------------------------------

export const MENTORSHIP_STATUSES = ['self-guided', 'applied', 'mentored', 'declined'] as const;
export type MentorshipStatus = (typeof MENTORSHIP_STATUSES)[number];

export const TEAM_LINK_KINDS = ['report', 'slides', 'financials', 'comps', 'video'] as const;
export type TeamLinkKind = (typeof TEAM_LINK_KINDS)[number];

export const teams = sqliteTable(
  'teams',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    joinCode: text('join_code').notNull().unique(),
    company: text('company'),
    ticker: text('ticker'),
    mentorshipStatus: text('mentorship_status', { enum: MENTORSHIP_STATUSES })
      .default('self-guided')
      .notNull(),
    mentorId: text('mentor_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
  },
  (table) => [
    check(
      'teams_mentorship_status_check',
      sql`${table.mentorshipStatus} in ('self-guided', 'applied', 'mentored', 'declined')`,
    ),
  ],
);

export const teamMembers = sqliteTable(
  'team_members',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
  },
  (table) => [index('team_members_teamId_idx').on(table.teamId)],
);

export const teamLinks = sqliteTable(
  'team_links',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: TEAM_LINK_KINDS }).notNull(),
    url: text('url').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.kind] }),
    check('team_links_kind_check', sql`${table.kind} in ('report', 'slides', 'financials', 'comps', 'video')`),
  ],
);

/** Wrong team join codes, for the limit of 10 per account per hour. */
export const teamCodeAttempts = sqliteTable(
  'team_code_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
  },
  (table) => [index('team_code_attempts_userId_idx').on(table.userId)],
);

// ---------------------------------------------------------------------------
// Progress (Phase D). Module ticks per student, keyed by module slug
// ("value-the-company"), and team milestones, keyed by the milestone keys in
// src/data/club.ts. Neither has a CHECK on its key, so officers can rename
// modules or milestones without a migration; unknown keys are ignored when read.
// ---------------------------------------------------------------------------

/** A module the student has marked done. Deleted with the account. */
export const moduleProgress = sqliteTable(
  'module_progress',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    moduleSlug: text('module_slug').notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleSlug] })],
);

/**
 * A team milestone that's done. Deleted with the team. `doneBy` is who ticked
 * it; it becomes null if that person deletes their account.
 */
export const teamMilestones = sqliteTable(
  'team_milestones',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    doneAt: integer('done_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
    doneBy: text('done_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.key] })],
);

// ---------------------------------------------------------------------------
// Check-ins (Phase E). A mentor's notes about a meeting with their team, which
// the team, its mentor and admins can read. Notes about a meeting, never text
// for the team's report, slides or pitch.
// ---------------------------------------------------------------------------

export const CHECKIN_STATUSES = ['on-track', 'behind', 'stuck'] as const;
export type CheckinStatus = (typeof CHECKIN_STATUSES)[number];

/**
 * One meeting between a mentor and a team. Deleted with the team. Kept when
 * the team changes mentor. `mentorId` becomes null if that mentor deletes
 * their account, so the note stays without their name.
 *
 * `metOn` is the meeting day (YYYY-MM-DD). SQLite can't work out "today in
 * New York", so its default is set by the app: the form starts at todayIn()
 * and addCheckin falls back to it.
 */
export const checkins = sqliteTable(
  'checkins',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    mentorId: text('mentor_id').references(() => user.id, { onDelete: 'set null' }),
    metOn: text('met_on').notNull(),
    covered: text('covered').notNull(),
    nextStep: text('next_step').default('').notNull(),
    status: text('status', { enum: CHECKIN_STATUSES }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
  },
  (table) => [
    index('checkins_team_idx').on(table.teamId, table.metOn),
    check('checkins_status_check', sql`${table.status} in ('on-track', 'behind', 'stuck')`),
    check('checkins_covered_check', sql`length(${table.covered}) between 1 and 1000`),
    check('checkins_next_step_check', sql`length(${table.nextStep}) <= 500`),
    check('checkins_met_on_check', sql`${table.metOn} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
  ],
);

/** Every table, for Drizzle queries in src/db/*.ts. */
export const appSchema = {
  ...authSchema,
  profiles,
  mentorInvites,
  clubCodeAttempts,
  teams,
  teamMembers,
  teamLinks,
  teamCodeAttempts,
  moduleProgress,
  teamMilestones,
  checkins,
};
export type AppSchema = typeof appSchema;
export type Profile = typeof profiles.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Checkin = typeof checkins.$inferSelect;
