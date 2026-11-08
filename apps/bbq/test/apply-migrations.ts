import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Each app's migrations go into one database, tracked in the same tables as in wrangler.jsonc.
await applyD1Migrations(env.DB, env.TEST_HUB_MIGRATIONS, 'hub_migrations');
await applyD1Migrations(env.DB, env.TEST_BBQ_MIGRATIONS, 'bbq_migrations');
