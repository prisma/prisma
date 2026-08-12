/**
 * Restores the checked-in Supabase reference fixture (`roles.sql` +
 * `schema.sql` in this directory) into a database. Roles are restored first
 * — the schema's policies and grants reference `anon`/`authenticated`/
 * `service_role`/etc.
 *
 * THE shared test substrate for anything Supabase-shaped: used by the pack's
 * `contract:generate` script (introspection source), this package's
 * integration tests, and `examples/supabase` (via a relative source import —
 * in-repo test tooling only, not part of the published package surface; the
 * `.sql` files it reads are not shipped).
 *
 * Its job is fidelity to a fresh `supabase db reset`: the fixture carries
 * the real instance's GRANT / ALTER DEFAULT PRIVILEGES statements verbatim
 * and this module adds no grants of its own. RLS is enforced by policies
 * AND grants, so a test database more permissive than a real project would
 * let tests pass that fail in production (and did — see TML-3035 findings
 * §6/§8). Notably `service_role` has NO table privileges on `auth.*` (only
 * schema USAGE) — a test that exercises the `.supabase` admin root must
 * issue the narrow grant it needs in its own setup (e.g. `GRANT SELECT ON
 * TABLE auth.users TO service_role`), the same grant a real project
 * requires. Tables an app contract creates in `public` afterwards (e.g. via
 * dbInit) pick up the platform roles' access through the fixture's default
 * privileges for the `postgres` role — the role tests connect as.
 *
 * Each file is sent as one multi-statement query (`pg`'s simple query
 * protocol runs semicolon-separated statements in order) rather than one
 * round trip per statement — ~75x faster in practice (single-statement
 * round trips to even a local PGlite server dominate the restore's cost far
 * more than PGlite's own execution time; roughly 9s vs ~120ms for these two
 * files). Splitting into individual statements is a debugging aid for
 * trimming a *new* fixture capture (see the header comments in `schema.sql`
 * / `roles.sql`), not something the restored-clean, checked-in fixture needs
 * at every test run.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from 'pg';

/**
 * Resolves this directory by the package's own `package.json` rather than
 * `import.meta.url`, so resolution is anchored at the real package root
 * regardless of where the importing module lives. The fixture's `.sql` files
 * never move from their source location under `test/fixtures/`.
 */
function resolveFixtureDir(): string {
  const packageJsonUrl = import.meta.resolve('@internal/extension-supabase/package.json');
  return join(dirname(fileURLToPath(packageJsonUrl)), 'test', 'fixtures', 'supabase-reference');
}

/**
 * Restores the Supabase reference fixture — schemas, tables, native enums,
 * roles, and the real instance's privileges. The caller owns the client
 * lifecycle: pass any already-connected `pg.Client` (e.g. one the test is
 * sharing across setup steps); this function does not open or close
 * connections.
 */
export async function setUpSupabaseMockSchema(client: Client): Promise<void> {
  const fixtureDir = resolveFixtureDir();
  const rolesSql = readFileSync(join(fixtureDir, 'roles.sql'), 'utf8');
  const schemaSql = readFileSync(join(fixtureDir, 'schema.sql'), 'utf8');

  await client.query(rolesSql);
  await client.query(schemaSql);

  // pg_dump's preamble includes session-local `SET`s (e.g. `SET row_security
  // = off;`, `SELECT pg_catalog.set_config('search_path', '', false);`) that
  // are meant to make the dump itself replay deterministically — not to
  // persist afterward. `client.query` runs each file on the caller's own
  // session, so without a reset those settings leak into whatever the caller
  // does next on this client: `row_security = off` in particular lets a
  // non-owner bypass RLS entirely, silently invalidating any RLS test that
  // reuses this client. Resetting every session-local setting back to its
  // startup default after the restore keeps the fixture's replay-only
  // settings from escaping into the caller's session.
  await client.query('RESET ALL');
}
