# Merhavia community apps — design

Status: design agreed (2026-11-06). M0 foundations in progress (2026-11-07); see §13.
Owner: Eldad Dahan (personal project, GitHub `Shaqd`). No employer accounts, keys, cloud projects
or budgets are used anywhere in this repo.

## 1. Why

A barbecue gathering runs every ~3 months for 50–70 men out of a pool of under 100 people.
Today it is managed in Google Sheets and paid through Paybox:

- **Manual and error-prone.** The sheet is cleared before every event, and anyone can type any name into it.
- **No inventory.** Leftover drinks, disposables, oil, spices and cleaning supplies carry over, but
  nobody knows how much of the next budget goes to restocking, so the meat budget is a guess.
- **No history.** Meat per person, what ran out and what was left over are lost each time, so nothing is learned.
- **Paybox is awkward to work with.** It is mobile-only, has no API, and shows payers, not participants.

This repo hosts a small **sign-in hub** plus community apps on one domain: the **BBQ app** first,
then a **football predictions app** (major national-team tournaments) later.

## 2. Constraints

| Constraint | Decision |
|---|---|
| Cost | Target ~$15–20/year; acceptable ceiling $100–200/year if something is clearly worth it |
| Upkeep | Volunteer project: no servers to patch, no databases that pause |
| Usage | Dozens of requests in the busy week before an event, near zero otherwise |
| Language | Hebrew UI, right-to-left. Code identifiers in English |
| Devices | Participants on phones; admins mostly on a PC |
| Data | Internal only, nothing sensitive: names, phone numbers, emails, amounts |
| Access | Every participant has a personal account. No guests, no free-text names |

## 3. Architecture

```
   <domain>            bbq.<domain>          football.<domain> (later)
      │                     │                       │
 ┌────▼─────┐         ┌─────▼────┐            ┌─────▼────┐
 │ hub      │         │ bbq      │            │ football │   separate Workers:
 │ (sign-in,│         │          │            │          │   own code, own deploy,
 │  people) │         │          │            │          │   own subdomain
 └────┬─────┘         └─────┬────┘            └─────┬────┘
      └─────────────┬───────┴───────────────────────┘
             ┌──────▼──────┐
             │ one D1 DB   │   hub_*   bbq_*   football_*
             └─────────────┘
       R2: receipt photos, backups
```

- **Hosting: Cloudflare, free plan.** Workers run the code, D1 (SQLite) holds the data, R2 holds files.
  Nothing sleeps, so there are no cold-start delays after idle months.
- **Runtime separation.** Each app is its own Worker on its own subdomain. Deploying or breaking one
  app never touches another.
- **Data separation inside one database.**
  - Table prefixes (`hub_`, `bbq_`, `football_`) replace schemas, which SQLite doesn't have.
  - Each app has its own migrations folder and its own migrations-tracking table, via wrangler's
    per-binding `migrations_dir` / `migrations_table` settings. Both keys are documented. Cloudflare's
    docs don't cover two Workers sharing one database this way, so the M0 spike proves it.
  - Apps read `hub_` tables but write only their own. Only the hub writes people and sessions.
    A CI check enforces this.
  - An app's tables can be moved into their own database later if ever needed.
- **One deployable per app.** The Worker serves both the app's API and its built React files,
  the same pattern as a Spring JAR serving a React build.

### Alternatives considered (2026-11-06)

| Option | Cost per year | Why not |
|---|---|---|
| Vercel Hobby + Neon | $0 | Scheduled jobs run only once a day, so no live football polling. The database sleeps, slowing the first visit. Two vendors. |
| Railway | $60+ | Usage billing on top of the fee. Java's memory footprint makes several apps expensive. |
| Hetzner VPS | ~€70 | Upkeep: OS updates, HTTPS, backups and monitoring become our job |
| Free VM (Oracle, GCP e2-micro) | $0–36 | Same upkeep. Oracle can reclaim idle VMs. GCP charges for the IPv4. |
| Supabase free | $0 | Pauses after a week of inactivity. Pro is $25/month. |
| Render free | $0 | Services sleep, and the free database expires |

### Free-plan limits that shape the code (checked 2026-11-06)

- **Workers: 100,000 requests/day and 10 ms CPU per request.** Anything CPU-heavy runs in the
  browser instead: Paybox file decryption, football win-chance simulations.
- **Scheduled triggers: 5 per account, shared by all apps.** Prefer GitHub Actions schedules for
  maintenance jobs.
- **D1: 500 MB per database, 10 databases, 7-day Time Travel (point-in-time restore).**
  Since 2026-09-01, queries fail for the rest of the day once the daily row read or write limit is
  hit. Use indexes; our volume is a tiny fraction of the limit.

