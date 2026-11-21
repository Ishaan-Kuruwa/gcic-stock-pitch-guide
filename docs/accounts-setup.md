# Accounts setup

**Phase A** (steps 1–6) sets up Google sign-in: a Google OAuth client, the D1
database, and three secrets. **Phase B** (steps 7–10) adds roles, the club
code, the mentor list and the privacy page. **Phase C** (step 11) adds teams.
**Phase D** (step 12) saves module progress to accounts and adds team
milestones. **Phase E** (step 13) adds mentors for teams and check-ins.
**Phase F** adds the CSV download and the end-of-season delete, and ends with
the launch checklist. Do the steps in order. Each one says what to click and what to paste.

Values used below:

| Name | Value |
| --- | --- |
| Live site | `https://gcic-stock-pitch-guide.ishaan-wizard.workers.dev` |
| Local site | `http://localhost:4321` |
| Live callback | `https://gcic-stock-pitch-guide.ishaan-wizard.workers.dev/api/auth/callback/google` |
| Local callback | `http://localhost:4321/api/auth/callback/google` |
| D1 database name | `ghic-guide` |

> **Don't merge the PR until steps 1–5 are done.** Merging to `main` deploys
> automatically (Cloudflare Workers Builds). Without the real database id and
> the secrets, `/account` will fail on the live site.

---

## 1. Create the Google OAuth client

Use a Google account you'll keep (your personal account is safest, since a
school account can lose access when you graduate).

### 1a. Make a project

1. Go to <https://console.cloud.google.com/>.
2. Click the **project picker** at the top left (next to "Google Cloud"), then **New project**.
3. **Project name:** `GHIC Stock Pitch Guide`. Leave **Location** as is. Click **Create**.
4. When it's done, make sure the project picker shows **GHIC Stock Pitch Guide**.

### 1b. Consent screen (Google Auth Platform)

1. Open the menu (☰) → **APIs & Services** → **OAuth consent screen**. This opens
   **Google Auth Platform**. Click **Get started**.
2. **App information**
   - **App name:** `GHIC Stock Pitch Guide`
   - **User support email:** pick your email from the list.
   - Click **Next**.
3. **Audience:** choose **External**. Click **Next**.
4. **Contact information:** type your email. Click **Next**.
5. **Finish:** tick the box agreeing to the Google API Services User Data Policy. Click **Continue**, then **Create**.

### 1c. Branding

1. In the left menu click **Branding**.
2. Under **Authorized domains**, click **+ Add domain** and paste:
   ```
   ishaan-wizard.workers.dev
   ```
   If Google won't accept it, leave the list empty: it isn't needed while the
   app is in Testing.
