# Accounts setup (Phase A: Google sign-in test)

This sets up everything the `/account` page needs: a Google OAuth client, the
D1 database, and three secrets. Do the steps in order. Each one says what to
click and what to paste.

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

> **Phase B note:** we switch the publishing status to **In production** in
> Phase B, and only after the `/privacy` page exists. Until then, only the test
> users listed here can sign in (up to 100).

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

## Test results

| Account | Where | Date | Result | Exact message seen (if blocked) |
| --- | --- | --- | --- | --- |
| School | local | | | |
| Personal | local | | | |
| School | live | | | |
| Personal | live | | | |
