/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Signed-in user on on-demand routes; always null on prerendered pages. */
    user: import('better-auth').User | null;
    session: import('better-auth').Session | null;
    /** The user's club profile (role, name, grade), or null if signed out or not created yet. */
    profile: import('./db/schema').Profile | null;
  }
}
