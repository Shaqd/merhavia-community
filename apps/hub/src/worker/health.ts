import { Hono } from 'hono';

// Row counts per table: shows the Worker is up and can reach its tables in the shared database.
export const health = new Hono<{ Bindings: Env }>().get('/', async (c) => {
  const hubUsers = await countRows(c.env.DB, 'hub_users');
  return c.json({ app: 'hub', tables: { hub_users: hubUsers } });
});

async function countRows(db: D1Database, table: 'hub_users'): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}
