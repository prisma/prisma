# Migration CLI restructure — spec

## Summary

Bring the `prisma-next` CLI surface in line with the vocabulary settled in [`domain.md`](./domain.md) and the gap analysis in [`cli-audit.md`](./cli-audit.md). Six surface changes land:

1. Promote the live-DB advance verb to top-level: `prisma-next migration apply [--ref X]` → `prisma-next migrate --to <contract>`.
2. Promote `ref` to a top-level subject; drop the `get` inspect-one verb (covered by `ref list` filtered by name).
3. Split `prisma-next migration status` into five purpose-specific verbs: `status`, `log`, `list`, `graph` (plus the existing `show`).
4. Add contract-naming arguments to `db sign`: `db sign [<contract>]` and `db sign --contract <contract>`.
5. Unify the contract-reference grammar across every flag that names a contract: `--to <contract>` / `--from <contract>` accept hashes, ref names, migration directory names, `<dir>^`, and filesystem paths.
6. Add the net-new artifact-integrity verb `migration check [<m>]`.

`migration preflight <m>` is a separate concern (net-new sandbox-execution feature, not a restructure) and is **out of scope** for this project. It remains in the vocabulary and the audit; building it will be its own project.

No transitional aliases. Each rename is atomic; the journey suite updates in lockstep with each verb change. No external users; no migration-of-users concern. No deprecation window.

## Context

### Why this is one project

The findings in the audit are not independent surface tweaks — they fall out of a single coherent re-reading of the migration domain. The vocabulary work in `domain.md` established:

- **Graph nodes are contracts; edges are migrations.** The verb that moves a live DB along an edge is `migrate`; it operates on the database, not on the migration artifact, so it sits at the top level alongside `init`, `contract`, `db`, `migration`, `ref`.
- **Refs are contract references** — pointers into the graph, on the same noun family as contracts, not as migrations. They belong at the top level.
- **One reference grammar** spans every place the user names a contract. Today that grammar is fragmented across `--from <hash>`, `--ref <name>`, `--to <hash>`.
- **The `migration` namespace is the artifact-and-graph subject.** Today it hosts a live-DB verb (`apply`), a sub-namespace (`ref`), and a multi-question status command — all of which belong elsewhere.

Each finding follows directly from these reframings. Landing them piecemeal across unrelated projects would leak transitional shapes into the surface; doing them as one project lets each milestone reach a coherent state and the close-out reach a clean final shape.

### Current surface

```
prisma-next
├── init
├── contract
│   ├── emit
│   └── infer
├── db
│   ├── init
│   ├── update [--to <hash>]
│   ├── verify [--schema-only|--marker-only|--strict]
│   ├── sign
│   └── schema
└── migration
    ├── plan [--name <slug>] [--from <hash>]
    ├── new
    ├── show
    ├── status [--ref <name>] [--graph] [--limit <n>] [--all]
    ├── apply [--ref <name>]
    └── ref
        ├── set <name> <hash>
        ├── get <name>
        ├── list
        └── delete <name>
```

### Intended surface (this project)

```
prisma-next
├── init
├── migrate --to <contract>
├── contract
│   ├── emit
│   └── infer
├── db
│   ├── init
│   ├── update [--to <contract>]
│   ├── verify [--schema-only|--marker-only|--strict]
│   ├── sign [<contract>] [--contract <contract>]
│   └── schema
├── migration
│   ├── plan [--name <slug>] [--from <contract>]
│   ├── new
│   ├── show <m>
│   ├── status [--to <contract>] [--from <contract>]
│   ├── log
│   ├── list
│   ├── graph
│   └── check [<m>]
└── ref
    ├── set <name> <contract>
    ├── list
    └── delete <name>
```

`migration preflight <m>` is documented in the audit as the next-vocab gap after this project lands but is deferred to a separate project.

## Objectives

1. **Verbs match the model.** The user-facing CLI surface reads like the domain. Top-level subjects are `init`, `migrate`, `contract`, `db`, `migration`, `ref`. The `migration` namespace contains only artifact-and-graph operations.
2. **One reference grammar.** Wherever the CLI accepts a contract as input, it accepts any **contract reference**: hash (full or prefix), ref name, migration directory name, `<dir>^`, or filesystem path. The flag is `--to <contract>` for targets and `--from <contract>` for origins. Same grammar; same resolver; same error messages.
3. **One question per verb.** Each verb answers exactly one question about exactly one subject. The two diagnostic modes on `db verify` (`--schema-only`, `--marker-only`) are sensibly-flagged debugging variants of one canonical question; they remain. The five-questions-under-one-verb shape of `migration status` does not.
4. **Verification is partly split by what's being verified.** Two of the three vocab verbs land here: `db verify` (live DB satisfies its contract) and `migration check` (artifact / graph integrity). `migration preflight` (sandbox behavioral check) is deferred.
5. **Journey suite is the regression contract.** Every milestone's PR carries the journey-test updates needed to keep `pnpm test:journeys` green. Helper functions in `journey-test-helpers.ts` follow the new verb names.

