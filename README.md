# merhavia-community

Small web apps for the Merhavia community, on one domain with one sign-in:

- **BBQ app**: events, bring list, purchases, inventory, budget, Paybox reconciliation, history.
- **Football predictions** (later): prediction tournaments for World Cups and Euros.

Hebrew, right-to-left, mobile-first for participants. Hosted on Cloudflare's free plan.

Status: foundations (M0). See [docs/DESIGN.md](docs/DESIGN.md) for the design and
[docs/DEPLOY.md](docs/DEPLOY.md) for deploying.

This is a personal project. It uses no company accounts, keys or cloud projects.

## Development

You need Node 24. No Cloudflare account is needed to work locally.

```bash
npm install                 # also generates each app's Worker types
npm run db:migrate:local    # creates the local database: hub tables, then BBQ tables
npm run dev:hub             # http://localhost:5173
npm run dev:bbq             # http://localhost:5174
```

All apps share one local database in `.wrangler/state/`, as they share one database in production.
When running two apps at once, start the second only after the first is up. If both start at the
same moment, one can fail with `SQLITE_BUSY`.

Before opening a PR, run what CI runs:

```bash
npm run typecheck && npm run lint && npm run check:table-writes && npm test && npm run build
```

## Layout

```
apps/hub/        sign-in and people: Worker (Hono) + React, migrations/ for hub_* tables
apps/bbq/        the BBQ app: Worker (Hono) + React, migrations/ for bbq_* tables
packages/ui/     shared right-to-left React components
scripts/         repo checks, e.g. that each app writes only its own tables
docs/            design and deploy notes
```
