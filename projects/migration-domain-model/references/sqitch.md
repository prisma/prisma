# Sqitch

> One-line description: a standalone, engine-agnostic database change management CLI that treats each **change** as a named unit with explicit **requires** / **conflicts** edges, a text **plan** as the source of truth for ordering and integrity, and separate **deploy**, **revert**, and **verify** scripts executed by the database’s native client.

## Mental model

Sqitch is **graph-shaped at authoring time and linear at execution time**: every **change** lists **dependencies** (`requires`, `conflicts`) so the tool can compute a valid application order even when VCS commits are not chronological; at runtime it still **applies** or **reverts** changes one after another along that resolved order. The **plan file** (usually `sqitch.plan`) is the canonical, append-friendly list of changes plus metadata; it is not “whatever order files appear on disk,” and team docs often treat it like a **union-merge** friendly log so parallel branches can append independently. Identity and integrity lean on **content-derived SHA-1 IDs** in a **Merkle-tree** pattern so renames do not replace identity the way monotonic integers would, and the marketing/docs framing explicitly contrasts this with typical **migration**-style numbering. Each change is **imperative** in the sense that authors write real scripts (commonly SQL) for three explicit roles: **deploy** (mutate toward the desired state), **revert** (undo that mutation), and **verify** (post-condition checks, optional per change but first-class in the workflow, including optional `--verify` during `deploy` / `rebase` / `checkout`). The database’s own **deployment state** lives in a **registry** (schema or separate DB object depending on engine) that records what is deployed, **script_hash** fingerprints of deploy bodies, tags, dependency satisfaction, and an append-only **event** log—**not** “infer state only from filenames.” **Targets** name connection endpoints (URIs, clients, per-target dirs); **projects** carry a stable name and optional URI for cross-project `project:change` references. **Rework** models a second instance of the same logical change name only after a **tag**, keeping earlier script artifacts immutable for databases that already applied them, while still letting pre-release deploy scripts be edited freely. Failure handling assumes each **deploy** is **atomic** at the DB level (so a failed deploy script is not automatically paired with a revert), whereas a failed **verify** triggers the paired **revert** script for that change when verification is enabled, modulated by `--mode` (`all`, `tag`, `change`).

## Vocabulary

### Nouns