## Non-goals

- **`db verify` modes.** The `--schema-only` / `--marker-only` / `--strict` flag shape stays. The audit (F8) concluded the flags are clear and the verb is one verb; no change.
- **Internal naming of legacy "apply" / "applied".** The vocab work resolved these as opportunistic renames; this project doesn't carry that work as gating. Files touched by milestones in this project can be renamed in the same PR (e.g., `apply-aggregate` → `migrate-aggregate` if it's already on the diff); a separate sweep of `MigrationApplied` events, `control-api/operations/` → `commands/`, etc., is out of scope here and tracked separately.
- **Migration-from-old-CLI tooling.** No prior version is in users' hands; no compatibility shim. The CLI changes are absolute.
- **`migration preflight`.** Net-new sandbox-execution feature, not a restructure. It needs its own design — sandbox lifecycle, initial-state strategy, framework-runner reuse, Postgres + Mongo flavors — and that design is non-trivial. Tracked separately; the vocabulary still includes it and the audit still flags it as a remaining gap after this project lands.
- **Glossary / subsystem-doc rewrite.** The close-out milestone promotes the settled vocabulary into `docs/glossary.md` and updates the affected subsystem docs (`7. Migration System.md`, `CLI Style Guide.md`). It does not rewrite the subsystem docs from scratch.

## Functional requirements

Per the audit's findings; each FR corresponds to one audit-section.

**FR1 (audit F1) — top-level `migrate`.** A new top-level command `prisma-next migrate` accepts `--to <contract>` and walks the migration graph from the marker to the named contract, executing each migration on the live database. Removes `prisma-next migration apply`. The `<contract>` argument accepts the full contract-reference grammar (FR5).

**FR2 (audit F2) — top-level `ref`.** Refs become a top-level subject. Subcommands: `ref set <name> <contract>`, `ref list`, `ref delete <name>`. Removes `prisma-next migration ref`. The `<contract>` argument accepts the full contract-reference grammar. The current `get` inspect-one verb is dropped — a ref is `{hash, invariants[]}` and `ref list` (filtered by name) covers the same ground without a dedicated verb. (Contrast: `migration show` and `contract show` are retained because they aggregate multi-file packages or resolve-and-render artifacts; both do real work beyond `cat`.)

**FR3 (audit F3) — split `migration status`.** Five purpose-specific verbs replace the flag-overloaded one:

- `migration status [--to <contract>] [--from <contract>]` — path / pending. Live by default; offline when `--from` is supplied.
- `migration log` — execution history (live, reads the ledger).
- `migration list` — flat enumeration of migrations on disk (offline).
- `migration graph` — topology view with branches and ref markers (offline).
- `migration show <m>` — unchanged.

The `--graph`, `--all`, `--limit`, `--ref` flags on the current `status` verb do not survive the split; their behaviors are reachable through the new verbs.

**Discoverability across the split.** The journey from "I want to see the graph" to `migration graph` runs through two failure modes the help system must absorb:

- *The operator runs `migration status --graph` (or `--all` / `--ref X`).* The flag is no longer recognised by `status`. The CLI emits its standard unknown-flag error (exit `2`) and the `fix:` line names the verb that now owns this behavior: e.g., `Use \`prisma-next migration graph\` to view the migration graph.` This builds on the existing unknown-command suggestion machinery in `cli.ts` and extends it one step to unknown-flag-with-known-replacement.
- *The operator runs `migration status --help`.* The help text includes a **See also** section listing `migration log`, `migration list`, `migration graph`, `migration show <m>` with one-line descriptions. Implemented via a new `setCommandSeeAlso(command, refs)` helper that parallels the existing `setCommandExamples(...)` registration and is rendered by the help formatter in `utils/formatters/help.ts` immediately under the Examples section.

Each of the four new verbs (`status`, `log`, `list`, `graph`) cross-references the others via the same "See also" section so operators can navigate between them without consulting external docs.

