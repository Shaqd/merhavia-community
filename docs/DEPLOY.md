# Deploying to Cloudflare

Merging to `main` runs [.github/workflows/deploy.yml](../.github/workflows/deploy.yml):

1. The PR checks run again.
2. Every app's D1 migrations are applied, the hub's first.
3. Apps whose files changed are built and deployed. A change outside `apps/` (shared packages,
   dependencies, workflows) deploys every app, and docs-only changes deploy nothing.

To deploy without a merge, open **Actions → Deploy → Run workflow** and pick an app or `all`.

Until the one-time setup below is done, the workflow runs the checks and then skips the deploy,
with a notice saying why.

## One-time setup

Use the personal Cloudflare account. Never use an employer's.

1. **Create the database.** Run `npx wrangler login` from the repo root. Then run
   `npx wrangler whoami` and check that it shows the personal account. Create the database:

   ```bash
   npx wrangler d1 create merhavia-community
   ```

   Copy the `database_id` it prints into **every** `apps/*/wrangler.jsonc`, replacing
   `00000000-0000-0000-0000-000000000000`. All apps share this one database. The id is not a
   secret, so it is committed.

2. **Create an API token.** In the Cloudflare dashboard:
   1. Go to My Profile → API Tokens → Create Token, and start from the **Edit Cloudflare Workers** template.
   2. Add the permission **Account → D1 → Edit**.
   3. Under Account Resources, include only this account.

3. **Add two GitHub secrets.** In the repo, go to Settings → Secrets and variables → Actions → New
   repository secret, and add:
   - `CLOUDFLARE_API_TOKEN`: the token from step 2
   - `CLOUDFLARE_ACCOUNT_ID`: shown on the dashboard's Workers & Pages overview

4. **Pick the workers.dev subdomain** under Workers & Pages, if Cloudflare asks for one.

5. **Merge the PR that sets the database id.** The deploy then runs, and each app answers at
   `https://merhavia-<app>.<subdomain>.workers.dev`.

   Check `https://merhavia-bbq.<subdomain>.workers.dev/api/health`. It should report both
   `hub_users` and `bbq_events`, which proves that two Workers with separate migration tracking
   share one database.

## Migrations

- Each app keeps its own `migrations/` folder and its own tracking table (`hub_migrations`,
  `bbq_migrations`), set in its `wrangler.jsonc`.
- New migrations only add tables or columns. Renames and drops come in a later PR, once no deployed
  code uses the old shape (docs/DESIGN.md §10).
- The `0001_*` files may still be edited until the first deploy applies them. After that, change
  the schema only by adding a new file.

Apply one app's migrations by hand with `npm run db:migrate:remote -w apps/<app>`.