- **Sqitch / sqitch**: the change-management application and its top-level driver command.
- **Project**: a named Sqitch workspace (`sqitch init <project>`), with optional `%uri=` in the plan for stronger global uniqueness and cross-project safety.
- **Plan / plan file / deployment plan**: ordered list of changes and dependencies defining executable deployment order; stored as a text file (default `sqitch.plan`) with header pragmas such as `%syntax-version`, `%project`, `%uri`.
- **Change**: named unit of database evolution; drives filenames under `deploy/`, `revert/`, and usually `verify/` for that name.
- **Tag**: label attached to a specific change in the plan, treated as a stable bookmark (often release-oriented); required between two instances of the same change name when **reworking**.
- **Dependency (`requires`)**: directed prerequisite—another change (possibly in another project) that must be satisfied before this change runs.
- **Conflict (`conflicts`)**: declared incompatibility edge—another change that must not co-exist in the satisfied dependency set for this change.
- **Deploy script**: forward migration body for a change, executed by the engine’s CLI client.
- **Revert script**: explicit undo body paired with a deploy script; revert walks **reverse application order**.
- **Verify script**: post-deploy check script; failures are treated as deployment failures when verification is enabled.
- **Target**: named database connection configuration (URI, client path, registry name, script directories, etc.).
- **Engine**: supported database family (`pg`, `mysql`, `sqlite`, …) determining client and registry layout conventions.
- **Registry**: database-resident object (e.g., PostgreSQL schema, SQLite/MySQL database) where Sqitch stores projects, deployed changes, tags, dependency rows, events, and registry schema versioning—created on first deploy.
- **State (deployment state)**: “where the database is” relative to the plan, summarized by the latest deployed change and whether undeployed plan entries remain.
- **Planner**: user identity recorded when a change or tag is added to the plan.
- **Committer**: user identity recorded when a change or tag is deployed/reverted/applied to the database.
- **Note / title line**: human-facing description text stored with a change or tag in the plan and echoed in tooling output formats.
- **Bundle**: distributable directory snapshot containing `sqitch.conf`, plan(s), and referenced scripts for packaging (tarball, RPM, etc.).
- **Top directory**: root holding the plan and standard `deploy/`, `revert/`, `verify/` trees (and reworked script trees when used).
- **Reworked scripts**: additional script files for a later instance of an existing change name, segregated into reworked directory layout so prior files stay addressable.
- **Template**: file under `deploy/`, `revert/`, `verify/` (or custom types) used by `sqitch add` / `sqitch rework` to generate initial script bodies.
- **Script hash**: SHA-1 of a deploy script body as recorded in the registry; used by `sqitch check` to detect drift between plan files on disk and what was deployed.
- **Change ID / tag ID**: opaque SHA-1 identifiers for change and tag objects; used in extended addressing syntax and `sqitch show`.
- **Event (registry sense)**: logged row for `deploy`, `revert`, `fail`, or `merge` with metadata snapshot (names, requires/conflicts arrays, tags, timestamps, actors).
- **Advisory lock**: engine-supported mutex around deploy/revert work to keep concurrent Sqitch processes from stepping on each other.
- **`sqitch.conf`**: merged INI-style configuration (local, user, system) influencing engines, targets, command defaults, pager, editor, and identity fields.
- **Syntax version pragma (`%syntax-version`)**: plan header declaring parser compatibility for forward evolution of the plan format.
- **Change name rules**: UTF-8 names with punctuation and reserved-character constraints; tag names additionally disallow `/` even when change names allow it (`sqitchchanges`).
- **Extended SHA-1 syntax**: umbrella term in docs for change/tag addressing forms combining names, tags, offsets, and hashes.
- **Foreign-project reference**: `otherproj:change` (or hash) dependency edge spanning Sqitch projects co-installed in dependency resolution.
- **Default plan vs multi-plan**: many commands accept explicit plan paths, engine names, or targets to choose among several plans kept in sync via `--all` flags on authoring commands.
- **Script extension**: configurable filename suffix for deploy/revert/verify files (default `.sql`).
- **Client / db client**: path to the vendor CLI (`psql`, `mysql`, etc.) used to execute scripts; configurable per engine or target.
- **Database URI / DB URI**: `db:engine:…` connection string family used throughout examples and target definitions.
- **`--set` variables**: key/value pairs forwarded into supported database clients as session variables during deploy/revert/verify, with layered precedence documented per command.
- **Deploy mode (`--mode`)**: policy for how much to roll back after deploy or verify failure (`all`, `tag`, `change`).
- **`--log-only`**: registry bookkeeping without executing SQL scripts—adoption and edge orchestration vocabulary.
- **`--modified`**: revert/rebase pivot keyed off deploy-script file changes rather than explicit change coordinates.
- **VCS client**: configured Git binary used by `checkout` to switch branches after computing a common plan ancestor.
- **Subject line**: formatting field name in `plan` / `log` printf-style templates (synonymized with title line in template docs).
- **Failure event**: persisted `fail` row in the registry event stream when deploy or verify does not complete successfully.
- **Release (distribution sense)**: user docs tie **tag** + **bundle** workflow to shipping immutable script sets.
- **Registry release row (`releases.version`)**: engine DDL tracks which **registry schema version** the tool installed—distinct from application release tags.

### Verbs

