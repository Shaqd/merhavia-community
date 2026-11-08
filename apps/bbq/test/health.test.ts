import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('GET /api/health', () => {
  it('reads hub users and BBQ events from the shared database', async () => {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO hub_users (display_name, phone) VALUES (?, ?)').bind('ישראל ישראלי', '+972501234567'),
      env.DB.prepare('INSERT INTO hub_users (display_name, phone) VALUES (?, ?)').bind('משה כהן', '+972521234567'),
      env.DB.prepare('INSERT INTO bbq_events (title, starts_at) VALUES (?, ?)').bind('על האש חורף', '2027-01-15T16:00:00Z'),
    ]);

    const res = await exports.default.fetch('https://bbq.test/api/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ app: 'bbq', tables: { hub_users: 2, bbq_events: 1 } });
  });
});
