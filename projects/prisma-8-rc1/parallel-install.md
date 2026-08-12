# Running v7 and v8 in parallel

The requirement: **users can run their current Prisma version and Prisma 8 in the same project, against the same database, and migrate incrementally** — new code on v8, old code untouched on v7, cutover at the end. This document is the whole story of how that works. It's also the release's biggest untested claim, which is why it gets an executable proof.

## What a user's project looks like during migration

```jsonc
// package.json
{
  "dependencies": {
    "prisma-v7": "npm:prisma@^7",   // v7 pinned under an alias; existing code keeps working
    "prisma": "npm:prisma@next"     // resolves to 8.0.0-rc.1
  }
}
```

Three things could collide in this setup, and each has an answer:

**1. Package names.** The npm alias mechanism (shown above) handles library resolution. Beyond the CLI package itself there's no contest: v8 has its own package set and doesn't use `@prisma/client` at all — v8 has no generated client in v7's sense — so all of v7's packages keep their names and their meaning.

**2. The `prisma` command.** When two installed packages declare the same binary name, which one wins is package-manager-specific and effectively undocumented — not something to build a migration story on. So there is no contest to resolve: **v8's package installs exactly one binary, `prisma-next`.** The `prisma` command always means v7, on every package manager, for as long as v7 is installed; v8 is always `prisma-next`, the command EA users already use today. Existing scripts and CI jobs keep working untouched. Whether a bare `prisma` binary ever ships for v8 — at 8.0.0 final or later via `@prisma/cli` — is deliberately left open; adding a binary later is purely additive, so deferring the decision costs nothing.

**3. The database schema.** Two migration systems must never both own one schema. The rule is: **v7 keeps owning migrations until one final cutover.** v8 never runs DDL during the transition; it *adopts* the database read-only:

```bash
prisma-next contract infer     # read the live database, derive a matching contract
prisma-next db sign            # verify the database satisfies the contract, then record that fact
```

`db sign` is deliberately not a "trust me" operation — it first verifies that the live schema actually satisfies the contract and refuses if it doesn't, then writes only a small marker record in v8's own bookkeeping schema (`prisma_contract`), completely separate from v7's `_prisma_migrations` table. The two systems' bookkeeping never touches.

The routine during the transition, whenever v7 runs a new migration:

```bash
prisma-next contract infer     # re-derive the contract from the changed schema
# review the diff
prisma-next db sign            # re-record
```

and in CI, `prisma-next db verify --schema-only` confirms the database still matches the contract. One caveat the upgrade guide states plainly: during the transition, verification runs in its default (lenient) mode — strict mode would flag v7's `_prisma_migrations` table as a foreign object, correctly but unhelpfully.

**The cutover**, when the user is ready: run the last v7 migration, do a final infer-and-sign, remove v7 from the project, and from then on author schema changes in v8 and migrate with v8. (One known gap on this final step — the convenience command for advancing the migration baseline isn't implemented yet; it's a tracked gap for 8.0.0 final, with a documented manual path in the meantime.)

## The proof

All of the above is assembled from mechanisms that individually exist and are tested. What has never existed is a single running example of the whole story — the planned side-by-side evaluation on a real app never happened. So we build the proof as an end-to-end fixture in the repository:

- one project, both versions installed exactly as shown above;
- one Postgres database;
- v7 runs its migrations, seeds data, and keeps querying through v7 code;
- v8 adopts the database, queries the same data, and the results agree;
- v7 runs a *further* migration, and the re-adopt routine (infer → review → sign → verify) is exercised;
- the CLIs are invoked by their unambiguous names throughout — `prisma` for v7, `prisma-next` for v8 — and the fixture runs under each supported package manager to prove the alias install and binary resolution behave identically on all of them.

This fixture is the receipt for the announcement's migration claim, a regression test forever after, and the skeleton the upgrade guide's code samples are lifted from. **It must be green by July 24** — if it isn't, the announcement's claim gets scaled back to what's actually proven, and that decision is made at the checkpoint rather than discovered by users.

## What the upgrade guide covers (written in release week, from the fixture)

1. The breaking floor: Node 24+, ESM-only, minimum database versions — stated first, because they're the wall a user hits before anything else matters.
2. The parallel-install setup, verbatim from the fixture.
3. The adoption routine and the transition rules (v7 owns migrations; lenient verification; what to do when v7 migrates).
4. The cutover.
5. Error-code translation: a table from Prisma 7's `P1001`-style codes to v8's codes, for migrating runbooks and alerting.
6. The explicit "not in 8.0" list, so nobody discovers an absence in production.