- **init**: scaffold `sqitch.conf`, initial plan pragmas, and core script directories for a new project.
- **add**: append a new change to the plan and generate deploy/revert/(verify) script stubs from templates, optionally recording `--requires` / `--conflicts`.
- **tag**: insert a tag object after a chosen change (or list existing tags).
- **rework**: clone script files for an existing change name into a new plan entry after a tag, enabling a new deploy/revert/verify cycle without editing already-shipped script text in place.
- **deploy**: walk from current DB state toward a requested plan point, executing deploy scripts in dependency-resolved order; optional per-change verify; configurable failure rollback behavior.
- **revert**: walk backward along applied history, executing revert scripts until a target change becomes the last deployed one (`sqitch revert` is “time travel,” not VCS-style revert).
- **verify**: run verify scripts (and structural checks) over a deployed range to ensure presence in plan, deployment ordering, and postconditions.
- **status**: summarize latest deployed change, tags, and any undeployed planned changes.
- **log**: read the append-only registry **events** view for deploy/revert/fail history with filtering and formats.
- **plan**: render planned changes from the plan file (with optional `--event` filters for `deploy` / `revert` presentation only), including dependency columns in verbose formats.
- **check**: compare on-disk deploy script hashes to registry expectations and fail on mismatches.
- **rebase**: convenience sequence of `revert` then `deploy` between chosen plan points; supports `--modified` to pivot on edited deploy scripts during iteration.
- **checkout**: coordinated `revert` → VCS branch switch → `deploy` to align a developer database with another branch’s plan fork.
- **bundle**: copy configuration, plans, and needed scripts into a destination directory, optionally slicing between plan coordinates.
- **upgrade**: migrate registry schema to the Sqitch release’s expected version.
- **show**: print canonicalizing text or script contents for a change, tag, or script artifact keyed by plan addressing syntax.
- **config**: read/write hierarchical `sqitch.conf` settings (local, user, system) like Git config.
- **help**: dispatch to command-specific help text.
- **engine add / alter / remove / rename / show**: lifecycle verbs for registering default script locations, registry names, engine targets, and clients per database family.
- **target add / alter / remove / rename / show**: lifecycle verbs for named deployment endpoints and their per-target directory/registry overrides.

### Events / lifecycle states

- **Planned (change/tag)**: appears in the plan file with metadata (timestamps, planner); not necessarily deployed anywhere yet.
- **Deployed**: change successfully applied to a target; registry `changes` row present; positive progress marker in CLI (`+ change .. ok` style messaging in tutorials).
- **Up-to-date**: last deployed change equals the plan tip the command considers in scope; no pending deploy steps.
- **Revert event**: recorded when a change is taken back along the reverse application path.
- **Fail event**: recorded when a deploy or verify step fails (visible in `sqitch log` filters alongside deploy/revert).
- **Merge event**: registry event type (in PostgreSQL DDL) for merged histories—distinct from VCS merge, but part of the event taxonomy.
- **Verified / verify warning**: per `sqitch verify`, missing verify scripts warn but do not fail; failed verify scripts fail the command; reworked changes only run verify for the newest instance.
- **Diverged scripts**: `sqitch check` failure mode when working-tree deploy bodies no longer match stored script hashes.
- **Log-only deploy/revert/checkout**: update registry as if scripts ran—used when adopting Sqitch against pre-existing databases or for special workflows.
- **Pending plan tail**: changes present in the plan file but not yet applied to the target—surfaced prominently by `status`.
- **Tagged deployment state**: union of a deployed change plus zero or more tag labels recorded both in plan text and registry `tags` rows when applied.
- **Iterative (pre-tag) editing**: docs emphasize deploy scripts may be freely edited until a release tag + bundle workflow locks expectations for shipped artifacts.
- **`revert.strict`**: configuration requiring an explicit revert endpoint instead of implicit “revert everything” defaults.
- **`checkout.strict` / `rebase.strict`**: companion switches documented on those commands to disable the automated multi-step flows until operators choose explicit choreography.

### Identities / addressing

