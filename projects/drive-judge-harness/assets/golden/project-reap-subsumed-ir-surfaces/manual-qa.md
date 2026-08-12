# Manual QA — project-reap-subsumed-ir-surfaces

> **Be the user.** You author SQL and Mongo contracts and run `prisma-next contract emit`,
> and you write framework/family code against the storage IR. After this reap, emit output and
> hashes must be unchanged, and the constructors must reject partially-built namespaces.
>
> **Out of scope of this script.** Re-running the full CI matrix (CI owns the per-slice gates
> and grep gates).
>
> **Spec:** `brief.md` + `acceptance.md` (this case) · **Plan:** _(filled at run time)_ ·
> **PRs:** _(filled at run time)_

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | -------- | -------------- | --------- | ------ |
| 1 | Emit an existing SQL + Mongo contract | Canonical output + hashes are unchanged (output-preserving) | working tree | AC-2, AC-3 |
| 2 | Construct storage from a POJO namespace | Constructors now reject partial/POJO namespace data | `tmpdir` | AC-1 |
| 3 | Grep the reaped symbols | The subsumed helpers are gone, not wrapped | `read-only` | AC-1, AC-5 |
| 4 | Exploratory: deferred surfaces untouched | Scope discipline held; follow-ups recorded | `read-only` | AC-6 |

## Pre-flight

1. `git status` clean. Build per the getting-started doc.

## Scenario 1 — Emit is output-preserving

**From the user's seat:** existing contracts emit byte-identical output and the same hash.

**Covers:** AC-2, AC-3 · **Isolation:** working tree · **Oracle:** `acceptance.md` AC-3.

### Steps

1. `pnpm fixtures:emit` (or emit a representative SQL contract and a Mongo contract).
2. `pnpm fixtures:check`; `git status`.

### What you should see

- No diffs in canonical `contract.json` / hashes; `fixtures:check` clean. SQL/Mongo asymmetry
  (empty collections preserved, empty tables not) behaves exactly as before — now via family
  hooks.

### Failure modes (runner classifies)

- Any hash or canonical-bytes diff (output-preserving constraint broken).
- SQL/Mongo empty-collection asymmetry changed.

## Scenario 2 — Constructors reject POJO namespaces

**From the user's seat:** passing partially-built (POJO) namespace data to `SqlStorage` /
`MongoStorage` is now a type/construction error, not a silently-coerced default.

**Covers:** AC-1 · **Isolation:** `tmpdir` · **Oracle:** `acceptance.md` AC-1.

### Steps

1. In a scratch file, attempt to construct `SqlStorage` with a loose POJO `namespaces` entry
   and with an empty `namespaces`.

### What you should see

- The fully-built `Namespace` path works; the POJO / empty-default path no longer compiles or
  no longer injects an `__unbound__` default.

## Scenario 3 — Grep the reaped symbols

**Covers:** AC-1, AC-5 · **Isolation:** `read-only`.

### Steps

1. `rg 'normaliseNamespaceEntry|DEFAULT_NAMESPACES|SqlNamespacePayload|MongoNamespacePayload' packages/`
2. Confirm the migration aggregate helper (`extractStorageElementNames`) is gone and its
   callers use `elementCoordinates`.

### What you should see

- No matches; helpers deleted, not wrapped or deprecated.

## Scenario 4 — Exploratory: deferred surfaces untouched

**Charter.** ~15 minutes: confirm the structurally-coupled surfaces (namespaced `table`
coordinate, kind-agnostic hashing, query-builder unbound-tables rewrite) were **not** touched
and are recorded as deferred follow-ups. Pulling any of them in would be scope inflation.

**Covers:** AC-6.

## Sign-off coverage map

| AC ID | Scenario(s) |
| ----- | ----------- |
| AC-1 | 2, 3 |
| AC-2 | 1 |
| AC-3 | 1 |
| AC-4 | 3 |
| AC-5 | 3 |
| AC-6 | 4 |