## 4. Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind, `dir="rtl"`, logical CSS properties |
| Backend | TypeScript on Cloudflare Workers (not Node.js: request-scoped functions, `nodejs_compat` for common Node APIs) |
| Routing | Hono |
| Data access | Plain SQL in repository modules + schema validation of inputs. No heavy ORM |
| Layering | controller → service → repository, explicit types, nothing clever |
| Tests | Vitest running inside the Workers runtime (`@cloudflare/vitest-plugin`) |
| Local dev | Vite with Cloudflare's Vite plugin, which runs each Worker in the real Workers runtime. All apps share one local D1 copy. No cloud account needed |
| Language version | TypeScript 6.0. typescript-eslint does not support TypeScript 7 yet (checked 2026-11-07) |
| Email | Resend free plan: 3,000 emails/month, 100/day, one sending domain |
| AI | Claude API on a personal Anthropic account. The key is a Cloudflare secret, never in the repo |

## 5. Identity and sign-in (hub)

- **People live in the hub.**
  - `hub_users`: Hebrew display name, phone number (E.164, unique), email, status.
  - `hub_app_memberships`: one row per app per person, with a role (`member` | `admin`). A person
    registers once, and admins grant access app by app.
- **Sign-in is phone number → 6-digit code by email.**
  - The page shows a masked address: "we sent a code to el•••@gmail.com".
  - The code is typed into the page. No magic links: on phones, a link opens inside the mail app's
    own browser, so the session would land in the wrong place.
  - Codes are stored as HMAC hashes, expire after a few minutes, and allow only a few attempts.
  - Codes go only to known people: sign-in codes to a user's confirmed email, and email-confirmation
    codes only through a valid invite link. Limits apply per person per hour, plus a daily cap for the
    whole app, so the form can't be used to spam people.
- **Sessions last 1 year per device.**
  - The cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, set on the parent domain so every app shares it.
  - Each app checks sessions directly in `hub_sessions`, with no call to the hub.
  - Every app on the domain can see this cookie, so only trusted apps are hosted there.
- **Onboarding works through admin invite links.**
  1. An admin creates the person (name and phone).
  2. The admin sends an invite link on WhatsApp.
  3. The person enters their email, confirms it with a code, and is signed in.
- **Fallback.** An admin can create a one-time sign-in link when email fails.
- **Deliverability.** SPF, DKIM and DMARC are set up on the domain, and the code screen says "check
  your spam folder".
- **No passwords,** so no password hashing and no CPU-limit concern.

## 6. BBQ app

### Participants (phone-first)
- See the upcoming event, register as attending, and see their payment status.
- Pay through a "Pay in Paybox" button that links to the group.
- Bring list: assign **only themselves** to items (e.g. one of 4 tables), and remove themselves.

### Admins (desktop-first)
- Manage people and app access (hub admin pages).
- Run events: create, open, close. A new event starts from the default item list plus the previous event.
- Set the price per person and the budget.
- Edit the default item catalog, and override items per event.
- Use the internal buy list: what's still needed, what was bought, cost against budget.
  Assign anyone to bring-list items.
- Record purchases with receipt photos, then track reimbursement.
- Run the Paybox import and the review list (section 7).
- Count inventory at the end of the event.
- Read and write notes, and generate the AI recommendations report.

### Items
- **Kind:** `buy` (admins purchase) or `bring` (participants sign up).
- **Lifetime:** `consumable` (used up at this event, mainly meat) or `durable` (carries over: unopened
  drinks, disposables, oil, spices, garbage bags, cleaning supplies).
- **Quantity:** fixed, or per person (e.g. grams of meat per person).
- **Durables also have** a target stock level and an estimated unit price.

### Inventory and budget engine
1. Budget = paying participants × price per person.
2. Restocking cost = Σ over durables of max(0, target − on hand) × unit price.
3. Meat budget = budget − restocking cost − other consumables.
4. Suggested meat in kg = headcount × historical kg per person, checked against the meat budget.
5. Inventory changes are recorded as movements: purchase (+), used (−), end-of-event count (correction).

### History and learning
- **Events are closed, never wiped.** Kg per person, leftovers, shortages, cost per head and notes
  accumulate across events.
- **Notes** can be written during or after an event.
- **AI recommendations after an event.** One Claude API call over this event and past events,
  roughly $0.30 per run.
- **AI receipt reading.** A receipt photo becomes purchase lines (item, quantity, price, payer),
  a few cents each.

## 7. Paybox integration

Paybox (Israel, Discount Bank) has no public API. `docs.paybox.sh` is an unrelated product.
Paybox stays the way money moves; the app reconciles from the group's exported report.

