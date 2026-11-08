import type { D1Migration } from 'cloudflare:test';

// Test-only bindings added in vitest.config.ts.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_HUB_MIGRATIONS: D1Migration[];
    }
  }
}
