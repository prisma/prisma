# Migration Domain Model — Working Catalog

> **Status:** Working draft. This is the living vocabulary for the Prisma Next migration domain. It is built collaboratively through a DDD pass (see the [`drive-discussion`](../../.claude/skills/drive-discussion/SKILL.md) skill) and grows as the discussion progresses. Synonyms and ambiguities are deliberately preserved at this phase — they will be argued out in Phase 2 (Ubiquitous Language).

## Drives the work

- Linear: [TML-2546 — Review migration CLI commands and vocabulary](https://linear.app/prisma-company/issue/TML-2546)

## Audience priority (drives vocabulary register)

1. **Primary: agents** acting on behalf of a developer. Vocabulary is **technical, precise, unambiguous, machine-checkable**.
2. **Secondary: application developers.** Higher-level, less exhaustive, learnable. The dev-facing surface is a curated *subset and relabelling* of the agent-facing one — not a parallel vocabulary.
3. **Tertiary:** db admins reviewing pending migrations; operators running CD; extension authors owning a contract space.

## Mental-model anchor

**Git** (refs, branches, "checkout this branch into the working tree") is the deliberate analog. Where our model maps cleanly onto Git, we should reuse Git's vocabulary rather than invent our own.

**Corrected mapping** (the previous "commit ≈ migration" framing was wrong):

| Git | Our domain |
|---|---|
| Commit / tree | **Contract** (with `storageHash` as identity) |
| Commit hash | `storageHash` |
| Parent edge + diff (computed) | **Migration** (we make the edge explicit and addressable) |
| `git format-patch` output | **Migration package** (the cleanest Git analog) |
| Ref / branch | **Ref** (environment-named — `production`, `staging`) |
| HEAD's tree | The emitted contract |
| Working tree | The **live database** |
| `git checkout <ref>` | `migrate --to <ref>` |
| `git log` | walk the migration graph |
| `git revert` | author a new forward migration whose `to` is an earlier contract |

**Key divergence from Git:** a migration is a *patch*, not a commit. Git has no first-class addressable-patch object; we do. That means the verb for "produce a migration" cannot borrow `commit` from Git — there is no clean Git verb for what we're doing (`format-patch` is the closest semantic and isn't a well-known user-facing verb).

## Design rules that fall out of the model

These are constraints any CLI verb must respect.

### `migration` (noun) vs `migrate` (verb)

- **`migration`** is always **a noun**: the on-disk artifact (a package, a hash, an edge in the graph). Static. Filesystem.
- **`migrate`** is always **a verb**: the single act of advancing a *live database instance* along the graph.

### Namespacing rule: subject, not surface

The CLI is namespaced by the *subject* of the command, not by whether it touches a DB:

| Namespace | Subject | Examples |
|---|---|---|
| **`migrate`** (the verb itself) | The act of migrating a DB. | `migrate --to <ref>` |
| **`db <verb>`** | A live database. | `db update`, `db verify`, `db sign`, `db init` |
| **`migration <verb>`** | The migration artifacts and graph. | `migration plan`, `migration new`, `migration compile`, `migration show`, `migration list`, `migration graph`, `migration check`, `migration preflight`, `migration status`, `migration log` |
| **`contract <verb>`** | Contracts. | `contract emit`, `contract show`, `contract diff` |
| **`ref <verb>`** | Refs. | `ref set`, `ref list`, `ref delete` |

### Read-only vs mutating, not offline vs live

The earlier "offline vs live" axis is replaced by a finer-grained safety axis: **does this command mutate state, and what state does it mutate?**

| Class | What it does | Examples |
|---|---|---|
| **Mutating live** | Changes the database | `migrate --to <ref>`, `db init`, `db update`, `db sign` |
| **Read-only live** | Reads the database; answers questions about it | `db verify`, `migration status`, `migration log` |
| **Mutating sandbox** | Mutates only an ephemeral shadow database; the production DB is untouched | `migration preflight` |
| **Mutating offline** | Writes to the filesystem only | `migration plan`, `migration new`, `migration compile`, `contract emit`, `ref set` |
| **Read-only offline** | Reads filesystem only | `migration list`, `migration graph`, `migration show`, `contract show`, `contract diff` |

**The load-bearing safety property:** users (and agents) must be able to tell from the verb whether it mutates state, and whether it touches a real DB. The verb's namespace alone is not sufficient — `migration status` (live, read-only) and `migration plan` (offline, mutating) share the `migration` namespace but differ on both axes. Help text and `--dry-run` discipline must surface this distinction.

### `migrate` is forward-only

`migrate --to <contract>` walks the migration graph from the marker's current contract to the target contract. It never reverses, never rewinds, never resets. Backward motion is **not a migration** — there is no such thing.

Dev iteration on a tweaked migration uses `db update --to <hash>`, which is off-graph reconciliation (see below), not a graph walk.

### One verb for migrating, regardless of environment

There is **one** operation that walks the migration graph against a live database: `migrate --to <ref>`. It is the same verb in dev, staging, and production. **What changes between environments is the database URL**, not the verb name and not the verb's behavior.