- **How are changes identified? (Name? Hash? Both?)**  
  Human names are primary in the filesystem and plan (`widgets`, `users_table@beta1`), but each change object also has a **full 40-hex SHA-1 ID** derived from canonical plan text (`sqitch show change …` exposes the generating material). Extended syntax supports `@tag`, `name@tag`, `project:name`, full hashes, parent/child offsets via `^` and `~`, and symbolic `@HEAD` / `@ROOT` / `HEAD` / `ROOT` with command-specific nuances (e.g., `@HEAD` for `revert` refers to last **deployed** change; for other commands often the plan tip—documented in `sqitchchanges`). Tag-qualified forms disambiguate **which instance** of a reused change name is meant for history walks vs dependency declarations. Numeric-looking names are allowed even though the system does not rely on lexicographic ordering for correctness.

- **How are environments addressed? (Targets?)**  
  Named **targets** with database URIs (`db:engine:…`) or raw URIs passed positionally / via `--target`; optional per-command overrides for host, port, db name, user, client binary, and `--registry` schema/database name. Engines may define their own default target URI pattern (`db:$engine:`) when only a bare engine is configured.

- **How is the dependency graph expressed? (`requires`, `conflicts`, etc.)**  
  In the plan each change carries a bracketed dependency list; CLI authoring uses `--requires` / `--conflicts` on `add` and `rework`. Dependencies may reference **foreign projects** (`utilities:extract`). The engine registry persists satisfied dependency rows typed as `require` (resolved to a concrete `change_id`) vs `conflict` (stored as a logical prohibition; PostgreSQL DDL enforces `dependency_id` NULL for conflicts). The plan file itself is the portable declaration; the registry mirrors what was true at deploy time.

- **How does the database track which changes have been deployed? (The Sqitch registry tables.)**  
  On first deploy Sqitch creates engine-specific **registry** storage. User docs call these **registry tables** collectively. The bundled PostgreSQL schema (representative, versioned via `releases`) includes at least: **`projects`** (name + optional URI), **`changes`** (one row per currently deployed change instance with `change_id`, logical `change` name, `project`, planner/committer fields, timestamps, and `script_hash` of the deploy file), **`tags`** applied in the database, **`dependencies`** materializing requires/conflicts edges for deployed rows, and **`events`** holding the full chronological history (`deploy`, `revert`, `fail`, `merge`) including arrays of requires, conflicts, and associated tag names. Other engines map the same concepts onto a schema or separate database per their conventions.

## CLI command surface

### Create / scaffold

- **`sqitch init`**: create project skeleton (`sqitch.conf`, plan header, script directories).
- **`sqitch add`**: register a new change in the plan and stub scripts (`--requires`, `--conflicts`, templates, notes).
- **`sqitch add` options surface**: `--all` for every plan, `--plan-file` / engine / target disambiguators, `--template` / `--template-directory` / `--use`, `--with` / `--without` script kinds, `--set` template variables, `--edit` to spawn editor.
- **`sqitch rework`**: fork an existing change after a tag with new script copies and plan entry.
- **`sqitch rework` options surface**: mirrors much of `add` (`--requires`, `--conflicts`, `--all`, notes, editor, plan selectors).
- **`sqitch tag`**: stamp a tag object on a chosen change or enumerate tags.
- **`sqitch bundle`**: export config + plans + scripts into a distributable tree (`--from` / `--to` slicing supported, `--dest-dir`, `--all`, per-plan arguments).

### Deploy / run

- **`sqitch deploy`**: apply forward through the plan (`--to-change`, `--verify`, `--mode` failure handling, `--log-only`, advisory `--lock-timeout`).
- **`sqitch deploy --verify` / `deploy.verify`**: optional gate that runs each verify script immediately after its deploy script succeeds, using the same failure rollback policy as `--mode`.
- **`sqitch revert`**: apply revert scripts back toward a target change (`--to-change`, `--modified`, `--log-only`, interactive confirmation unless `-y`).
- **`sqitch verify`**: execute verify scripts and invariants over a deployed window (`--from-change`, `--to-change`).
- **`sqitch rebase`**: chained revert + redeploy between `--onto-change` and `--upto-change` (optional `--modified`).
- **`sqitch checkout`**: revert to common ancestor of plans across VCS branches, switch branch, redeploy (`--verify`, `--mode`, `--log-only` parity with deploy/revert).
- **`--set-deploy` / `--set-revert`**: on `checkout` and `rebase`, allow asymmetric client variables for the two legs of the combined operation.