### The export file (verified on a real export, 2026-11-06)
- **Format:** `.xlsx` with Office Agile encryption: AES-256, SHA-512, 100,000 spin rounds.
  Decrypted **in the admin's browser**, so the password and raw file never reach the server.
  Fallback: the admin saves it as CSV and uploads that.
- **Columns:** `שם`, `פלאפון`, `סוג`, `סכום`, `תאריך`, `הערות`, `שם אפשרות התשלום`,
  `שם תיאור אפשרות התשלום`, `שאלת מנהל`, `תשובת חבר`.
- **Row types:** `העברה לקבוצה` (money in) and `תשלום מהקבוצה` (money out). The app's own
  screen calls money-out "משיכה מהקבוצה", but the export uses `תשלום מהקבוצה`.

Quirks the importer must handle:
- **Amounts:** money in is text (`"650.00"`); money out is a negative integer.
- **Dates:** text, `YYYY-MM-DD HH:MM:SS`, exactly **1 hour later** than the Paybox app shows.
  All 8 winter rows compared matched this; summer rows are unverified.
- **Phones:** `972-5XXXXXXXX`.
- **Money-out rows:** the name is the recipient, but the phone is always the **group manager's**.
- **No transaction ID.**
- **Names are Paybox profile names** (often English) and are stable. The app's member list shows
  the viewer's phone-contact names instead, so screenshots of it are unreliable.

### Matching
1. **Identify the payer** of each money-in row: by phone alias, then by Paybox-name alias.
2. **Decide whom it covers** (we can always tell who paid for whom):
   - **No note, or a note naming the payer:** it covers the payer. A note can be the payer's own name in Hebrew.
   - **The payer has a payer link** (a non-user who always pays for one user, e.g. a spouse):
     it covers that user.
   - **A note naming someone else:** it goes to review, with a suggestion from names and nicknames.
3. **Saving answers:**
   - Phone and name aliases are saved only when the admin confirms the payer *is* the person.
   - Payer links are saved only when the payer is not an app user.
   - Nicknames from notes (e.g. "צ'אקי") are saved for the person they cover.
   - A user paying for others never gets an alias for those people.
4. **Re-imports.** The export is cumulative, so rows are matched to earlier imports by type, name,
   phone, amount and time within ±1 hour. The tolerance is in case Paybox fixes the offset.
5. **Payouts.** The recipient's name finds the user, and the amount is compared with that user's
   recorded purchases for the event, giving "reimbursed" or the difference.
6. **Balance.** The group balance is shown as of the last import.

### Review list (admin decides; decisions are saved)
Flagged rows:
- A phone or name not linked to any user
- A note naming someone other than the payer
- An amount different from the event price (e.g. ₪140)
- A second payment for the same person in the same event
- A payout that doesn't match the recipient's recorded purchases

From a flagged row, the admin can **create a user from the payment**. The form is prefilled with the
Paybox name and phone. When the payment was made on someone else's behalf, the admin types the
newcomer's phone instead.

### Onboarding from history
The current group admin exports the full report. The import then proposes one user per distinct
paying phone. The admin goes through the list once:
- writes Hebrew names,
- links non-participant payers to the person they pay for,
- confirms.

The same report can optionally fill in past events with approximate headcount and spend per head.
The report is imported, then deleted. **It is never committed.**

### Paybox group setup tip
The export carries a payment option and an admin question with the member's answer. If set up in
the group, they help the import: e.g. a fixed ₪70 option, or the question "for whom are you paying?".

## 8. Data model (first cut)

Hub:
- `hub_users`, `hub_app_memberships`, `hub_sessions`, `hub_login_codes`, `hub_invites`

BBQ:
- **Events and items:** `bbq_events`, `bbq_catalog_items`, `bbq_event_items`, `bbq_bring_assignments`
- **Participation and money:** `bbq_registrations`, `bbq_purchases` (with an R2 receipt key)
- **Inventory:** `bbq_inventory`, `bbq_inventory_movements`
- **Paybox:** `bbq_paybox_imports`, `bbq_paybox_transactions` (raw rows plus status),
  `bbq_payment_allocations` (transaction → user and event, decided by whom and when),
  `bbq_payer_aliases` (kind `phone` | `name` | `nickname`, relation `self` | `pays_for`)
- **Learning:** `bbq_notes`, `bbq_ai_reports`

## 9. Repo layout

```
apps/hub/        Worker + React, migrations/ (hub_ tables)
apps/bbq/        Worker + React, migrations/ (bbq_ tables)
packages/auth/   session check + cookie helpers used by every app (arrives in M1)
packages/ui/     shared RTL components: header, app switcher, form controls
scripts/         repo checks, e.g. the cross-app table-write check
docs/            this file, DEPLOY.md
.github/workflows/
```

The repo uses npm workspaces. The football app joins later as `apps/football/`.

