# Discussion Notes

> Running notes from the [`drive-discussion`](../../.claude/skills/drive-discussion/SKILL.md) DDD pass on the migration domain model.
> Captures decisions, framings, and pivots in real time so the discussion's reasoning survives context-window pressure.

## Drives

- Linear: [TML-2546 — Review migration CLI commands and vocabulary](https://linear.app/prisma-company/issue/TML-2546)
- Project area: [`[PN] May: Migrations`](https://linear.app/prisma-company/project/d16ebd98-535e-440b-9a10-076f55468412)

## Personas loaded

Sequence so far:
- `pm` — scoping audience and journeys.
- `architect` — DDD pass; now driving.
- `devrel` — queued for the audit pass once vocabulary settles.

## Framing decisions to date

### Audience priority is agent-first

1. **Agents** acting on behalf of a developer — precise, unambiguous, machine-checkable vocabulary.
2. **Application developers** — higher-level, less exhaustive, learnable.
3. Tertiary: db admins reviewing pending migrations; operators running CD; extension authors owning a contract space.

**Consequence for the vocabulary work.** "Reign in" means *consolidate synonyms and disambiguate homonyms* — not *simplify*. Precise technical names are wanted; the dev-facing surface is a curated subset/relabelling of the precise one, not a parallel vocabulary.

### Mental-model anchor is Git

Refs, branches, HEAD, the DAG model — explicitly chosen as the analog. Where our model maps cleanly onto Git, we want Git's vocabulary rather than invent new terms. Goal: a user with Git fluency should be able to internalise our migration graph quickly.

### Load-bearing user journeys

- **J0 — Bootstrap empty DB** (`db init`). Greenfield only.
- **J1 — Dev inner loop.** Edit contract, advance local dev DB (`db update` style — no migration file produced, intentionally dev-only but first-class).
- **J2 — Author + promise.** When dev is satisfied: produce a migration package AND declare "this branch advances `<ref>` (typically `production`) to the new state". One committed unit per PR. The mechanic itself is *not* the core focus — the domain model under it is.
- **J3 — Pre-deploy review (db admin).** Read-heavy: *"what's pending? what does this do?"* — the interrogative-commands gap bites here.
- **J4 — Status landing.** "Where is the DB right now, and what's next?" Single interrogative landing pad.
- **J5 — Migrate DB to ref.** *The dominant CD operation.* User proposed: `prisma-next migrate --db URL --to <ref>` (e.g. `--to production`). Single dead-simple verb.
- **J6 — CI gating (read-only).** Set of checks:
  - Is the DB at the state the app bundle expects?
  - Are there pending migrations?
  - Is the migration graph internally consistent (hashes, ref integrity)?
- **J7 — CD execution.** Preview "what will run on merge" + execute against production. The preview is required to be **rock solid** — the CD's go/no-go signal.

### Domain operations to model (not yet pinned to commands)

- Mutating: applying / executing a migration; moving a ref.
- Interrogative: querying graph state, ref state, marker state, path resolution, graph integrity.
- Authoring: producing contracts and migration artifacts (and re-producing — emission is repeatable).

### Method: compressed DDD pass

Four phases:

1. **Domain Storytelling** — extract load-bearing nouns, verbs, events, queries from concrete narratives. *(In progress; catalog at [`domain.md`](./domain.md).)*
2. **Ubiquitous Language** — argue each term to a single, precise definition; consolidate synonyms; disambiguate homonyms.
3. **Aggregates / Entities / Value Objects / Events** — group terms into structural DDD shapes; pin consistency boundaries.
4. **Commands & Queries** — derive operations (mutating + interrogative) from the model. CLI naming falls out from this almost mechanically.

After the DDD pass: audit existing CLI commands against the resulting model (the ticket's stated goal). Switch `devrel` in for the audit.

## Corrections recorded

- **"Freeze" rejected.** Nobody talks about "freezing" a migration. Need a different verb for the author-time act of turning a contract change into a committed migration package.
- **Missing emission concepts.** Both contracts and migration artifacts are emitted; both have hashes. The first-cut catalog under-named this; expanded in [`domain.md`](./domain.md).
- **Missing data invariants.** First-cut catalog had no entry for the invariant primitive; ADRs 176 + 208 supplied the model.
- **Missing operations decomposition.** DDL vs data-transform, the three phases (precheck / execute / postcheck), idempotency classes — added. (The wrapper noun "three-phase envelope" was later retired; the three phase names remain first-class.)
- **Missing contract spaces and pinned mirrors.** ADR 212 added.
- **Git mapping corrected.** Earlier framing implied commit ≈ migration. Actually: commit (state) ≈ **contract**; commit hash ≈ **storageHash**; the closest Git analog for a *migration* is `git format-patch` (a packaged patch with explicit endpoints) — Git has no first-class equivalent. **The verb for producing a migration cannot borrow `commit` from Git.** Recorded as a mapping table in [`domain.md`](./domain.md).
- **`migration` (noun) vs `migrate` (verb) made load-bearing.** "Migration" only refers to the on-disk artifact; "migrate" only refers to the live act of advancing a database. This creates a visible offline/live axis in the CLI surface — a user must always be able to tell from the verb alone whether the command touches a real DB.
- **`migrate dev` rejected as an anti-pattern.** Environment-name-as-verb is forbidden. So are god-commands. Every retained verb must answer one question.
- **`migrate` is forward-only.** Walking the directed graph from marker to ref. Backward motion for dev iteration is `db reset --to <ref>` (separate, destructive, dev-only). Refusing the "smart `migrate` that rewinds" temptation explicitly.
- **Refs are defined by CD behavior.** A ref means "the state CD will `migrate --to` in this environment." Environment-named (`production`, `staging`) rather than Git-generic (`head`). The PR is the moment the promise (ref advancement) is staked.
- **`db update` is off-graph live reconciliation.** Not the dev-DB equivalent of `migrate`. It does not produce a migration, does not walk the graph, does not advance a ref. Conceptually closer to "rebuild from desired state."
- **`plan` + `new` confirmed as the two authoring entry points.** `migration plan` = diff contracts and fill ops; `migration new` = scaffold an empty package with `from`/`to` set, ops blank. Both offline.
- **`migration compile`** confirmed as the verb for `migration.ts` → `ops.json`.
- **Dev/deploy verb split rejected.** No `migrate dev`, no `migrate deploy`. The "safety semantics" Prisma current attaches to `migrate dev` (shadow replay, drift checks) belong to a separate explicit verification step (`db verify`, `migration preflight`). The migration verb itself doesn't care about environment.
- **`db reset` dropped.** Dev rewind is `db update --to <hash>` — off-graph reconciliation parameterized by target. Same verb covers steady-state ("match current contract") and rewind ("match this earlier contract on disk").
- **"Baseline" dropped from vocabulary.** A migration whose `from` is `∅` is just a regular migration. We don't need a separate noun.
- **`db init` and `db sign` are not the same.** `db init` bootstraps an empty database (or applies initial migrations); `db sign` verifies a live DB satisfies a contract and writes the contract hash into the marker. `db sign` performs *no structural changes* and refuses if the DB doesn't already match.
- **Verification was missing from the conventions analysis.** Two distinct verification questions exist: *"does the live DB satisfy the contract?"* (`db verify`, live, read-only) and *"would this migration actually do what it promises?"* (`migration preflight`, sandbox apply). Added.
- **State specs — Git-style.** Every "where in the graph" argument accepts a uniform grammar: hash or hash-prefix (8+ chars, bare hex — no `sha256:` prefix), ref name, exact migration directory name, `<dir-name>^` for the migration's from-contract, or filesystem path. Modeled on Git's revspec, simplified.
- **Migrations are identified by directory name or migration hash.** Directory name and hash are both first-class. Directory name follows `<UTC-timestamp>_<sanitized-slug>` by convention but is user-controlled. Ambiguity (hex-named directory colliding with a hash prefix) is an explicit error with candidate listing.
- **Two parallel reference grammars.** `<contract>` resolves to a storage hash (accepts hash, ref name, migration dir → to-contract, `<dir>^` → from-contract, filesystem path). `<migration>` resolves to a migration package (accepts migration hash or directory name). Command argument type determines which grammar applies.
- **`db sign` flag.** First tried `--at <contract>` (static-position vs `--to`-movement); later refined to `db sign [<contract>]` positional, with explicit form `db sign --contract <contract>`. The argument names the thing being signed; both `--at` and `--to` overclaim spatial meaning for what is really a write-the-marker operation. **See the "Closing Phase 2" section below for the final form.** Default with no arg: hash the current `contract.json`, verify, sign.
- **Read surface pinned.** `migration status [--to <ref>] [--from <state-spec>]` (path & pending; the load-bearing CI/CD question; live but offline-capable via `--from`), `migration log` (applied history from the ledger; live), `migration list` (flat enumeration; offline), `migration graph` (relational view; offline), `migration show <dir>` (single migration; offline).
- **Namespace is by subject, not by safety.** The earlier "offline = `migration`, live = `db`" rule was wrong. `migration status` and `migration log` are *live but live in the `migration` namespace* because the subject is migrations. The safety axis is now "mutating vs read-only" + "live vs offline" — four classes — and is carried by the verb's documentation, not by namespace alone.
- **Phase 2 — Ubiquitous Language pass for the four flagged clusters.**
  - *Cluster 1, `schema`:* always means the **live database's structural definition**. Never refers to authored artifacts. Exception: "Postgres schema" (always qualified) for the namespace concept. The contract *declares* what the schema must look like; the schema *is* what the database actually has.
  - *Cluster 2, migration nouns:* "Migration" is canonical user-facing. "Migration package" reserved for architectural prose where filesystem shape matters. "Migration artifact" retired. "Migration edge" is the graph-context term; never bare "edge".
  - *Cluster 3, marker vs ledger:* both first-class, both distinct. Marker = where you are (mutable, one row, framework-trusted). Ledger = how you got here (append-only, surfaced via `migration log`).
  - *Cluster 4, hashes:* unqualified "hash" = storage hash. "Migration hash" always qualified; users normally refer to migrations by directory name and only invoke the hash for unambiguous identity. **Profile hash is not user-facing and is flagged as a retirement candidate.**
- **Phase 2 — secondary clusters.**
  - *Cluster 5, `apply` → `execute`:* migrations are programs and are **executed**. Past participle in `migration log`: "executed". `apply` is retired from the user-facing surface; internal helpers (`apply-aggregate`, `MigrationApplied` event, etc.) get renamed opportunistically.
  - *Cluster 6, `plan`:* migration plan vs query plan — both kept in their domains; qualify only when crossing.
  - *Cluster 7, `operation` → `op` for migrations:* migration ops are **ops** (matches `ops.json`). "Operation" without qualification is reserved for runtime / query / registry contexts. Gives migration ops their own visual identity.
  - *Cluster 8, `state` reframed:* the migration graph is a **graph of contracts**, edges are migrations. **State** is reserved for the CS sense — the literal condition of a database at a point in time (schema + data + marker + ledger). "Current state" → "current contract". For migration-package lifecycle, use "status" / "phase" / "progress", never "state".
  - **Empty caution:** `∅` (the empty database state, introspection returns no objects) vs **null contract** (a hypothetical contract with no requirements) are different things. Don't conflate. `∅` is conventional starting point for baseline migrations (`from: null`).
  - **State spec → contract reference.** The umbrella for "ways of identifying a contract" is **contract reference**; a **ref** is a specific kind (named, persisted, file-backed) — pointer / memory-address analogy. CLI argument placeholder is `<contract>`.
- **Adoption UX concern (parked).** Bringing a non-empty existing database into the migration graph is not "migration from `∅`". It's *introspect → derive contract hash → match-or-create graph node → sign marker → optionally plan onward migration*. This path needs to be one or two steps for users, not five. Vocabulary is fine; the verbs and their compositions need to make it ergonomic. Revisit during the CLI audit.

## Open subthreads

*(All Phase-2 subthreads landed. See `domain.md` "Resolved (no longer open)" for the full list.)*

## Closing Phase 2 — final vocabulary decisions

- **`db sign [<contract>]`** with optional explicit form `db sign --contract <contract>`. Rejected `--at` (overspatializes a static claim) and `--to` (movement metaphor doesn't apply to signing). The argument names the thing being signed.
- **`ref set <name> <contract>`**, not `ref move`. Refs are stored values being written, not entities that traverse the graph; the spatial vocabulary stays with `migrate`. No default contract on `ref set` — too dangerous for production-class refs.
- **`head` ref dropped.** Used today only in extension-metadata pinned artifacts (`refs/head.json`). The emitted `contract.json` already plays that role; a separate `head` ref carried no information. The pinned-artifact filename is implementation cleanup (rename or remove), not vocabulary.
- **Three verification verbs, three distinct names.** Sharing `verify` across all three was rejected — preflight is *also* a verification, and migrations are *also* artifacts, so calling the integrity verb `migration verify` would make "which verification?" the question at every call site. The final split:

  | Verb | What it verifies | Touches live DB? |
  |---|---|---|
  | `db verify` | Live DB satisfies its contract | Yes (read-only) |
  | `migration check [<m>]` | Migration artifact / graph integrity | No |
  | `migration preflight <m>` | Migration's behavior on a sandbox | Sandbox only |

  `migration check` is borrowed from `cargo check` and Atlas's "pre-migration checks" — naturally scopes from a single artifact (`migration check <m>`) to a holistic graph sweep (`migration check` with no argument: every migration self-consistent, every edge's `from`/`to` lines up, no orphan nodes, no dangling refs). `migration preflight` is the aviation borrowing — industry-known shorthand for "the checks you run right before doing the thing for real" — with no migration-system collisions (no surveyed tool has a direct analog: Atlas bundles `--dev-url` into apply, Prisma current's shadow replay is implicit-only inside `migrate dev`, Liquibase's `update-sql` / `validate` are preview/structural, Sqitch's `verify` runs post-deploy).

- **`db init` and `prisma-next init` both kept.** Namespace disambiguates: `prisma-next init` is project scaffolding, `prisma-next db init` lays down DB structure. No rename needed.
- **`contract emit` vs `migration plan` + `migration compile` — asymmetric on purpose.** Contracts are one-step authoring (source → emit → artifact). Migrations are two-step: framework plans → user edits the emitted `migration.ts` → compile lowers it to `ops.json`. Calling both "emit" would conflate scaffolding with lowering. The verbs encode the structural difference.
- **"Three-phase envelope" retired as a coined noun.** The three phases — **precheck**, **execute**, **postcheck** — remain first-class vocabulary (in blog posts; the conceptual hook for migration ops). When referring to the wrapper, use descriptive prose. **"Operation class"** kept (also in blog posts). **"Routing" / "routing-visible"** stays internal-only — not user-facing CLI vocabulary.

## Phase 3 (audit) — late vocabulary trim

- **`show` verb.** Carried in from the current CLI without explicit deliberation in Phase 2. Reconsidered during the audit. **Kept:** `migration show <m>` (aggregates the multi-file migration package and resolves the reference) and `contract show <c>` (resolves the reference and renders the contract). Both do real work beyond `cat`. **Dropped:** `ref show <name>` — a ref is `{hash, invariants[]}`, small enough that `ref list` (filtered by name) covers the same ground. The asymmetry is intentional: aggregate / resolve-and-render verbs justify a dedicated `show`; flat dictionaries don't.