We explicitly **reject the dev/deploy verb split** that other systems (notably Prisma current) introduce. The safety properties Prisma current bundles into `migrate dev` (shadow-DB drift checks, sandbox replay, etc.) are a *separate, explicit verification step* in our model — you ask for them by name, you don't get them as a hidden side effect of a god-command.

### Off-graph reconciliation is not migration

`db update` reconciles a live database to a target contract **without walking the migration graph**. It does not produce a migration, does not advance a ref, does not consult the marker's prior contract. It is dev-only.

- `db update` → reconcile to current contract (the 90% case).
- `db update --to <contract>` → reconcile to any contract we can name (see *Contract references* below).

### Contract references and migration references

The CLI has **two parallel reference grammars** that share several forms but resolve in different namespaces.

A **contract reference** identifies a contract in the migration graph (resolves to a `storageHash`).

A **migration reference** identifies a migration (resolves to a migration package, or equivalently its `migrationHash`).

The command's expected argument type determines which grammar applies — `migrate --to <contract>` uses contract references; `migration show <migration>` uses migration references. Hash-shaped input resolves in the active grammar's namespace.

Both grammars borrow two ideas from Git (prefix-matching on hashes and the `^` operator) but are otherwise specific to our model — there is no `~N`, no `@{N}` reflog, no `HEAD`.

#### Contract reference (`<contract>`)

| Form | Meaning |
|---|---|
| `<hash>` or `<hash-prefix>` | Bare hex (no `sha256:` prefix). 8+ char prefixes accepted; matched against contract storage hashes. |
| `<ref-name>` | The contract the named ref points at. |
| `<migration-dir-name>` | The migration's **`to`-contract**. |
| `<migration-dir-name>^` | The migration's **`from`-contract**. |
| `<filesystem-path>` | The contract file at that path. |

#### Migration reference (`<migration>`)

| Form | Meaning |
|---|---|
| `<hash>` or `<hash-prefix>` | Bare hex, matched against **migration hashes**. The canonical handle for scripts where stability-across-renames matters. |
| `<migration-dir-name>` | The migration directly. |

#### Ambiguity and resolution rules