**FR4 (audit F4) — `db sign` accepts a contract argument.** Positional form `db sign [<contract>]` and explicit form `db sign --contract <contract>`. With no argument, defaults to signing with the current `contract.json` (current behavior).

**FR5 (audit F5) — unified contract-reference grammar.** The argument grammar for `<contract>` is:

- A storage hash (full or prefix, with Git-style ambiguity error on short-prefix collisions).
- A ref name.
- A migration directory name (resolves to the migration's `to`-contract).
- A migration directory name suffixed with `^` (resolves to the migration's `from`-contract).
- A filesystem path prefixed with `./` (resolves the contract.json at that path).

A parallel `<migration>` grammar accepts migration hashes and migration directory names. The command's argument *type* — `<contract>` vs `<migration>` — determines which grammar applies.

Every flag that names a contract or migration uses this shared grammar: `migrate --to`, `db update --to`, `db sign --contract`, `migration plan --from`, `migration status --to/--from`, `ref set`'s second argument, and the positional arguments to `migration show` and `migration check`.

**Wrong-grammar diagnostics.** A common failure mode is passing a `<contract>` reference (e.g., a ref name like `production`) where the verb expects a `<migration>`, or vice versa. The resolver detects this by checking the input against the *other* grammar's known values before falling back to a generic "not found":

| Input shape | `<contract>` resolver | `<migration>` resolver |
|---|---|---|
| Matches a known ref name | resolves to the ref's target | "Ref name passed where a migration is expected — `migration show` takes a migration hash or directory name. Did you mean `…<related verb>` for refs?" |
| Matches a migration directory name | resolves to the migration's `to`-contract | resolves to the migration |
| `<dir>^` | resolves to the migration's `from`-contract | "`^` syntax addresses contracts, not migrations" |
| Hex prefix matching a contract hash but no migration hash | resolves to the contract | "Hash matched a contract but not a migration — pass `migration show <dir>` for a specific migration" |
| Hex prefix matching neither | "Not a known contract reference" | "Not a known migration reference" |

The error envelope carries the input the user supplied verbatim and lists candidate alternatives where useful (Git-style); the `fix:` line names the closest matching verb-grammar pair.

**FR6 (audit F6, partial) — one new verification verb.**

- `migration check [<m>]` — artifact / graph integrity. With a `<m>` argument: recompute that migration's hashes; validate its `ops.json` / manifest match; confirm its on-disk shape is complete. With no argument: a graph-wide sweep — every migration self-consistent; every edge's `from` and `to` line up with neighbouring contracts; no orphan nodes; no dangling refs. Read-only, offline.

  `migration check` follows the [CLI Style Guide](../../docs/CLI%20Style%20Guide.md#exit-codes) exit-code taxonomy:

  | Exit | Name | Meaning |
  |---|---|---|
  | `0` | `OK` | All checks passed. |
  | `2` | `PRECONDITION` | CLI usage error — bad argument, named migration does not exist, malformed reference. Reserved CLI-wide code. |
  | `4` | `INTEGRITY_FAILED` | One or more integrity checks reported a failure. Command-specific code, exported from `commands/migration-check/exit-codes.ts`. |

  Fine-grained discrimination uses PN codes carried on the structured error envelope. Each failure mode gets its own PN code (`PN-MIG-CHECK-001 HASH_MISMATCH`, `PN-MIG-CHECK-002 MANIFEST_INCOMPLETE`, `PN-MIG-CHECK-003 ORPHAN_MIGRATION`, `PN-MIG-CHECK-004 DANGLING_REF`, `PN-MIG-CHECK-005 EDGE_MISMATCH`). The `--json` output carries the full error envelope per the Style Guide.

`migration preflight` is out of scope (see [Non-goals](#non-goals)).

## Acceptance criteria

**AC1 — surface.** After close-out, `prisma-next --help` enumerates exactly the verbs in the intended-surface diagram above. Running any verb listed in the *current* surface that is *not* in the intended surface (e.g., `prisma-next migration apply`) produces an unknown-command error from the CLI's standard error envelope.

**AC2 — grammar.** For every flag named `--to` or `--from` that takes a contract argument, the following resolve identically to the same target contract (verified by parameterized test):

- A full storage hash.
- A 6-character prefix of that hash (unique).
- A ref name pointing at the same contract.
- A migration directory name whose `to`-contract is that contract.
- `<dir>^` for a migration whose `from`-contract is that contract.

Ambiguity (a hex-shaped string that's both a hash prefix and a directory name; a non-unique prefix) produces a CLI error with candidate listing.

**AC3 — questions are split.** Each of the five split verbs (`status`, `log`, `list`, `graph`, `show`) answers its question without consulting any data source it doesn't need: `list` / `graph` / `show` do not touch the live database; `status` / `log` do.

**AC4 — sign with contract.** `db sign abc123` (positional hash prefix), `db sign --contract abc123` (explicit), `db sign --contract production` (ref name), and `db sign` (no argument) all succeed when the live DB satisfies the named contract, and produce identical marker rows. All four refuse with the same error envelope when the DB does not satisfy the named contract.

**AC5 — check covers the graph.** `migration check` with no argument over a clean graph passes with exit `0`. Adversarial fixtures — a tampered migration manifest (hash mismatch), a corrupted package (missing `migration.json` or `ops.json`), an orphan migration (no migration produces its `from`-contract), a dangling ref (points at a hash absent from the graph), and a within-migration snapshot mismatch (a migration's `metadata.to` disagrees with its `end-contract.json` snapshot) — each produce exit `4` (`INTEGRITY_FAILED`) and a structured error envelope carrying a distinct PN code per failure mode.

**PN-005 scope note.** The scope of `PN-MIG-CHECK-005 EDGE_MISMATCH` is **within-migration** consistency (one migration's two on-disk records of its own destination contradict each other). Cross-migration consistency (one migration's `end-contract.json` agreeing with the next migration's `start-contract.json` *as a physical schema*) requires shadow execution to verify the recorded snapshots produce the same database state; that check is deferred to the future `migration preflight` work. See the [glossary entry for `migration check`](../../docs/glossary.md#migration-check) for the complete PN code table.

**AC6 — wrong-grammar errors point operators at the right verb.** Passing a ref name to `migration show` (a `<migration>` argument) produces an error whose `fix:` line distinguishes ref-from-migration, not a generic "not found". Passing a migration directory to a `<contract>` argument resolves silently (to the migration's `to`-contract; this is intentional grammar overlap). Passing a `<dir>^` form to `migration show` (a `<migration>` argument) produces "`^` syntax addresses contracts, not migrations."

**AC7 — discoverability across the status split.** Three behaviors hold:

- `prisma-next migration status --graph` exits `2` with a `fix:` line naming `migration graph`. Likewise `--all` → `migration log`; `--ref X` → `migration status --to X`.
- `prisma-next migration status --help` includes a **See also** section listing `migration log`, `migration list`, `migration graph`, `migration show`.
- Each of the four split verbs cross-references the other three in its **See also** section.

**AC8 — journey suite green at every milestone boundary.** `pnpm test:journeys` passes at the end of every milestone's PR. No milestone leaves the suite red.

**AC9 — docs match the surface.** At close-out:

- `docs/glossary.md` contains the canonical definitions from `domain.md` (or links to them).
- `docs/architecture docs/subsystems/7. Migration System.md` describes the new verb taxonomy.
- `docs/CLI Style Guide.md` reflects the new top-level subjects.
- No documented verb in any of those files refers to a verb that no longer exists.

## Open questions

*(None. The preflight scope question was settled by deferring preflight to a separate project; the three remaining open questions from the initial draft are settled in FR3 (help-text strategy), FR5 (wrong-grammar errors), and FR6 (exit codes).)*

## Follow-up tasks

These were settled during modelling but did not land in this project's implementation surface. They are recorded here so the gap between the modelling docs and the shipped CLI is explicit; each has a Linear ticket against `[PN] May: Migrations`.

- **`migration plan` advances the named ref atomically.** The modelling decision (see [`domain.md` § Verbs / Authoring](./domain.md) under `migration plan`, and the resolved entry under `ref set`) makes `migration plan --advance <ref>` the "freeze + promise" verb: producing the migration package and writing the ref pointer is one act, committed in one PR. `ref set` is reserved as the rarely-used direct-write escape hatch. **Status:** not implemented in this project; the shipped `migration plan` exposes `--config`, `--name`, `--from` only. **Tracked as:** [TML-2560](https://linear.app/prisma-company/issue/TML-2560) in `[PN] May: Migrations`. **Scope when implemented:** add the `--advance <ref>` flag to `migration-plan.ts`, route the argument through the M1 `parseContractRef` resolver, write the ref file as part of a successful plan, refuse-with-rationale when the ref doesn't already exist (no implicit creation — `ref set` remains the way to create a ref the first time), and add the corresponding journey-test assertion plus a glossary cross-reference.
