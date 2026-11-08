import { describe, expect, it } from 'vitest';
import { findViolations, type SourceFile } from './check-table-writes.ts';

const APPS = ['hub', 'bbq', 'football'];

function source(owner: string | null, content: string): SourceFile {
  return { path: 'file.ts', owner, isMigration: false, content };
}

function migration(owner: string, content: string): SourceFile {
  return { path: 'migration.sql', owner, isMigration: true, content };
}

function reasons(file: SourceFile): string[] {
  return findViolations(file, APPS).map((v) => `${v.line}: ${v.reason}`);
}

describe('findViolations', () => {
  it('allows an app to write its own tables', () => {
    expect(reasons(source('bbq', "db.prepare('INSERT INTO bbq_events (title) VALUES (?)')"))).toEqual([]);
    expect(reasons(source('bbq', 'UPDATE bbq_events SET status = ? WHERE id = ?'))).toEqual([]);
    expect(reasons(source('hub', 'DELETE FROM hub_users WHERE id = ?'))).toEqual([]);
  });

  it("allows reading another app's tables", () => {
    expect(reasons(source('bbq', 'SELECT u.display_name FROM hub_users u JOIN bbq_events e ON 1'))).toEqual([]);
    expect(reasons(source('bbq', 'INSERT INTO bbq_events (title) SELECT display_name FROM hub_users'))).toEqual([]);
  });

  it("flags writes to another app's tables, whatever the statement form", () => {
    expect(reasons(source('bbq', 'INSERT INTO hub_users (phone) VALUES (?)'))).toEqual([
      '1: writes hub_users: only hub may write it',
    ]);
    expect(reasons(source('bbq', 'insert or ignore into "hub_users" (phone) values (?)'))).toEqual([
      '1: writes hub_users: only hub may write it',
    ]);
    expect(reasons(source('hub', '\n\nUPDATE OR REPLACE main.bbq_events SET title = ?'))).toEqual([
      '3: writes bbq_events: only bbq may write it',
    ]);
    expect(reasons(source('bbq', 'REPLACE INTO hub_sessions VALUES (?)'))).toEqual([
      '1: writes hub_sessions: only hub may write it',
    ]);
    expect(reasons(source('football', 'DELETE FROM bbq_events'))).toEqual([
      '1: writes bbq_events: only bbq may write it',
    ]);
  });

  it('flags any app-table write from shared packages', () => {
    expect(reasons(source(null, 'DELETE FROM hub_sessions WHERE token = ?'))).toEqual([
      '1: writes hub_sessions: shared packages write no tables',
    ]);
  });

  it("flags migrations that change another app's tables", () => {
    expect(reasons(migration('bbq', 'ALTER TABLE hub_users ADD COLUMN nickname TEXT;'))).toEqual([
      '1: writes hub_users: only hub may write it',
    ]);
    expect(reasons(migration('bbq', 'DROP TABLE IF EXISTS hub_users;'))).toEqual([
      '1: writes hub_users: only hub may write it',
    ]);
    expect(reasons(migration('bbq', 'CREATE UNIQUE INDEX bbq_phone_idx ON hub_users (phone);'))).toEqual([
      '1: writes hub_users: only hub may write it',
    ]);
  });

  it('flags unprefixed tables and indexes in migrations', () => {
    expect(reasons(migration('bbq', 'CREATE TABLE IF NOT EXISTS events (id INTEGER);'))).toEqual([
      '1: events has no app prefix: name it bbq_...',
    ]);
    expect(reasons(migration('bbq', 'CREATE INDEX events_idx ON bbq_events (starts_at);'))).toEqual([
      '1: events_idx has no app prefix: name it bbq_...',
    ]);
  });

  it('accepts a well-formed migration with comments and an upsert', () => {
    const sql = [
      '-- We never update the hub tables from here.',
      '/* insert into hub_users is the hub job */',
      'CREATE TABLE bbq_items (id INTEGER PRIMARY KEY, name TEXT);',
      'CREATE INDEX bbq_items_name_idx ON bbq_items (name);',
      'INSERT INTO bbq_items (id, name) VALUES (1, "x") ON CONFLICT (id) DO UPDATE SET name = excluded.name;',
    ].join('\n');
    expect(reasons(migration('bbq', sql))).toEqual([]);
  });

  it('ignores prose and identifiers in source code that only look like SQL', () => {
    expect(reasons(source('bbq', "// update hub_users only from the hub\nconst msg = 'update the list';"))).toEqual([]);
    expect(reasons(source('bbq', 'const updated = await update(row); delete cache.hub_users;'))).toEqual([]);
  });
});
