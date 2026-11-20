/**
 * Accounts database (Cloudflare D1, SQLite). The first four are Better Auth's
 * core tables, matching `getAuthTables()` in better-auth 1.7; the club tables
 * (profiles, mentor_invites, club_code_attempts) follow. Change this file, then
 * run `npm run db:generate` to write a new migration in drizzle/migrations.
 *
 * Data rule (CLAUDE.md): Google name and email only. `user.image` and the
 * token columns on `account` exist because Better Auth expects them, but
 * src/lib/authOptions.ts always writes null to them.
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

/** Every table, for Drizzle queries in src/db/accounts.ts. */
export const appSchema = { ...authSchema, profiles, mentorInvites, clubCodeAttempts };
export type AppSchema = typeof appSchema;
export type Profile = typeof profiles.$inferSelect;
