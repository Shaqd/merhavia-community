import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Tests run inside the Workers runtime against a fresh local D1 database. The BBQ app reads hub
// tables, so the hub's migrations are applied first, exactly as in the shared production database.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_HUB_MIGRATIONS: await readD1Migrations('../hub/migrations'),
          TEST_BBQ_MIGRATIONS: await readD1Migrations('./migrations'),
        },
      },
    })),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
  },
});