3. Leave the logo empty (a logo triggers Google's review). Click **Save**.

### 1d. Data access (scopes)

1. In the left menu click **Data Access** → **Add or remove scopes**.
2. Tick exactly these three, and nothing else:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
3. Click **Update**, then **Save** at the bottom of the page.

### 1e. Audience: stay in Testing, add two test users

1. In the left menu click **Audience**.
2. **Publishing status** must say **Testing**. Do **not** click "Publish app".
3. Under **Test users**, click **+ Add users** and add both of your accounts,
   one per line:
   ```
   <your school Google account>
   <your personal Google account>
   ```
4. Click **Save**.

> Stay in Testing until every item in "Before students sign up" (step 10) is
> done. Until then, only the test users listed here can sign in (up to 100).

### 1f. Create the web client

1. In the left menu click **Clients** → **+ Create client**.
2. **Application type:** `Web application`.
3. **Name:** `GHIC guide web`.
4. **Authorized JavaScript origins:** click **+ Add URI** twice and paste one in each box:
   ```
   http://localhost:4321
   ```
   ```
   https://gcic-stock-pitch-guide.ishaan-wizard.workers.dev
   ```
5. **Authorized redirect URIs:** click **+ Add URI** twice and paste one in each box:
   ```
   http://localhost:4321/api/auth/callback/google
   ```
   ```
   https://gcic-stock-pitch-guide.ishaan-wizard.workers.dev/api/auth/callback/google
   ```
   (No trailing slash. They must match exactly.)
6. Click **Create**.
7. A box shows the **Client ID** and **Client secret**. Click **Download JSON**
   and keep it somewhere private (not in this repo). Google may not show the
   secret again.

---

## 2. Create the D1 database

In a terminal, in this project folder:

1. Sign in to Cloudflare (a browser window opens; click **Allow**):
   ```sh
   npx wrangler login
   ```
2. Create the database:
   ```sh
   npx wrangler d1 create ghic-guide
   ```
3. Wrangler prints a block with `"database_id": "…"`. If it asks whether to add
   the binding to your config for you, answer **No**: it's already there.
4. Open `wrangler.jsonc`, find this line, and replace the placeholder with the id:
   ```jsonc
   "database_id": "REPLACE_WITH_DATABASE_ID",
   ```
5. Create the tables in the live database:
   ```sh
   npm run db:migrate:remote
   ```
   Type `y` if it asks to continue. You should see `0000_auth_tables.sql ✅`.
6. Commit the `wrangler.jsonc` change on the `accounts-a-signin` branch.

---

## 3. Set the production secrets

Each command asks you to paste a value, then press Enter. Nothing shows while you
paste, which is normal.

1. Make a random secret and copy the output:
   ```sh
   openssl rand -base64 32
   ```
2. Set it:
   ```sh
   npx wrangler secret put BETTER_AUTH_SECRET
   ```
   Paste the random secret.
3. ```sh
   npx wrangler secret put GOOGLE_CLIENT_ID
   ```
   Paste the **Client ID** from step 1f (ends in `.apps.googleusercontent.com`).
4. ```sh
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
   Paste the **Client secret** from step 1f.

`BETTER_AUTH_URL` is not a secret. It's already set in `wrangler.jsonc` under `vars`.

---

## 4. Set up local secrets

1. Copy the example file:
   ```sh
   cp .dev.vars.example .dev.vars
   ```
2. Open `.dev.vars` and fill it in:
   ```
   BETTER_AUTH_URL=http://localhost:4321
   BETTER_AUTH_SECRET=<run openssl rand -base64 32 again: use a different secret from production>
   GOOGLE_CLIENT_ID=<same Client ID as step 3>
   GOOGLE_CLIENT_SECRET=<same Client secret as step 3>
   ```
   `.dev.vars` is gitignored. Never commit it.
3. Create the tables in your local database:
   ```sh
   npm run db:migrate:local
   ```

---

## 5. First test: local, two accounts

1. Start the site:
   ```sh
   npm run dev
   ```
2. Open <http://localhost:4321/account>. You should see a **Sign in with Google** button.
3. **School account:** click **Sign in with Google**, pick your **school**
   account, and allow access.
   - If it works, you come back to `/account` and see your name and email.
     Click **Sign out**.
   - If it's blocked, see "What a blocked sign-in looks like" below.
4. **Personal account:** click **Sign in with Google** again, pick your
   **personal** account, and allow access. Check that your name and email
   show up, then click **Sign out**.
5. Write down what happened in the results table at the bottom of this file.

You may see "Google hasn't verified this app" with a **Continue** link while
the app is in Testing. Click **Continue**. That screen isn't a block.

### What a blocked sign-in looks like

All of these are Google pages, so you never get back to our site:

- **"Access blocked: GHIC Stock Pitch Guide has not completed the Google
  verification process"** with **Error 403: access_denied**. The account you
  picked isn't in the **Test users** list (step 1e). Add it and try again.
- **"Access blocked: Your institution's admin needs to review GHIC Stock Pitch
  Guide"**, or **"[school name] hasn't given you access to this app"**, often
  with a **Request access** button. Your school district's Google Workspace
  admin blocks third-party apps it hasn't approved. Don't click **Request
  access** yet; just note it in the table. We'll decide in Phase B whether to
  ask the district or tell students to use personal accounts.
- **"This app is blocked"** or **"Error 400: admin_policy_enforced"**. This is
  also a school admin block, recorded the same way.
- **"Error 400: redirect_uri_mismatch"**. The redirect URI in step 1f doesn't
  exactly match. Compare it letter by letter with the table at the top.

If something fails *after* Google (you land back on `/account` with a red
"Sign-in didn't finish" message), check the terminal running `npm run dev` for
the error.

## 6. Then test the live site

After the PR is merged and deployed, repeat step 5 at
<https://gcic-stock-pitch-guide.ishaan-wizard.workers.dev/account>.

---

# Phase B: roles, club code, mentors

Who gets which role:

| Role | Who | Club code? |
| --- | --- | --- |
| Admin | Emails in `ADMIN_EMAILS` (club officers running the site) | No |
| Mentor | Emails on the list at `/admin/mentors` | No |
| Member (mentee) | Everyone else who signs in | Yes |

The role is checked again on every sign-in, so adding or removing an email
takes effect the next time that person signs in. Changes made on
`/admin/mentors` take effect right away.

After a first sign-in, everyone goes to `/join` to enter their name and grade
(members also enter the club code). They can't use any account page until
that's done. Five wrong codes in an hour locks that account out of `/join`
for the rest of the hour.

## 7. Apply the new database tables

Before merging the Phase B PR, add the new tables to both databases:

```sh
npm run db:migrate:local
npm run db:migrate:remote
```

You should see `0001_club_profiles.sql ✅`.

## 8. Set ADMIN_EMAILS and CLUB_CODE

Both are **secrets**, not `vars` in `wrangler.jsonc`: the repo is public, and
admin emails and the club code shouldn't be in it.

1. Admin emails, comma-separated (spaces and capital letters don't matter):
   ```sh
   npx wrangler secret put ADMIN_EMAILS
   ```
   Paste, for example, `officer.one@gmail.com,officer.two@gmail.com`. Use the
   Google account each officer will sign in with (a personal account, since
   school accounts are blocked).
2. The club code:
   ```sh
   npx wrangler secret put CLUB_CODE
   ```
   Pick something short that's easy to say out loud at a meeting. Capital
   letters don't matter when members type it.
3. Locally, set both in `.dev.vars` (see `.dev.vars.example`), then restart
   `npm run dev`:
   ```
   ADMIN_EMAILS=<your personal Google email>
   CLUB_CODE=<any test code>
   ```

**To change the club code** (for example, at the start of a new season), run
`npx wrangler secret put CLUB_CODE` again. Members who already joined aren't
affected; only new sign-ups need the new code.

**To add or remove an admin**, run `npx wrangler secret put ADMIN_EMAILS` again
with the full new list. It applies at that person's next sign-in.

## 9. Add mentors

1. Sign in with an admin account. The header link (your first name) goes to
   **All teams** (`/admin/teams`); click **Manage mentors** there to get to
   `/admin/mentors`.
2. Under **Add a mentor**, type the mentor's Google email and click **Add mentor**.
3. Tell the mentor to sign in. They pick their grade at `/join` and skip the
   club code.

To remove a mentor, click **Remove** next to their email. If they already have
an account, they become a member right away and must enter the club code
before they can continue. Teams they mentored have no mentor from then on (see
Phase E below).

## 10. Before students sign up

Do these in order. Don't share the site with members until all are done.

1. **Advisor approval of `/privacy`.** Fill in the two TODO boxes on the
   privacy page (the date season data is deleted and the contact email) in
   `src/pages/privacy.astro`, deploy, and have the club advisor read and approve
   <https://gcic-stock-pitch-guide.ishaan-wizard.workers.dev/privacy>.
2. **Add the privacy URL in Google.** In Google Cloud Console → **Google Auth
   Platform** → **Branding**, paste this into **Privacy policy link** and click
   **Save**:
   ```
   https://gcic-stock-pitch-guide.ishaan-wizard.workers.dev/privacy
   ```
3. **Move the Google app to In production.** **Google Auth Platform** →
   **Audience** → **Publishing status** → **Publish app** → **Confirm**. The
   status should say **In production**. We only ask for `openid`, `email`
   and `profile`, which usually means no verification review; if Google asks
   for one anyway, follow its steps (the app keeps working for test users meanwhile). After
   this, anyone with a personal Google account can sign in, and the club code
   keeps non-members out of the account pages.

---

# Phase C: teams

## 11. Apply the team tables

Before merging the Phase C PR, add the new tables to both databases:

```sh
npm run db:migrate:local
npm run db:migrate:remote
```

You should see `0002_teams.sql ✅`.

## How teams work

- **Who can have a team:** members (mentees) only. Mentors and admins can't
  create or join one. Officers who also compete track their own teams outside the site.
- **Size:** at most 2 students, from `limits.maxTeamSize` in
  `src/data/competition.ts` (YIS allows individuals or pairs). A student
  competing alone is a team of one.
- **One team each.** A student must leave their team before creating or
  joining another.
- **Creating:** `/account` → **Create a team (or compete solo)**. The team gets a
  6-character join code (no 0/O or 1/I/L, so it's easy to read out loud).
- **Joining:** `/account` → **Join with a code**. Capital letters don't matter.
  10 wrong codes in an hour locks that account out of joining for the rest of
  the hour. A full team says so and isn't counted as a wrong code.
- **New join code:** if a code is shared too widely, any member can click
  **New join code** on the team page. The old code stops working right away.
- **Company and file links:** members add their company, ticker and links to
  their own files (report, slides, financials, comps, video). Links must be
  `https://` on docs.google.com, drive.google.com, youtube.com or youtu.be.
  The site stores the link, never the file.
- **Who can see a team page:** its members and admins. Anyone else gets "Page
  not found", so team pages can't be guessed. Admins can look but can't change
  the team. Since Phase E, a team's assigned mentor can see it too (see "How
  mentoring works on the site").
- **Leaving:** **Leave team** on the team page, with a confirm step. When the
  last member leaves, the team and its links are deleted. Deleting an account
  does the same.

---

# Phase D: progress and milestones

## 12. Apply the progress tables

Before merging the Phase D PR, add the new tables to both databases:

```sh
npm run db:migrate:local
npm run db:migrate:remote
```

You should see `0003_progress_milestones.sql ✅`. No new secrets.

## How progress and milestones work

**Module progress** (the checklist on `/learn` and "Your next step" on the
home page):

- **Signed out**, nothing changes: ticks are saved only in that browser.
- **The first time someone signs in on a device**, the ticks already in that
  browser are added to the ones saved on their account (nothing is unticked),
  and the browser remembers that this happened for that account.
- **After that, the account wins.** Each page load shows the account's ticks,
  and each tick or untick is saved to the account straight away. Ticking on a
  phone shows up on a Chromebook at the next page load.
- **Offline or signed out mid-session:** the tick stays on screen and in the
  browser, with the note "Not saved, you're offline or signed out". Ticks that
  weren't saved are lost when the student signs out (see the next point), so
  they should tick again once they're back online.
- **Shared Chromebooks:** after someone signs out, the next page with the
  checklist clears the ticks that came from their account, so the next person
  starts empty. Their ticks are still on their account. Ticks copied from one
  student's account are never added to another student's account.
- `/account` lists every module with "Done" or "Not done". On the team page,
  each member shows "Modules: N of M done".

**Milestones** (the team page, `/team/[id]`):

- Nine steps from "Company picked" to "Submitted to YIS", each with GHIC's due
  date. Each row says "Done Dec 10", "Due Dec 12" or "Due Dec 12, 3 days late"
  in words. "Today" is the date in New York (`clubTimeZone` in
  `src/data/club.ts`).
- Any team member can tick or untick a milestone and click **Save
  milestones**. It works without JavaScript. Saving only changes the boxes
  you changed, so it can't undo a teammate's tick made while your page was open.
- **Mentor reviewed the draft** only shows for teams whose mentorship status is
  "Has a mentor". Even then, members can't tick it ("Your mentor marks this");
  only the team's assigned mentor can.
- Admins see the milestones read-only.

**To change a due date**, edit `milestones` in `src/data/club.ts` (dates are
`YYYY-MM-DD`). "Submitted to YIS" always uses `targetSubmitDate` in the same
file. A test (`npm test`) fails if any date is after `targetSubmitDate` or
out of order. Don't rename a milestone's `key` during a season: ticks saved
under the old key stop showing.

**Deleting:** deleting an account deletes its module progress. Milestones
belong to the team: they stay when one member leaves or deletes their account
(without that person's name attached), and are deleted with the team when the
last member leaves.

---

# Phase E: mentoring

## 13. Apply the check-ins table

Before merging the Phase E PR, add the new table to both databases:

```sh
npm run db:migrate:local
npm run db:migrate:remote
```

You should see `0004_checkins.sql ✅`. No new secrets.

Then paste the mentor application Google Form link into `mentorship.applicationUrl`
in `src/data/club.ts` (it's `null` until you do). The same block has the closing
day (`closes: '2026-12-08'`) and how often mentors should meet
(`checkinEveryDays: 14`).

## How mentoring works on the site

Applications stay on the club's Google Form this season. The site doesn't
collect them; it links to the form and keeps track of who mentors whom.

**Before the form closes.** Self-guided teams see "Want a mentor? Apply with the
club form by Dec 8" in the Mentorship section of their team page. It shows only
once `applicationUrl` is set, and disappears after the closing day (New York
time).

**After the form is scored, assign each team:**

1. Make sure the mentor is on the list at `/admin/mentors` and has signed in
   once (they appear in the mentor list only after that). Admins can mentor
   too: they're always in the list.
2. Open **All teams** (`/admin/teams`, the header link for admins) and click
   the team's name.
3. Under **Set mentorship**, pick a status:
   - **Applied for a mentor**: they applied and you haven't decided yet.
   - **Has a mentor**: pick their mentor too. This status needs a mentor.
   - **Mentor request declined**, or back to **Self-guided**: choose "No
     mentor".
4. Click **Save mentorship**. To change a team's mentor later, pick someone
   else and save. Past check-ins stay on the team, under the old mentor's name.

**What a mentor sees.** The header link for mentors goes to **Your teams**
(`/mentor`): each team they mentor with milestones done, the next milestone
due, the last check-in, and the 14-day flag. On a team page they can read
everything, but they can't change the team's company, links or milestones.
The two things they can do:

- Tick **Mentor reviewed the draft** (only the mentor can, and only for teams
  marked "Has a mentor") and click **Save mentor review**.
- **Log a check-in** after each meeting: the day they met (today in New York
  unless they change it), what they covered (up to 1000 characters), the next
  step (optional, up to 500), and whether the team is on track, behind or
  stuck. The form says "The team can read these notes, so write them to the
  team." A mentor can edit their own check-ins with **Edit** under each one.

Members and admins see check-ins newest first. Admins can't edit them. A
mentor of another team gets "Page not found".

**The 14-day flag.** On `/admin/teams` and `/mentor`, a team with a mentor is
flagged in words:

- **Needs a mentor**: marked "Has a mentor" but nobody is assigned (for
  example, after their mentor was removed at `/admin/mentors`).
- **No check-ins yet**: a mentor is assigned but hasn't logged a check-in.
- **No check-in in 14+ days**: the latest check-in's meeting day was 14 or
  more days ago.

`/admin/teams` lists flagged teams first, in that order (oldest check-in first
among the 14+ day ones), then every other team by name. The table scrolls
sideways on a phone.

**Removing and deleting.**

- Removing a mentor at `/admin/mentors` takes away their access straight away.
  Their teams show "Needs a mentor", and their check-ins stay on those teams.
- If a mentor deletes their account, their check-ins stay on the team, shown
  as "Logged by a former mentor".
- When a team's last member leaves, its check-ins are deleted with it.
- An admin taken off `ADMIN_EMAILS` stops mentoring their teams the next time
  they sign in.

---

# Phase F: launch and end of season

Phase F adds no tables and no secrets: nothing to migrate.

## Launch checklist

Do these in order before telling members to sign up. Tick each one off.

1. **Fill in the privacy page.** In `src/pages/privacy.astro`, replace the two
   TODO boxes: the date season data is deleted (the day you plan to run
   [End of season](#end-of-season) below) and the email students and parents
   can write to. Deploy.
2. **Advisor approval.** The club advisor reads and approves
   <https://gcic-stock-pitch-guide.ishaan-wizard.workers.dev/privacy>. Don't go
   past this step without it.
3. **Mentor emails.** Add every mentor's Google email at `/admin/mentors`
   ([step 9](#9-add-mentors)). Ask each mentor to sign in once, so they can be
   assigned to teams.
4. **CLUB_CODE.** Set this season's club code
   ([step 8](#8-set-admin_emails-and-club_code)):
   `npx wrangler secret put CLUB_CODE`. Check `ADMIN_EMAILS` lists every
   officer too.
5. **Privacy URL in Google.** Google Auth Platform → **Branding** →
   **Privacy policy link**: paste
   `https://gcic-stock-pitch-guide.ishaan-wizard.workers.dev/privacy` and
   **Save** ([step 10](#10-before-students-sign-up), item 2).
6. **Move the app to In production.** Google Auth Platform → **Audience** →
   **Publish app** → **Confirm** ([step 10](#10-before-students-sign-up),
   item 3). The status should say **In production**.
7. **Live end-to-end sign-up test**, on the live site, with a personal Google
   account that has never signed in here (not a test user):
   1. Sign in at `/account`. Google shouldn't say the app is in testing.
   2. At `/join`, enter a name, grade and the club code. You land on
      `/account`.
   3. **Create a team**, then copy its join code.
   4. In a private window, sign in with a second new account, finish `/join`
      and join the team with the code.
   5. As an admin, set the team to **Has a mentor** with a mentor; as that
      mentor, log a check-in.
   6. As an admin, open **All teams** and click **Download CSV**. Check the
      team, both members, the mentor and the check-in date are there.
   7. Delete both test accounts at `/account/delete`. The team goes with the
      last member.
   8. Write the result in [Test results](#test-results).

## End of season

After the competition (and after any results are announced), delete this
season's member data, as the privacy page promises.

**What's deleted:** every member (mentee) account, with its profile (name and
grade), sign-in sessions, Google link, module progress and club-code tries;
and every team, with its members, links, milestones, check-ins and join-code
tries.

**What's kept:** admin and mentor accounts (with their own module progress),
and the mentor list at `/admin/mentors`. An officer or mentor who signed in
but never finished `/join` is kept too, as long as their email is in
`ADMIN_EMAILS` or on the mentor list. Files in Google Drive aren't touched: the
site only stores links to them.

1. Sign in as an admin and open **All teams** (`/admin/teams`).
2. Click **Download CSV** and keep the file somewhere only officers can see
   (no emails or check-in notes are in it, but it has names and grades).
3. Click **End of season** (`/admin/season`). Check the counts: how many member
   accounts and teams will be deleted, and how many admins, mentors and mentor
   emails are kept. If a mentor shows up as a member, add their email at
   `/admin/mentors` first.
4. Type `DELETE SEASON` exactly, in capitals, and click **Delete member
   accounts and teams**. It runs as one step: either everything listed goes or
   nothing does. The page then says how many accounts and teams were deleted.
   It can't be undone.

**Next season:** set a new club code (`npx wrangler secret put CLUB_CODE`),
update `ADMIN_EMAILS` for new officers, remove mentors who aren't returning
at `/admin/mentors`, and update the deletion date on the privacy page.

---

## Test results

| Account | Where | Date | Result | Exact message seen (if blocked) |
| --- | --- | --- | --- | --- |
| School | local | 2026-11-19 | Blocked by school district | Error 400: admin_policy_enforced |
| Personal | local | 2026-11-19 | Signed in | |
| School | live | | | |
| Personal | live | | | |
