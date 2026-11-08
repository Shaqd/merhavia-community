import { Hono } from 'hono';

// Row counts per table: shows the Worker is up and can reach its own tables and the hub's
// in the shared database.
export const health = new Hono<{ Bindings: Env }>().get('/', async (c) => {
  const [hubUsers, bbqEvents] = await Promise.all([
    countRows(c.env.DB, 'hub_users'),
    countRows(c.env.DB, 'bbq_events'),
  ]);
  return c.json({ app: 'bbq', tables: { hub_users: hubUsers, bbq_events: bbqEvents } });
});

async function countRows(db: D1Database, table: 'hub_users' | 'bbq_events'): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}
