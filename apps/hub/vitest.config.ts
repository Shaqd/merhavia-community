import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Tests run inside the Workers runtime against a fresh local D1 database.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: { TEST_HUB_MIGRATIONS: await readD1Migrations('./migrations') },
      },
    })),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
  },
});