- **Migration directory names follow a `<timestamp>T<HHMM>_<slug>` convention by default but are user-controlled.** A user could create a directory called `1f3b7c4a` if they wanted.
- When an input could match more than one form within the active grammar (e.g. a hex-named directory that also looks like a hash prefix), it is an **ambiguity error**. The CLI lists the candidates and asks the user to disambiguate by using a longer / different form (e.g. `./1f3b7c4a` to force the filesystem interpretation; the full migration hash for the migration interpretation).
- Ambiguity *within* a namespace (two hashes sharing an 8-char prefix; two migrations sharing a 4-char hash prefix) is also an error with candidate listing — same rule Git uses for short SHAs.
- The `^` operator is only meaningful on a migration directory name (or a hash-resolved migration) — the only case where a "predecessor contract" is unambiguous (the migration's `from`). Not generalized to refs or contract hashes (a contract can be the destination of multiple migrations).

#### Refs vs the umbrella

**A ref is a specific kind of contract reference** — the named, file-backed, persistent kind. The umbrella concept is "contract reference"; "ref" is one instance of it. (Pointer/memory-address analogy: pointer is the family, named pointer is a specific instance.)

#### CLI placeholder convention

- `<contract>` — contract reference (per the first table above).
- `<migration>` — migration reference (per the second table above).
- No umbrella shorthand. Accepted forms documented per-command.

#### Examples

```
prisma-next migrate --to production                            # ref name → contract
prisma-next migrate --to 1f3b7c4a                              # hash prefix → contract
prisma-next migrate --to 20260117T1042_add_users_table         # migration dir → to-contract
prisma-next db update --to 20260117T1042_add_users_table^      # migration dir + ^ → from-contract
prisma-next migration show 20260117T1042_add_users_table       # migration dir → migration
prisma-next migration show 1f3b7c4a                            # hash prefix → migration (by migration hash)
```

### Refs are defined by CD behavior, not Git habit

The load-bearing semantics of a ref is **"the contract CD will `migrate --to` in this environment."** Everything else (naming, on-disk form, PR conventions) derives from that primitive.

Consequences:
- Refs are **environment-named** (`production`, `staging`, ...). The Git-generic `head` ref has been dropped — it carried no information the emitted `contract.json` doesn't already imply.
- A ref is a *promise* the repo makes about the next CD run. The PR is the moment that promise is staked.

### Initialization vs adoption-by-signing

Two distinct entry points for bringing a database under contract control:

- **`db init`** — bootstrap. The DB is empty (greenfield) or being adopted by *executing* an initial migration (brownfield-incremental). Lays down structure. Live, may mutate.
- **`db sign`** — declare that an existing live database satisfies a contract. Verifies live schema satisfies the contract, then writes the contract hash into the marker. **Refuses if it doesn't satisfy.** No structural changes. The adoption path when the DB already happens to match.

`db sign` is a sibling of `db verify` (both verify the live DB against a contract), not a sibling of `migrate` (no structural mutation).

### Anti-patterns (rejected by name)

- **`migrate dev`** — environment-name-as-verb. Also a god-command that does emission + planning + execution + drift detection in one. Both forbidden.
- **`migrate deploy`** — same anti-pattern in the other direction. You don't "deploy" a migration; you `migrate --to <ref>`.
- **The dev/deploy verb split itself.** Other systems have it because their migration verb conflates "walk the graph" with "do the dev-time safety checks." We separate those.
- **`freeze`** — not how anyone talks. Replaced with explicit verbs (`migration plan`, `migration new`).
- **Single verb that touches both filesystem and a live DB.** Verbs must be one or the other.
- **"Baseline"** as a separate concept. A migration from `∅` is just a regular `migration plan` with no prior ref — there is no special "baseline" noun.

## Source material

Drawn from:
- The user's concrete scenario for the dev / PR / CI / CD workflows (see [`discussion-notes.md`](./discussion-notes.md)).
- [Migration System subsystem doc](../../docs/architecture%20docs/subsystems/7.%20Migration%20System.md).
- [CLI subsystem doc](../../docs/architecture%20docs/subsystems/11.%20CLI.md).
- [CLI Style Guide](../../docs/CLI%20Style%20Guide.md).
- ADRs: 001 (edges), 004 (storage/profile hash), 044 (checks — superseded), 122 (init/adoption), 123 (drift taxonomy), 176 (data invariants), 192 (`ops.json` is the contract), 199 (storage-only identity), 208 (invariant-aware routing), 212 (contract spaces).
- Reference summaries of established migration systems under [`references/`](./references/).

---

## Nouns (entities, value objects, identities)

Grouped by sub-area so the relationships are visible. Some terms appear in more than one group on purpose — that's the kind of overlap Phase 2 will resolve.

### Contracts, hashes, and identity

- **Contract** — the application's declaration of what the database must contain, support, and enforce. The system boundary; the centre of gravity. Authored in PSL or TypeScript; emitted to `contract.json` + `contract.d.ts`. The contract is **not a schema**; when applied, the contract is what *produces* the schema in the live database.
- **Contract artifact** — the emitted, on-disk representation of a contract (`contract.json` + `contract.d.ts`). What downstream tools and the runtime consume.
- **Contract IR** — the in-memory canonical form of a contract (before emission).
- **PSL** — Prisma Schema Language. One of two authoring surfaces for contracts (and the canonical one for extensions).
- **TypeScript contract** — TypeScript-authored contract using `typescriptContract(...)`. Second authoring surface.
- **Storage hash** (`storageHash`) — deterministic hash over the contract's storage-affecting parts (`schemaVersion`, `targetFamily`, `target`, `storage`). The identity of a *contract* in the migration graph. (Formerly `coreHash`.) **User-facing convention:** when the CLI says "hash" without qualification, it means the storage hash. Contract references resolve to one.
- **Profile hash** (`profileHash`) — deterministic hash over the contract's declared capabilities. The identity of a *capability profile* the database must satisfy. **Not user-facing. Candidate for retirement.** Should not appear in CLI output; if it does, it must be qualified.
- **Migration hash** (`migrationHash` / `migrationId`) — content-addressed hash over `(strippedManifest, ops)`. The identity of a migration as a *physical effect on storage*, independent of cosmetic contract details. **Always qualified as "migration hash" in user-facing prose.** Used only when a migration must be referred to by unambiguous identity (integrity checks, error messages about hash mismatch). The common path is referring to a migration by its directory name.
- **Canonicalization** — deterministic JSON ordering that makes hashes reproducible across runs and machines.

### Database state

- **Database** — the live target instance, identified externally by a connection URL.
- **Marker** — the database's self-record of which contract(s) it currently claims to satisfy. One row per **contract space**. Stores `storageHash`, `profileHash`, `invariants[]`, optional contract JSON. The framework's *guarantee record* about the database.
- **Ledger** — append-only audit log of executed migrations (per-DB). User-owned; framework reads only the marker, never the ledger, for routing decisions.
- **Schema** — the structural definition of a live database, as observed by introspection. **Always refers to the live database**, never to a contract or an authored artifact. The contract *declares* what the schema must look like; the schema *is* what the database actually has.
- **Postgres schema** — the Postgres-specific namespace concept (tables grouped under a name like `public`). Always qualified as "Postgres schema" to disambiguate from the general "schema" sense above.
- **Drift** — divergence between contract and database. Taxonomy includes marker-level (missing / corrupt / stale / hash-mismatch), schema-level (manual DDL / partial execution / concurrent execution), graph-level (orphan database / no path / path breakage / cycle), capability (missing / downgrade / profile mismatch), transactional, cache / replica freshness, canonicalization.

### Operations and migrations

- **Migration** — a unit of intent that takes the database from one **contract** to another. The canonical user-facing term. Refers indifferently to the conceptual unit, the on-disk directory, and the graph entity — exact meaning falls out of context.
- **Migration package** — internal/architectural term for the on-disk directory specifically (its files: `migration.json`, `ops.json`, `migration.ts`, `start-contract.json`, `end-contract.json`, optional typings). Used in dev docs when filesystem shape matters; in user-facing prose, just say "migration."
- **Migration directory name** — the conventional user-facing identifier for a migration: `<YYYYMMDDTHHMM>_<sanitized-slug>` (UTC, minute precision). Created at planning time from `--name <slug>`. The timestamp prefix is **convention**, not invariant — the directory name is user-controlled. Uniqueness within the app contract space is enforced at planning time (collisions are rejected); ambiguity at resolution time (e.g. a hex-named directory colliding with a hash prefix) produces an explicit error.
- **`migration.json`** / **Manifest** — the migration's metadata file. Records `from`, `to`, `migrationHash`, `providedInvariants`, `labels`, `createdAt`, and the (non-identity) `fromContract` / `toContract` snapshots.
- **`ops.json`** — the migration's op list in post-lowering form. *The migration contract* — what the runner trusts and replays. Never compiled, never `eval`'d at execution time.
- **`migration.ts`** — authoring surface (TypeScript). The file the developer edits. Self-emits `ops.json` + `migration.json` when run directly. Never loaded by `migrate` at execution time.
- **Start contract** / **End contract** — bookend snapshots of the contracts at the migration's `from` and `to` storage hashes. Author-time conveniences; not part of identity.
- **Migration edge** — the graph-theoretic view of a migration: a directed edge from the `from`-contract to the `to`-contract. **Used only when speaking about the migration graph** (path-finding, reachability, drift taxonomy). Never as bare "edge". In all other contexts, "migration" is the right word.
- **Operation** — a single declarative step inside a migration. Carries an envelope (precheck / execute / postcheck) and an `operationClass` (`widening`, `destructive`, `data`).
- **DDL operation** — structural schema operation (create/alter/drop table, index, column, …).
- **Data transform** — operation that mutates data, often alongside structural change. Carries `operationClass: 'data'` and may carry an `invariantId`.
- **Operation envelope** / **Three-phase envelope** — the shared shape of every operation: `precheck[]` → `execute[]` → `postcheck[]`.
- **Idempotency class** — `fully idempotent` / `conditionally idempotent` / `non-idempotent`. Determines whether a partially-executed migration can be safely retried.
- **Placeholder** — a `never`-returning function used as a scaffolded slot in `migration.ts` for parts the planner could not derive. Throws `PN-MIG-2001` at emit time.
- **Intermediate migration** — a fully-attested migration package whose `ops.json` is `[]` because `migration.ts` still contains unfilled placeholders. Visible to the runner but executes zero ops. (Avoid "intermediate state" — "state" is reserved for database state.)

### Graph and routing

- **Migration graph** — the directed graph (possibly cyclic) of **contracts** connected by **migrations** (the edges). Reconstructed from the on-disk migration packages.
- **Database state** (or just **state**) — the literal condition of a database at a point in time: its schema, data, marker, ledger — everything. **Not a graph node.** A database has a state; the migration graph has contracts. The marker records *which contract* a database's state currently claims to satisfy. (CS sense of "state": the condition of a system at a point.)
- **`∅`** — the **empty database state**: introspection returns no objects. Conventional starting point for baseline migrations (where the manifest's `from` is `null`, per ADR 199). One specific state; not a "permissive contract".
- **Null contract** — a hypothetical contract with no requirements; satisfied by any database state in non-strict mode. **Distinct from `∅`** (which is one specific database state). Mostly theoretical; named here to keep it from being conflated with `∅`.
- **Path** — an ordered sequence of migrations connecting two contracts.
- **Ref** — a named **contract reference**: a named, persisted, file-backed pointer to a contract. Today: `{ hash: string, invariants: string[] }`. Stored as JSON files under `migrations/refs/<name>.json`. **Refs are environment-named** (`production`, `staging`, ...). The `head` ref has been dropped from user-facing vocabulary — it carried no information the `contract.json` doesn't already imply. (By analogy: a pointer is a named memory address. Refs are a specific kind of contract reference; the umbrella is "contract reference.")
- **Invariant** / **Data invariant** — a named, checkable predicate over data (e.g. "all user phone numbers are normalized to E.164"). The correctness primitive for data that the contract hash cannot capture.
- **Invariant id** (`invariantId`) — opt-in routing key on a data transform. When set, the transform is *routing-visible*: refs may require that id.
- **Provided invariants** (`providedInvariants`) — the set of `invariantId`s a migration declares. Part of the migration's identity.
- **Required invariants** — the set of invariant ids a ref declares it requires.
- **Effective required** — `ref.invariants − marker.invariants`. The invariants still pending against the database for that ref.
- **Find-path outcome** — discriminated result of routing: `ok` (path covers required) / `unreachable` (no structural path) / `unsatisfiable` (structurally reachable, but no path covers required invariants).

### Contract spaces

- **Contract space** — a `(contract.json, migrations, headRef)` triple owned by exactly one contributor. The application owns one space (`'app'`); each schema-contributing extension owns one. Spaces are disjoint on disk; they integrate only via the live database.
- **Space-id** — identifier for a contract space. `[a-z][a-z0-9_-]{0,63}`. `'app'` is reserved for the application.
- **App-space** — the application's contract space.
- **Extension-space** — a contract space owned by an installed extension (e.g. `cipherstash`, `pgvector`).
- **Pinned per-space artifacts** — the framework-owned on-disk mirror of each loaded extension's `contractSpace` (`migrations/<space-id>/{contract.json, contract.d.ts, refs/, <migration dirs>}`). Execution-time and verify-time read *only* the pinned files, never the extension's descriptor module. *(Today's mirror includes a `refs/head.json` file; with `head` dropped from vocabulary that file is either retired or renamed to something descriptive like `current.json` — implementation cleanup, not vocabulary.)*
- **Descriptor** — the runtime/control descriptor of an extension. Carries `contractSpace` when the extension contributes schema.

### Process roles (components / services)

- **Authoring** — the act and surfaces (PSL, TypeScript) used to define a contract or a migration.
- **Emitter** — produces emitted artifacts (`contract.json` + `contract.d.ts`) from a contract source.
- **Planner** — diffs two contracts and produces an `OpFactoryCall[]` IR, which renders to operations and to `migration.ts`.
- **Runner** — executes a migration's operations against a live database, with three-phase loop, lock, marker advance, ledger write.
- **Verifier** — compares contract (or aggregated spaces) against the live database; reports structured drift kinds.
- **Adapter** — target-family-specific lowering of operations into a wire form.
- **Driver** — target-specific transport (the connection-bound thing that actually talks to the database).
- **Preflight (service)** — sandbox execution for validation. Local: shadow DB or EXPLAIN-only. Hosted: PPg (Prisma Postgres).
- **PPg** / **Prisma Postgres** — contract-aware Postgres service that hosts preflight and a contract ledger.
- **Advisory lock** — per-DB lock that prevents concurrent applies (Postgres).
- **CAS** — compare-and-swap, used as concurrency control for Mongo marker writes.

### Adoption / lifecycle

- **Adoption** — bringing an existing database under contract control. Three paths: **greenfield**, **brownfield-conservative**, **brownfield-incremental**.
- **Introspection** — read-only schema discovery of a live database.
- **Initialization** — `db init`. Bootstraps an empty database (greenfield) or applies initial migrations to an existing one. Lays down structure.
- **Signing** — `db sign`. Verifies a live DB satisfies a contract, then writes the contract hash into the marker. The adoption path for an already-matching database. No structural changes.
- **Reconciliation** — `db update`. Live-introspect, diff against a target contract, execute the difference. Off-graph; dev-only first-class workflow.
- **Preflight** — sandbox execution of a migration to verify the migration behaves as promised. Distinct from `verify` (which is about the live DB), and distinct from `migrate` (which mutates the real DB).
- **Squash** — collapsing a range of migrations into a single equivalent migration.
- **Promotion** — moving a ref forward (typically: advancing `production` to match a freshly-merged change).

---

## Verbs (commands users can perform)

Grouped by intent. *Italicised* entries are terms used in current CLI commands; **bold** entries are candidate canonical verbs we may want to consolidate around.

### Authoring (offline — filesystem only)

- **Author** — write a contract or migration in PSL or TypeScript (the meta-verb).
- **`contract emit`** — produce `contract.json` + `contract.d.ts` from contract source.
- **`migration plan`** — diff `<ref>` ref's contract → current contract; scaffold a migration package with ops auto-filled; advance the named ref to the new contract's hash. *The "freeze + promise" verb.*
- **`migration new`** — scaffold a migration package with `from`/`to` storage hashes but **no ops**. For hand-authored migrations. *Sibling of `plan` — same artifact shape, different ops source.*
- **`migration compile`** — execute `migration.ts`, (re)write `ops.json` + `migration.json`. The TS → JSON build step; consumers run this after editing `migration.ts` by hand.
- **`ref set <name> <contract>`** — directly set a ref's target contract. Rarely used by hand; the normal path is `migration plan` advancing a ref atomically. Verb is `set` (not `move`) because refs are stored values being written, not entities traversing the graph — the spatial-movement vocabulary is reserved for `migrate`. No default contract: writing a production-class ref accidentally is too dangerous.

### Mutating a live database

- **`migrate --to <contract>`** — *the* migration verb. Walks the graph from the marker's current contract to the target. Forward-only. Same verb everywhere (dev, staging, production); only the DB URL changes.
- **`db init`** — bootstrap an empty database, or adopt an existing one by executing initial migrations from `∅`. Lays down structure. Live, may mutate.
- **`db update`** — off-graph reconciliation. `db update` reconciles to the current contract; `db update --to <hash>` reconciles to any contract we can name on disk. **Dev-only.** Does not produce a migration, does not consult the graph, does not advance any ref.
- **`db sign [<contract>]`** *(explicit form: `db sign --contract <contract>`)* — verify the live DB satisfies a contract, then write the contract hash into the marker. **Refuses if it doesn't satisfy.** No structural mutation. The adoption path for an already-matching DB. Without an argument, defaults to the current `contract.json`. The argument names *the thing being signed* — distinct from `--to` (movement) used by `migrate` and `db update`.

### Verification

Three verbs along two axes — *what's being verified* (live DB / migration artifact / migration behavior) and *whether the verb touches the database*. Each verb has a distinct name because each answers a structurally different question; reusing `verify` for all three would force users to read the qualifier every time.

- **`db verify`** — *"does the live DB currently satisfy its contract?"* Compares marker + live schema against the contract; reports drift kinds. Live, read-only.
- **`migration check [<m>]`** — *"are these migration artifacts internally consistent?"* With a migration argument: recomputes that migration's hashes, validates its `ops.json`/manifest match, confirms its on-disk shape is complete. With no argument: a holistic check over the whole graph — every migration self-consistent; every edge's `from` and `to` line up with neighbouring contracts; no orphan nodes; no dangling refs. Offline, read-only.
- **`migration preflight <m>`** — *"would this migration actually do what it promises?"* Sandbox-executes a migration against a shadow DB (or PPg) and reports the outcome. The dev's behavioral verification tool when iterating on a tweaked migration. Live (against the sandbox), mutates only the shadow.

### Reading — live (touches the DB)

- **`db verify`** — *"does the live DB satisfy the contract?"* Compares marker + introspection against the contract; reports drift kinds.
- **`migration status [--to <contract>] [--from <contract>]`** — *"what needs to happen to reach the target contract?"* (equivalently: *"what will `migrate --to <contract>` do?"*). Reads the marker, computes the path, lists migrations + ops + ref changes. With `--from <contract>`, becomes offline (answer the question without touching the DB) — used by PR review / CI that doesn't have DB access. **The load-bearing CI/CD question.**
- **`migration log`** — *"what did this DB execute, and when?"* Reads the ledger. Audit history of executed migrations.
- **`db schema`** — print the live schema (tree or JSON).

### Reading — offline (filesystem only)

- **`migration list`** — flat enumeration of migrations on disk, topologically ordered. Cheap, scriptable.
- **`migration graph`** — relational view of the graph (ASCII tree with branch points and ref markers, or DOT, or JSON). Human-readable companion to `list`.
- **`migration show <dir-name>`** — details of a single migration: ops, checks, invariants, bookend hashes.
- **`contract show <contract>`** — pretty-print a contract.
- **`contract diff <contract> <contract>`** — structural diff between two contracts.
- **`contract infer`** — read a live schema, write an inferred PSL contract (live read, but the output is offline). *Edge case: lives in the contract namespace because contracts are the subject; the live read is incidental.*

### Reading-the-graph questions (the ticket's named gap)

These map onto the commands above:
- *"What path will be taken to reach `<ref>`?"* → `migration status --to <ref>`
- *"What does this branch promise that mainline doesn't?"* → `migration graph` + `ref list` (PR-review tooling can diff the ref pointers)
- *"What's the graph shape?"* → `migration graph`
- *"Is the graph well-formed?"* → `migration check` (no argument: graph-wide). *"Is this one migration well-formed?"* → `migration check <m>`. Recomputes hashes, checks manifest ↔ `ops.json` consistency, validates edges/refs. Read-only, offline. Distinct from `migration preflight` (sandbox-executes for behavioral verification) and `db verify` (checks the live DB against its contract).

---

## Events (things that have happened)

Used both for runner telemetry and for understanding which transitions a workflow stitches together.

- **ContractEmitted** — contract source authored → artifacts produced.
- **MigrationPlanned** — a new migration package was scaffolded from a contract diff.
- **MigrationEmitted** — `migration.ts` was run; `ops.json` + `migration.json` were (re)written.
- **MigrationExecuted** — runner executed a migration's ops; marker advanced. *(Existing internal name: `MigrationApplied`; opportunistically renaming when touched.)*
- **MarkerAdvanced** — marker write succeeded for a contract space.
- **InvariantSatisfied** — a data transform's postcondition passed and its `invariantId` was unioned into the marker's invariants set.
- **RefMoved** — the contract a ref points at changed on disk.
- **DriftDetected** — verifier or runtime found a mismatch.
- **PreflightCompleted** — sandbox execution succeeded with diagnostics.

---

## Queries (interrogative operations)

Phrased as questions the agent (or developer / db admin) needs to be able to ask the system.

### About the database

- *Where is this database right now?* — what is its marker per space (`storageHash`, `profileHash`, `invariants`)?
- *Does the live schema match the contract?* — verifier outcome.
- *Does the marker match the contract?* — hash equality check.
- *Is the app bundle signed against the same contract as this database?* — equality of the app's expected `storageHash` and the marker's.

### About the graph and refs

- *What is `<ref>` pointing at, and what invariants does it require?*
- *What path connects contract A to contract B?* — including invariant coverage.
- *What will run when I migrate to `<ref>`?* — the *load-bearing CI/CD question*; effectively *"resolve path from marker to ref, list ops and ref changes"*.
- *What migrations are pending against this database for `<ref>`?*
- *What are the branch tips of the graph?* — reachable leaves from a given contract.
- *Is the graph internally consistent?* — every package's migration hash recomputes; every ref points at a known contract; no orphan dirs; no marker rows for unloaded spaces.

### About a specific migration

- *What does this migration do?* — ops + checks + invariants + bookend hashes.
- *Is this package internally consistent?* — `migrationHash` of `(manifest, ops)` matches the stored one.
- *Has the `ops.json` drifted from `migration.ts`?* — re-emit comparison.

### About the diff between branches (for PR review / CI)

- *Compared to mainline, what migrations does this branch add?*
- *Compared to mainline, how have refs changed?*
- *What's the net effect on production?* — combined ops + ref deltas.

---

## Open questions / suspect terms

These are terms or distinctions that came up in discussion and have not yet been resolved.

*(None outstanding. Recently closed items listed in the resolved section below.)*

## Resolved (no longer open)

- **`migration` (noun) vs `migrate` (verb).** Noun = on-disk artifact; verb = the live act of walking the graph. Offline/live axis is load-bearing across the CLI.
- **One verb for migrating.** `migrate --to <ref>`, same in dev/staging/prod. No `migrate dev`, no `migrate deploy`.
- **`migration plan` vs `migration new`.** Two distinct authoring entry points: `plan` derives ops from a contract diff; `new` scaffolds an empty package for hand-authored ops. Kept separate.
- **`migration compile`** for `migration.ts` → `ops.json`. Confirmed.
- **No `db reset`.** Dev iteration uses `db update --to <hash>`. Off-graph reconciliation parameterized by target.
- **No "baseline" noun.** A `∅ → H` migration is just a regular migration.
- **`db init` vs `db sign`.** Distinct: init lays down structure (live, mutates); sign verifies + writes marker (no structural mutation, refuses if DB doesn't already satisfy the contract).
- **"Freeze"** rejected. `migration plan` is the verb for the freeze-and-promise act.
- **Dev/deploy split** rejected. The safety semantics belong to the DB URL, not the verb.
- **Contract references and migration references.** Two parallel grammars sharing forms but resolving in different namespaces. `<contract>` resolves to a contract storage hash (accepts: hash, ref name, migration directory name → to-contract, `<dir>^` → from-contract, filesystem path). `<migration>` resolves to a migration (accepts: migration hash or directory name). The command's argument type determines which grammar applies — same hash-shaped input resolves in different namespaces depending on whether the command expects a `<contract>` or a `<migration>`. **In CLI argument syntax the placeholder is `<contract>` or `<migration>`** — no umbrella shorthand. A **ref** is a specific kind of contract reference (named, persisted, file-backed); the umbrella is **contract reference**.
- **Directory names are user-controlled.** The default `<timestamp>T<HHMM>_<slug>` is convention, not invariant. Ambiguity between a directory name and a hash prefix is an explicit ambiguity error with candidate listing — same Git rule for short SHAs that collide with branch names. Disambiguate with `./<path>` for filesystem paths or with a longer / different form.
- **`db sign [<contract>]` (positional) or `db sign --contract <contract>` (explicit).** The argument names *the thing being signed* — neither `--to` (movement) nor `--at` (position) carries the right meaning. Defaults to the current `contract.json` when omitted.
- **`ref set <name> <contract>`** is the direct-ref-write verb. `move` was rejected because refs are stored values, not entities that traverse the graph — the spatial-movement vocabulary is reserved for `migrate`.
- **`head` ref dropped.** Refs are exclusively environment-named (`production`, `staging`, ...). The emitted `contract.json` already plays the role of "what the repo is working toward"; a `head` ref would have been redundant. The pinned per-space artifact named `refs/head.json` is implementation cleanup (rename or remove), not vocabulary.
- **Three verification verbs, three distinct names.** Calling them all `verify` would force users to read the qualifier every time; "what kind of verification?" is the wrong question to make the user resolve at the call site.
  - **`db verify`** — live DB satisfies its contract (marker + introspection vs. the contract). Live, read-only.
  - **`migration check [<m>]`** — artifact / graph integrity. With `<m>`: that migration's hashes recompute and its on-disk artifacts are complete. Without: graph-wide consistency (every migration self-consistent; every edge's `from` and `to` line up with neighbouring contracts; no orphan nodes; no dangling refs). Offline, read-only. Verb borrowed from `cargo check` and Atlas's "pre-migration checks" — naturally scopes from a single artifact to a holistic sweep.
  - **`migration preflight <m>`** — behavioral verification via sandbox execution. No surveyed tool has a direct analog (Atlas's `--dev-url` is bundled into apply; Prisma current's shadow replay is implicit-only inside `migrate dev`; Liquibase's `update-sql` / `validate` are preview/structural; Sqitch's `verify` runs post-deploy). Preflight is the aviation borrowing — "checks you run right before doing the thing for real" — uncontested across migration vocab.
- **`db init` and `prisma-next init` both kept.** The namespace disambiguates: `prisma-next init` is project scaffolding; `prisma-next db init` lays down DB structure. No rename needed.
- **`contract emit` and `migration plan + compile` are asymmetric on purpose — the asymmetry is structural, not stylistic.** The two operations have fundamentally different shapes:

  Contract authoring is **one-step**:

  ```
  source (PSL/TS)  ──emit──►  contract.json + contract.d.ts
  ```

  Migration authoring is **two-step**, with an intermediate user-editable artifact:

  ```
  contract diff  ──plan──►  migration.ts (emitted by framework)  ──compile──►  ops.json
  ```

  The `migration.ts` is *itself* an emitted artifact — the planner emitted it. What the user does when they re-run `migration.ts` is **compile**: executing the planner's emitted source to produce its lowered form. The verbs encode who's authoring at each step:

  - **emit** = user-authored canonical source → first-class artifact (one step, contract case)
  - **plan + compile** = framework scaffolds the source + user edits + lowering (multi-step, migration case)

  "Emit your migration" would conflate scaffolding with lowering and obscure which party owns the source. Saying "compile your migration" reads correctly because that *is* what the user does — they execute `migration.ts` and the result is the canonical `ops.json`. The asymmetry tells the right story: **contracts are user declarations the framework artifactizes; migrations are framework-scaffolded programs the user refines and lowers.** Using the same verb for both would smear that real difference.
- **"Three-phase envelope" retired as a coined term.** The three phases — **precheck**, **execute**, **postcheck** — remain first-class vocabulary (they appear in blog posts and are the key conceptual hook for understanding migration ops). When referring to the wrapper, use descriptive prose ("the op's prechecks, execute, and postchecks") rather than the noun "envelope".
- **"Operation class"** kept as user-facing vocabulary (appears in blog posts).
- **"Routing" / "routing-visible"** kept as internal-only. Not user-facing CLI vocabulary.
- **Interrogative surface.** `migration status [--to <contract>] [--from <contract>]` (path / pending; offline-capable via `--from`), `migration log` (execution history from the ledger; live), `migration list` (flat enumeration, Git-tree-style with branches on the left; offline), `migration graph` (visual relational view for debugging the graph; offline), `migration show <dir>` (single migration; offline). `status` and `log` are live read-only; `list`, `graph`, `show` are offline. `list` and `graph` stay as distinct verbs even though they render the same data structure — the verb indicates the user's intent, not the rendering.
- **Safety axis is "what does this mutate?", not "offline or live?"** Four classes: mutating-live, read-only-live, mutating-offline, read-only-offline. Namespace (`migrate` / `db` / `migration` / `contract` / `ref`) is by *subject*, not by safety. The verb is responsible for being self-evidently classified.
- **Cluster 1 — `schema` is the live database's structural definition.** Always. Never an authored artifact, never a contract, never anything else. Exception: "Postgres schema" (always qualified) for the namespace concept inside Postgres.
- **Cluster 2 — "Migration" is the canonical noun.** "Migration package" survives only in architectural prose where filesystem shape matters. "Migration artifact" is retired. "Migration edge" appears only when speaking about the migration graph specifically; never as bare "edge".
- **Cluster 3 — `Marker` and `Ledger` are both first-class and both distinct.** Marker = where you are (mutable, one row, framework-trusted). Ledger = how you got here (append-only, framework reads only for `migration log`).
- **Cluster 4 — Hash discipline.** Unqualified "hash" in user-facing prose = storage hash. "Migration hash" always qualified; rarely user-facing (the directory name is the normal handle). Profile hash is not user-facing and is a candidate for retirement.
- **Cluster 5 — `execute` / "executed".** Migrations are *executed* (they are programs). The past participle "executed" appears in `migration log` output and prose. `apply` / "applied" is retired from the user-facing surface; internal helpers (`apply-aggregate`, `db-apply-aggregate`, `MigrationApplied` event) get renamed opportunistically when touched.
- **Cluster 6 — `plan`.** Two senses (migration plan, query plan) survive in their respective domains. Qualify only when crossing domains.
- **Cluster 7 — `operation` → `op` for migrations.** Migration operations are **ops** (idiomatic short form; matches `ops.json`). "Operation" without qualification is reserved for runtime / query / registry contexts. "Op" gives migration operations a distinct visual identity and lets the longer word stand for the other senses without ambiguity.
- **Cluster 8 — `state` reframed.** "State" is not a graph node. Graph nodes are **contracts** (identified by storage hash). "State" is reserved for the CS sense: the literal condition of a database at a point in time (schema + data + marker + ledger). The migration graph is a graph of contracts; a database has a state.
  - Replace "current state" → "current contract", "target state" → "target contract", "graph node" → "contract".
  - For migration-package lifecycle conditions (in-progress, partially-executed, etc.), use **status**, **phase**, or **progress** — never "state".
  - **`∅`** is the empty database state (introspection returns no objects). One specific state, not a contract. Conventional starting point for baseline migrations.
  - **Null contract** is a (theoretical) contract with no requirements. Distinct from `∅`; not user-facing.
- **`show` verb across subjects.** `migration show <m>` and `contract show <c>` are retained from the current CLI as the inspect-one verbs in their respective namespaces; both *resolve a reference and render the resolved artifact*, which is real value beyond `cat`. `ref show <name>` was rejected — refs are `{hash, invariants[]}`; small enough that `ref list` (with the named ref filtered) covers the same ground without a separate verb. This was not deliberated during Phase 2 — `show` was carried in from the current CLI without explicit discussion. Reconsidered during Phase 3 audit; only `ref show` failed the keep-it-or-not test.

---

## Reference systems

Summaries of established migration tools, used as comparison anchors when picking vocabulary. See [`references/`](./references/).
