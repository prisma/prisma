# @prisma/orm-extension-supabase

Supabase's own database schema, its platform roles, and a role-binding runtime for Prisma Next.

```bash
pnpm add @prisma/orm-extension-supabase
```

## Entrypoints

| Namespace | Surface |
| --- | --- |
| `/pack` | the extension pack an application composes into `extensions: [...]` — pure, no runtime imports |
| `/runtime` | `supabase({...})`, whose `asUser(jwt)` / `asAnon()` / `asServiceRole()` bind the Postgres role and JWT claims per session |
| `/contract` | branded model handles (`AuthUser`, `AuthIdentity`, `AuthSession`, `StorageBucket`, `StorageObject`) for cross-space foreign keys from an application contract |

## Responsibilities

Ships a faithful contract of everything Supabase owns in the database — every `auth` and `storage` table of the reference platform version, their native enum types, and the `anon` / `authenticated` / `service_role` roles — all marked `external`. The migration planner emits no DDL for them because Supabase manages them; `db verify` confirms they exist while tolerating the Supabase-internal schemas the pack does not declare.

The runtime binds a Postgres role and JWT claims to each session, and `asServiceRole().supabase.{sql,orm}` exposes the pack's own `auth` and `storage` tables as a `service_role`-only secondary root.

The contract is introspected from a checked-in reference capture rather than hand-authored, so it can be regenerated against a newer Supabase platform version.

## Dependencies

`@prisma/orm-framework`, `@prisma/orm-family-sql`, `@prisma/orm-toolchain`, and `@prisma/orm-postgres` at exact lockstep versions, plus `jose`, `pg`, `arktype`, and `@standard-schema/spec`.

`@prisma/orm-target-postgres` is an exact-pinned **peer** dependency: the application supplies it, directly or through a facade, and everyone shares that one copy. A hard dependency would let an application upgrade the facade without upgrading this pack and end up with two target copies whose codec and operation registries have quietly diverged; as a peer that combination fails to install instead.