## 10. CI/CD (GitHub Actions)

- **On every PR:** type check, lint, tests, the cross-app table-write check, and a build.
  GitHub Free can't make a private repo require green checks before merging (branch protection
  needs Pro), so the deploy re-runs the checks and a red `main` never deploys.
- **On merge to `main`:**
  1. The checks run again.
  2. D1 migrations are applied, the hub's first.
  3. Only apps whose files changed are deployed. A change outside `apps/` deploys every app.
- **Manual deploy button:** `workflow_dispatch`.
- **Optional:** a preview URL per PR.
- **Secrets:** a Cloudflare API token, scoped to Workers and D1, stored as a GitHub secret.
  App secrets (Resend, Anthropic) are Cloudflare secrets.
- **Migration rule (expand/contract):** add first; rename or drop in a later PR, once nothing uses
  the old shape.
- **Merging:** the owner merges PRs. Agents never merge.

## 11. Backups

1. **D1 Time Travel** undoes any mistake from the last 7 days.
2. **A nightly scheduled job** exports the database and stores it in R2 for 90 days.
3. **A periodic encrypted copy is kept outside Cloudflare,** in case the account itself is lost.
   Destination is still open.

Backups must be in place before any real people are imported.

## 12. Costs

| Item | Per year |
|---|---|
| Cloudflare Workers, D1, R2 (free plan) | $0 |
| Domain (Cloudflare Registrar, at cost) | ~$10–15 |
| Resend (free plan) | $0 |
| Claude API for app features (post-event report, receipts) | ~$5 |
| GitHub Actions (free minutes for private repos) | $0 |
| AI review on PRs | open; ~$10–25 if we add a Claude review step |
| **Total** | **~$15–20** (+ PR review if chosen) |

Accounts the owner creates, all personal and never the employer's:
- Cloudflare: domain, Workers, D1, R2
- Resend
- Anthropic API, for the AI features
- The GitHub repo under `Shaqd`

## 13. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Foundations | Skeleton monorepo; CI and deploy to `*.workers.dev`; local dev works. Spike proves in-browser Paybox decryption, sends one email code (needs the domain and Resend), and runs two apps' migrations on one shared database |
| M1 | Hub + backups | Users, memberships, invites, email-code sign-in, sessions, hub admin pages; nightly backup running |
| M2 | BBQ core | Events, catalog and event items, bring list with self-assign, registrations, buy list, purchases |
| M3 | Paybox | Browser import, matching, review list, create-user-from-payment, payouts vs purchases, onboarding from history |
| M4 | Inventory and budget | Durable stock, movements, budget engine, meat suggestion, event history views |
| M5 | AI | Post-event recommendations; receipt photo → purchase lines |

**M0 progress (2026-11-07):**
- **Done:** skeleton monorepo, CI, the deploy workflow and local dev.
- **Shared database, proven locally:** the hub's and the BBQ app's migrations land in one database,
  each tracked in its own table. Both Workers see the same rows.
- **Remaining:**
  - the first real deploy, which also proves the shared database on Cloudflare (needs the account; docs/DEPLOY.md)
  - in-browser Paybox decryption
  - one email code (needs the domain and Resend)

## 14. Open decisions

- **AI review on PRs:** a Claude review step, a public repo with free tools, or none. Parked.
- **Domain name:** the owner buys it. Name the community, not the BBQ, in Latin letters.
- **Off-Cloudflare backup destination.**
- **Whether to backfill past events** from the Paybox history report.
- **Cancellation rules** after paying (refunds through Paybox).
- **Hebrew names** for the hub and the apps.

## 15. Football predictions app (later, not now)

The 2026 World Cup app (Java/Spring Boot + H2 + React, on a GCP VM) moves here for Euro 2028 and
becomes tournament-agnostic:

- **Moves onto the shared base.** Subdomain `football.<domain>`, tables `football_*`, hub sign-in
  with personal accounts, and predictions entered in the app instead of Excel.
- **Nations only.** National teams form a shared catalog keyed by FIFA code (Hebrew name, flag).
  Each tournament records which teams take part, their groups and their tiers.
- **Templates in three layers:**
  - **Format** (reusable): groups, stages, bracket slots, best-third tables, tiebreaker order.
  - **Scoring** (reusable, tweakable): tier matrix, exact-score multiplier, stage points.
  - **Edition** (per tournament): teams, players and fixtures, loaded from football-data.org.

  A new tournament is created by copying templates and then editing them.
- **Port to TypeScript, verified against Java.** The archived 2026 database must reproduce the final
  leaderboard exactly.
- **Free-plan workarounds.** The 50,000-run win-chance simulation moves to the browser, and the four
  polling jobs merge into one scheduled job (or use the $5/month plan during the tournament).
