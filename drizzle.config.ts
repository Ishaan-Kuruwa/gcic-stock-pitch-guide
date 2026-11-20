import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations from src/db/schema.ts. Wrangler applies them to D1:
//   npm run db:migrate:local   (local copy used by `npm run dev`)
//   npm run db:migrate:remote  (the real database on Cloudflare)
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
});
