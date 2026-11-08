import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Same tracking table as wrangler.jsonc's migrations_table.
await applyD1Migrations(env.DB, env.TEST_HUB_MIGRATIONS, 'hub_migrations');
