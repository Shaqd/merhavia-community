import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('GET /api/health', () => {
  it('counts hub users', async () => {
    await env.DB.prepare('INSERT INTO hub_users (display_name, phone) VALUES (?, ?)')
      .bind('ישראל ישראלי', '+972501234567')
      .run();

    const res = await exports.default.fetch('https://hub.test/api/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ app: 'hub', tables: { hub_users: 1 } });
  });
});