### Inspect / explain

- **`sqitch status`**: show latest deployment, tags, pending plan tail (`--show-changes`, `--show-tags`).
- **`sqitch log`**: query registry events with filters (`--event deploy|revert|fail`, name/project/committer patterns, multiple output formats, `--abbrev` / `--oneline` shorthands).
- **`sqitch plan`**: render plan-file timeline with rich formats (event filters for `deploy` / `revert` presentation).
- **`sqitch show`**: dump change/tag canonical text or a specific script body.
- **`sqitch check`**: detect deploy-script drift vs registry hashes.
- **`sqitch help`**: command help dispatcher.
- **`sqitch --man` / `sqitch --help`**: print suite-wide introductory docs or compact command enumeration from the driver binary.

### Configuration / wiring

- **`sqitch config`**: read/write `sqitch.conf` keys with Git-like verbs (`--get`, `--get-all`, `--add`, `--replace-all`, `--unset`, `--list`, `--edit`, file scopes `--local` / `--user` / `--system` / `--file`).
- **`sqitch engine`**: `engine`, `engine add`, `engine alter`, `engine remove` (`rm`), `engine show`, optional `--verbose` listings.
- **`sqitch target`**: `target`, `target add`, `target alter`, `target remove` (`rm`), `target rename`, `target show`, optional `--verbose` listings.
- **`sqitch upgrade`**: bump registry schema to current tool expectations.

### Meta / driver

- **`sqitch`**: top-level options (`--chdir`, verbosity, pager, `--version`, `--help`, `--man`) and command router.

## Distinctive vocabulary choices

- **“Change” instead of “migration”**: emphasizes a named, graph-addressable object with lifecycle beyond a single forward file.
- **Three-phase scripts (`deploy` / `revert` / `verify`)**: makes rollback and post-condition testing explicit peers, not afterthoughts.
- **“Plan” as Merkle-backed contract**: ordering + integrity come from the plan’s hashed structure, decoupling naming from monotonic integers.
- **“Target” vs “database”**: configuration-level identity for where state lives, separate from project sources.
- **“Registry”**: first-class persistence layer for reality (`changes`, `events`, `script_hash`) rather than inferring state from repo files alone.
- **`requires` / `conflicts` as first-class edges**: conflicts are not merely ordering hints; they participate in the same declaration surface as requires.
- **`rework` + tag gate**: encodes immutability of shipped scripts while allowing repeated logical change names across releases.
- **`sqitch verify` vs ad-hoc tests**: verify scripts are contractually about **state after deploy**, not general data-dependent unit tests.
- **`planner` vs `committer`**: separates “authored into the plan” identity from “applied to a database” identity in both CLI formats and registry columns.
- **Git `union` merge driver (tutorial pattern)**: treats `sqitch.plan` as append-only so VCS merges preserve both sides’ new lines—vocabulary that only makes sense once you accept the plan-as-log model.

## What this system's vocabulary makes easy / hard

- **Easy**: expressing **non-linear authoring** (parallel branches, out-of-order commits) while still getting a **deterministic deploy order** via explicit dependencies; pairing every forward step with an explicit **revert** and an optional **state validation** script; **auditing** deployments through an append-only **event** log and content hashes.

- **Hard**: keeping the **mental model of symbolic change selectors** straight where `@HEAD` semantics flip between “last in plan” and “last deployed” depending on command; operating **multi-plan** projects without accidental skew (many commands expose `--all` / per-engine plan arguments); ensuring **verify** scripts actually fail loudly (docs warn that boolean `SELECT` results do not fail—exceptions / non-zero client exit matter).
