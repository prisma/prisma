# PSL ambient declarations — the `environment` block

**Status: deferred indefinitely.** Recorded 2026-07-13 out of the Supabase Slice C review (roles as first-class contract entities); tracked as offcut offcut OC4 of the Supabase integration. **Pickup trigger:** the second ambient entity kind — the likely candidate is a planner that owns `CREATE EXTENSION`. Nothing in the shipped role-block design blocks this; it layers on top.

## At a glance

```prisma
environment {
  role anon;
  role authenticated;
  role service_role;
}

namespace auth {
  model AuthUser {
    id Uuid @id
    ...
  }
}
```

An `environment { }` block is the namespace-equivalent for **ambient declarations**: objects that belong to the database environment as a whole rather than to any schema. In Postgres terms that category is cluster-/database-level objects — roles today; potentially extensions, event triggers, publications, and database settings. The block gives them an explicit lexical home, the same way `namespace X { }` gives schema-scoped objects theirs.

## The problem it solves

Ambient objects currently have no lexical home in PSL. The shipped interim (Slice C, PR #957) declares roles as bare top-level blocks:

```prisma
role anon {
}
```

whose entities carry the unbound coordinate, stamped by the target's block factory and honored by the interpreter's filing rule. That works, and it required no new framework surface — but it leans on two things worth improving:

1. **Top-level-ness is the only scoping signal.** The reader can't tell from the source that `role` is ambient while a hypothetical top-level `native_enum` would be schema-scoped (defaulting to `public`). The distinction lives in the target's factory, and the misplacement diagnostic speaks in mechanism terms ("declares entities bound to the `__unbound__` coordinate") rather than intent terms ("roles are declared in `environment { }`").
2. **The unbound slot is doing double duty.** Its actual meaning is *a schema whose binding is late-resolved by `search_path`* — a deferred schema coordinate for single-namespace contracts. Ambient objects are parked there because it is the only non-schema coordinate the contract has, but "ambient, no schema scope" and "schema-scoped, binding deferred" are different concepts. The diff-tree projection already needs a special rule to avoid materializing a physical schema node for a roles-only unbound slot; a first-class ambient home would make that rule structural instead of conditional.

## Design sketch

### Grammar

- `environment { … }` is a top-level block, a sibling of `namespace`. It may not appear inside a namespace, and namespaces may not appear inside it.
- Members use the statement form per the two-body-form PSL pattern (`field Type @attrs` for typed members; `key = value` for configuration): `role anon;` for bare declarations, with the block form available when a member kind grows configuration (`role admin { bypassRls = true }`).
- Multiple `environment` blocks in one document merge, the same way repeated declarations of anything else are handled today (duplicate member names within a kind are an error).

### Contents are pack-contributed

The framework grammar knows only the container. Which member kinds are legal inside it comes from the composed packs' authoring contributions, exactly like PSL block descriptors today — the postgres pack contributes `role` (and later perhaps `extension`); the SQLite pack contributes nothing, so an `environment { role x; }` in a SQLite contract fails with an unknown-kind diagnostic for free. No family or target vocabulary enters the framework: "environment" describes the *contract's* ambient level, and each target maps it to its own concept (Postgres: cluster/database level).

### Lowering and storage

Two candidate landing zones for the lowered entities, in preference order at pickup time:

1. **A dedicated ambient section** in storage (e.g. `storage.environment.entries`), disentangling ambient entities from the unbound namespace slot entirely. This is the honest end state: the diff projection maps it to root-level diff subjects with no schema-node special-casing, and `resolveDdlSchemaForNamespaceStorage` never sees an ambient coordinate. Cost: a contract-shape change (storage-hash churn for contracts that declare ambient entities — today that is exactly one generated pack contract, so the churn is cheap *now* and grows with adoption; this is the argument for doing the storage move early if the feature is picked up at all).
2. **The unbound slot, as today** — `environment` becomes purely a lexical/diagnostic improvement over bare top-level blocks, with the storage shape unchanged. Cheaper, but keeps the double duty.

Either way the runtime plane is untouched: ambient entities are not queryable surface.

### Control policy and the planner

Ambient members default to the same control-policy story as everything else. Roles stay invariantly `external` (referenced, never owned). The interesting growth path is **managed** ambient objects: `extension vector;` under `managed` control would let the planner emit `CREATE EXTENSION` and the verifier check `pg_extension` — the currently-deferred "CREATE EXTENSION statements" item (the Supabase integration's deferred `CREATE EXTENSION` item) gets its authoring surface from this block. The postgres-rls cross-space-roles work would resolve `policy` blocks' `roles = [...]` references against environment entries.

### Migration from the interim

Fold the shipped top-level `role` blocks into `environment { }`: a small PSL move, one upgrade-skill entry for external authors, and a one-line change to the Supabase pack's contract generator (which writes the role blocks from `SupabaseRole.values`). The interpreter's entity-coordinate filing rule stays — `environment` members are simply the third lexical origin besides "named namespace" and "top level".

## Open questions (settle at pickup)

- **Keyword.** `environment` will read as deployment/env-var configuration to part of the audience, and someone will try to put `DATABASE_URL` in it. Candidates: `environment`, `ambient`, `database` (family-flavored?), `global`. Needs its own bikeshed with the docs voice in the room.
- **Storage shape** (option 1 vs 2 above), and whether existing single-namespace unbound contracts interact with a dedicated ambient section at all (they should not — tables never become ambient).
- **Refs into ambient space.** How `roles = [anon]` in a policy block resolves against environment entries, and what the symbol-table entry for an ambient member looks like (this is the refKind-alignment thread the postgres authoring code already tracks for cross-space roles).

## Non-goals

- Deployment or connection configuration (env vars, URLs, pooling). The block declares database-resident objects only.
- Per-environment (dev/staging/prod) conditionality. One contract, one ambient declaration set.

## Alternatives considered

- **Status quo (shipped interim): bare top-level blocks + entity-stamped coordinates.** Fine at the current scale — one entity kind, three declarations, one generated file. This spec exists because the interim does not *name* ambient-ness in the source and overloads the unbound slot; neither hurts until more ambient kinds arrive, which is why the pickup trigger is the second kind, not a date.
- **A scope field on the framework block descriptor** (`entityScope: 'bound' | 'cluster'`). Rejected during Slice C review: the framework descriptor must not name namespace placement, and "cluster" is target vocabulary.
- **Reusing `namespace unbound { }` as the ambient home.** That form is reserved for late-binding single-namespace contracts and cannot coexist with named namespaces; more fundamentally it names the wrong concept — deferred schema binding, not ambience.
