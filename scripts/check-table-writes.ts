// Every app shares one database but writes only its own tables (docs/DESIGN.md §3): the BBQ app
// may read hub_users, but only the hub writes it. This check scans each app's source and
// migrations, and the shared packages, for SQL that writes rows or changes tables, and fails when
// the target belongs to another app. In migrations it also fails on tables without the app's prefix.
//
// Usage: node scripts/check-table-writes.ts

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export type SourceFile = {
  path: string;
  /** App that owns the file (`hub`, `bbq`, ...), or null for shared packages, which may write nothing. */
  owner: string | null;
  isMigration: boolean;
  content: string;
};

export type Violation = { path: string; line: number; reason: string };

// A statement that writes, then the name it writes to (optionally schema-qualified and quoted).
const WRITE_TARGET =
  /\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+(?:TEMP(?:ORARY)?\s+)?(?:TABLE|VIEW|TRIGGER)(?:\s+IF\s+NOT\s+EXISTS)?|DROP\s+(?:TABLE|VIEW|TRIGGER|INDEX)(?:\s+IF\s+EXISTS)?)\s+[`"[]?(?:\w+\.)?(\w+)/gi;
// CREATE INDEX names the index first, then the table after ON. Both must belong to the app.
const CREATE_INDEX =
  /\bCREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+[`"[]?(?:\w+\.)?(\w+)[`"\]]?\s+ON\s+[`"[]?(\w+)/gi;

export function findViolations(file: SourceFile, appNames: string[]): Violation[] {
  const text = blankComments(file.content, file.isMigration);
  const targets: { name: string; index: number }[] = [];
  for (const m of text.matchAll(WRITE_TARGET)) targets.push({ name: m[1]!, index: m.index });
  for (const m of text.matchAll(CREATE_INDEX)) {
    targets.push({ name: m[1]!, index: m.index }, { name: m[2]!, index: m.index });
  }

  const violations: Violation[] = [];
  for (const { name, index } of targets) {
    const table = name.toLowerCase();
    // `ON CONFLICT ... DO UPDATE SET` is an upsert on the statement's own table, not a new target.
    if (table === 'set') continue;
    const tableOwner = appNames.find((app) => table.startsWith(`${app}_`));
    const line = text.slice(0, index).split('\n').length;
    if (tableOwner !== undefined && tableOwner !== file.owner) {
      const who = file.owner === null ? 'shared packages write no tables' : `only ${tableOwner} may write it`;
      violations.push({ path: file.path, line, reason: `writes ${table}: ${who}` });
    } else if (tableOwner === undefined && file.isMigration) {
      violations.push({ path: file.path, line, reason: `${table} has no app prefix: name it ${file.owner}_...` });
    }
    // Unprefixed names in source code are ignored: no such table can exist, and words like
    // "update the session" in strings would otherwise be false alarms.
  }
  return violations;
}

// Replaces comments with spaces, keeping line breaks so reported line numbers stay right.
function blankComments(content: string, isSql: boolean): string {
  const lineComment = isSql ? /--[^\n]*/g : /\/\/[^\n]*/g;
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(lineComment, (c) => ' '.repeat(c.length));
}

function listFiles(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return listFiles(path);
    return /\.(ts|tsx|js|mjs|sql)$/.test(e.name) ? [path] : [];
  });
}

function collectFiles(root: string, appNames: string[]): SourceFile[] {
  const read = (path: string, owner: string | null, isMigration: boolean): SourceFile => ({
    path: relative(root, path),
    owner,
    isMigration,
    content: readFileSync(path, 'utf8'),
  });
  const apps = appNames.flatMap((app) => [
    ...listFiles(join(root, 'apps', app, 'src')).map((p) => read(p, app, false)),
    ...listFiles(join(root, 'apps', app, 'migrations')).map((p) => read(p, app, true)),
  ]);
  const packages = listDirs(join(root, 'packages')).flatMap((pkg) =>
    listFiles(join(root, 'packages', pkg, 'src')).map((p) => read(p, null, false)),
  );
  return [...apps, ...packages];
}

function listDirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

if (import.meta.main) {
  const root = join(import.meta.dirname, '..');
  const appNames = listDirs(join(root, 'apps'));
  const files = collectFiles(root, appNames);
  const violations = files.flatMap((f) => findViolations(f, appNames));
  for (const v of violations) console.error(`${v.path}:${v.line}: ${v.reason}`);
  if (violations.length > 0) {
    process.exitCode = 1;
  } else {
    console.log(`Table writes OK: ${files.length} files across apps ${appNames.join(', ')} and packages.`);
  }
}
