# Django Migrations

> One-line description: Django ships a **code-first, per-app migration framework** that turns ORM model edits into versioned Python migration modules, applies them through a **dependency graph** (not filenames), and records progress in a **database ledger** so each environment can converge on the same schema and data steps.

Sources: [Django topic guide — Migrations](https://docs.djangoproject.com/en/stable/topics/migrations/), [How to create database migrations](https://docs.djangoproject.com/en/stable/howto/writing-migrations/), [`django-admin` reference](https://docs.djangoproject.com/en/stable/ref/django-admin/) (stable, as of review).

## Mental model

Django treats migrations as a **version-control-like history for the database schema** (and optionally data): `makemigrations` **packages** detected model changes into new migration files (the docs compare this to commits), while `migrate` **reconciles** the live database with that history by walking the graph of pending steps.

Ordering is **graph-based**: each `Migration` class declares **`dependencies`** (and optionally **`run_before`**) on other migrations; **filenames and numeric prefixes are human hints**, and collisions on the same number across branches are expected to be resolved by editing dependency edges or using merge tooling—not by relying on lexicographic file order. The **unit of authored change** is a migration file exposing a `Migration` subclass whose ordered **`operations`** list is a **declarative** sequence of `Operation` objects; Django expands those into SQL via internal **projected model state** (it replays operations in memory to infer past states for autodetection and to render plans). **Cross-app foreign keys** become cross-app **dependencies**, so “migrate only this app” is a **best-effort** filter: dependent apps may still run first.

**Schema migrations** (model-driven) are the default output of autodetection; **data migrations** are ordinary migrations that emphasize `RunPython` / `RunSQL` instead of model diffs. **Squashing** introduces a parallel “compressed” history that can **coexist** with older files until every deployment has caught up, then maintainers delete superseded files, retarget dependents, and remove `replaces` to treat the squashed file as a normal migration. Backend capabilities matter at the edges: on backends that support DDL transactions (PostgreSQL, SQLite), migrations default to **one transaction per migration** unless `atomic = False`; on others (MySQL, Oracle), operations run without a wrapping DDL transaction, changing failure recovery semantics the docs call out explicitly.

## Vocabulary

### Nouns

- **Migration**: A discrete, named step in an app’s history, implemented as a Python module containing a `Migration` subclass (`django.db.migrations.Migration`).
- **Migration file / on-disk migration format**: The committed module under `<app>/migrations/` that Django imports to discover `dependencies`, `operations`, and optional flags (`initial`, `atomic`, `replaces`, etc.).
- **App label**: The string identifier for an installed Django application; paired with a migration **name** to address a node in the graph (e.g. `books.0003_auto`).
- **Operation**: A declarative instruction object in the migration’s `operations` list; the docs describe operations as the vocabulary Django turns into SQL (and/or imperative hooks).
- **`CreateModel` / `DeleteModel`**: Operations that add or remove an entire model’s table footprint in the migration state (and, for managed models, corresponding DDL).
- **`AddField` / `AlterField` / `RemoveField`**: Column-level lifecycle operations; the how-to guide leans on sequences like `AddField` → data backfill → `AlterField` when constraints cannot be satisfied in one step.
- **`RunPython`**: Imperative forward (and optional reverse) callables executed with a historical `apps` registry and a `schema_editor`; primary vehicle for **data migrations**.
- **`RunSQL`**: Forward and optional reverse raw SQL fragments; another imperative escape hatch alongside `RunPython`.
- **Schema migration**: A migration whose main job is evolving tables, columns, constraints, indexes, etc., usually produced by comparing current `models.py` to the last autodetected state.
- **Data migration**: A migration focused on transforming rows; typically authored manually and centered on `RunPython` (or SQL) rather than autodetector output.
- **Autodetector / migration autodetector**: The machinery that compares live models to the **last recorded migration state** and emits new migration files via `makemigrations`.
- **Projected / historical model state**: The in-memory model graph reconstructed by replaying migrations; used both to detect new edits and to supply **historical models** inside `RunPython`.
- **Historical models**: Frozen model shapes exposed through the migration `apps` registry (`apps.get_model`); distinct from importing current model classes, which the docs warn breaks reruns on fresh databases.
- **Migration plan**: The ordered set of migrations and operations `migrate` (or `showmigrations --plan`) will execute—subject to dependencies and current ledger contents; CLI output speaks of “Rendering model states” when computing transitions.
- **Dependency**: An explicit edge `(app_label, migration_name)` listed in `dependencies` meaning “this migration must run after those”.
- **`run_before`**: The inverse control surface—declare migrations in *other* apps that must execute **after** this one when `dependencies` on the peer file would be awkward (docs prefer `dependencies` when possible).
- **Initial migration**: The migration(s) that first materialize an app’s tables; marked with `initial = True` or inferred as the first in-app step with no same-app predecessors; interacts specially with `--fake-initial`.
- **Swappable dependency**: `swappable_dependency(...)` encodes a dependency on the first migration of the app hosting a **swappable** model (notably `AUTH_USER_MODEL`), so third-party migrations track customizable user models safely.
- **Squashed migration**: A replacement migration aggregating many prior operations, tagged with **`replaces`** so Django can choose **old linear segment vs squashed shortcut** depending on how far a database has progressed.
- **Optimizer (squash-time / `optimizemigration`)**: Pass that rewrites long `Operation` sequences (e.g., folding `AddField` into `CreateModel`, canceling `CreateModel`/`DeleteModel` pairs); `RunPython`/`RunSQL` block reduction unless marked **elidable**.
- **Elidable operation**: Flagging on custom operations telling the optimizer it may remove or merge them when squashing/optimizing.
- **SchemaEditor**: Backend abstraction performing DDL; surfaced to advanced authors inside `RunPython` for manual schema tweaks.
- **`SeparateDatabaseAndState`**: Operation split between **real database steps** and **state-only** operations so Django’s recorded schema diverges temporarily from physical DDL (advanced reshaping).
- **Database router / `allow_migrate`**: Hook controlling which DB alias may run which migrations; interacts with multi-db hints on `RunPython` and with **history consistency** checks in `makemigrations`.
- **Hints (`RunPython` / `RunSQL`)**: Keyword metadata forwarded to `allow_migrate` so routers can steer data work across aliases transparently.
- **Migration conflict / merge migration**: Situation where two new leaf migrations share an app without a dependency chain; `makemigrations --merge` is the dedicated resolution path.
- **`CircularDependencyError`**: Failure mode when squashing (or modeling) produces an unsatisfiable dependency cycle; docs steer authors toward breaking FKs into separate migrations or following `makemigrations`’ decomposition patterns.
- **Irreversible operation / `IrreversibleError`**: An operation lacking a safe backwards implementation; blocks rolling back past it.
- **`django_migrations` table**: Persistent per-database record of **which migration names have been applied**; `migrate --fake` manipulates this ledger without executing SQL; `migrate --prune` deletes rows whose migration modules no longer exist on disk (post-squash cleanup).
- **`MIGRATION_MODULES` setting**: Optional remapping of which Python package holds an app’s migrations.
- **Serialization / `deconstruct()`**: The process of writing model/field values into migration files; custom types register serializers or expose `deconstruct()` so `makemigrations` stays stable across runs.
- **`use_in_migrations` (managers)**: Opt-in marker serializing managers into migration state so historical models expose selected managers.
- **Non-atomic migration (`atomic = False`)**: Migration executed without a single outer DDL transaction; used for large data backfills or engines where long transactions are undesirable; sub-blocks may still use `transaction.atomic` or `RunPython(..., atomic=True)`.

### Verbs

- **`makemigrations`**: Detect model changes vs last migration state and **author** new migration file(s), optionally limited to specific apps (still pulling cross-app dependencies as needed).
- **`makemigrations --empty`**: **Scaffold** a migration with no autogenerated operations (starting point for data migrations or hand-authored DDL choreography).
- **`makemigrations --merge`**: **Produce** a merge migration that reconciles divergent leaf histories.
- **`makemigrations --update`**: **Fold** new model changes into the latest migration and re-optimize operations (destructive to the prior file’s contents).
- **`makemigrations --dry-run`**: **Preview** migrations that would be created without writing files.
- **`makemigrations --check`**: **Fail CI-style** when model changes lack corresponding migrations (implies dry-run semantics per admin docs).
- **`migrate`**: **Synchronize** database schema (and execute data operations) with migrations—either forward to head, forward for one app, or **down** to a named earlier migration / `zero`.
- **Apply / unapply**: Forward execution of pending operations vs backwards execution when targeting an older migration; unapplying may cascade to dependent apps.
- **`--fake`**: **Mark** migrations as applied (or unapplied, when moving backwards with fake) **without** running their SQL—direct ledger manipulation for advanced recovery scenarios.
- **`--fake-initial`**: **Short-circuit** initial migrations when the expected tables/columns already exist from pre-migration databases (table/column name checks only).
- **`squashmigrations`**: **Compress** an app’s contiguous migration chain into a new squashed file while leaving originals in place for incremental rollout.
- **`optimizemigration`**: **Rewrite** a single migration file’s `operations` list in place (or emit `_optimized` sibling) using the same optimizer logic used during squashing.
- **`sqlmigrate`**: **Render** SQL for a named migration (forwards by default), using a live connection to resolve backend-specific names.
- **`showmigrations`**: **List** migrations with applied markers, or print the global **plan** respecting dependencies.
- **Linearize / fix dependencies**: Manual graph editing when automatic merge suggestions are insufficient; required to restore **history consistency** if dependencies imply impossible ordering.
- **`migrate --prune`**: **Garbage-collect** `django_migrations` rows pointing at deleted modules after squashed migrations replace old files.
- **`migrate --check`**: **Exit non-zero** when unapplied migrations exist—useful for deploy gates without applying.
- **Serialize / register serializer / `deconstruct()`**: Author-time verbs describing how Python values become migration module literals safely round-tripped by the writer.

### Events / lifecycle states

- **Unapplied migration**: Present on disk and required by the graph but missing from the `django_migrations` ledger for the target database alias.
- **Applied migration**: Recorded as executed for a database; `showmigrations` marks it with `[X]` (verbosity ≥2 adds applied timestamps in list mode).
- **Inconsistent migration history**: A detected state where a migration is applied while some declared dependency is not—treated as an error condition blocking further `migrate`/`makemigrations` until dependencies are repaired.
- **Irreversible migration state transition**: Attempting to migrate backwards through operations without reverse paths surfaces `IrreversibleError`.
- **Squash coexistence phase**: Repository contains both superseded migrations and a squashed replacement until operators delete the old files, retarget dependents, and strip `replaces` to “finalize” the squashed migration as normal.
- **DDL transaction boundary (per migration)**: Default transactional envelope on capable backends; crossing into `atomic = False` changes failure atomicity for that file’s operations.
- **Autodetector prompt / linearization offer**: Interactive branch-merge scenario where Django may offer to **automatically linearize** two competing migrations or require manual dependency edits—an explicit “human in the loop” state in the authoring lifecycle.
- **Race window (data migrations)**: Documented period during staged `AddField` + `RunPython` patterns where concurrent creates can observe inconsistent UUID defaults—called out as a temporal hazard, not a separate command state but a lifecycle concern in docs.

### Identities / addressing

- **How are migrations identified?** Primarily by the tuple **`(app_label, migration_name)`** where `migration_name` matches the migration module’s stem (conventionally `0001_initial`, `0012_foo`, but only uniqueness—not the numeric prefix—matters logically). Squashed migrations add **`replaces`** listing the full set of superseded `(app, name)` pairs so Django can route databases at different points in history.

- **How are environments / branches addressed?** There is no separate “environment id” in the migration DSL: each **database** carries its own applied set via `django_migrations`. Branching is handled socially/mechanically by **VCS** plus Django’s **merge** tooling when two developers add independent leaf migrations; filenames may collide numerically but must not collide by **name**, and **`dependencies`** disambiguate ordering.

- **How does the database track which migrations have run?** For each database connection, Django maintains rows in **`django_migrations`** tying an **`app`** string to a migration **`name`**; `showmigrations` and `migrate --plan` consult this ledger alongside on-disk modules to compute remaining work. (The admin docs also note higher verbosity can display **applied datetimes**, documenting temporal metadata associated with recorded applications.)

- **What’s the role of the `django_migrations` table?** It is the **authoritative applied ledger** per database: normal `migrate` appends/removes rows as migrations apply or unapply; `--fake` and `--fake-initial` adjust it without executing operations; `--prune` aligns it with the current filesystem after file deletions; `flush` clears data tables but **does not** reset this history (per `flush` documentation cross-reference in the admin guide).

## CLI command surface

### Create / scaffold

- **`makemigrations`**: **Author** migrations from model diffs (optional app labels limit scope, not dependency closure).
- **`makemigrations --empty`**: **Emit** a blank migration skeleton for hand-written operations.
- **`makemigrations --merge`**: **Generate** a merge migration resolving parallel leaves.
- **`makemigrations --update`**: **Amend** the latest migration file to include new changes and re-optimize operations.
- **`makemigrations --dry-run` / `--check` / `--name` / `--scriptable`**: **Preview**, **CI-gate**, **rename**, or **machine-parse** generation outputs without changing behavior core to the domain model (supporting verbs around authoring).
- **`makemigrations --no-header`**: **Emit** migration files without the standard generated header comment block.

### Apply / synchronize

- **`migrate`**: **Synchronize** all apps to latest migration state (default invocation).
- **`migrate <app_label>`**: **Bring one app** forward to its head, still honoring cross-app dependencies.
- **`migrate <app_label> <migration_name>`**: **Converge** that app to a specific migration, **unapplying** later steps if needed (prefix matching allowed when unique; `zero` means full rollback for the app).
- **`migrate --database`**: **Target** a non-default DB alias.
- **`migrate --fake`**: **Record** migrations as applied/unapplied without SQL execution.
- **`migrate --fake-initial`**: **Fast-forward** initial migrations when legacy tables/columns already exist.
- **`migrate --run-syncdb`**: **Bypass** migrations for apps without them by creating tables via old sync semantics (escape hatch, discouraged).
- **`migrate --plan`**: **Preview** operations without executing.
- **`migrate --prune`**: **Reconcile** ledger rows with deleted migration modules.
- **`migrate --check`**: **Signal** unapplied migrations via exit status without applying.
- **`migrate --noinput`**: **Suppress** interactive prompts (e.g., stale content type removal) during synchronization.

### Inspect / explain

- **`showmigrations --list` (default)**: **Enumerate** apps and migrations with applied markers (and timestamps at higher verbosity).
- **`showmigrations --plan`**: **Display** the dependency-respecting application order, including dependencies for verbosity ≥2.
- **`showmigrations --database`**: **Inspect** a specific connection’s applied set.
- **`sqlmigrate`**: **Print** SQL for a specific `(app_label, migration_name)` (optionally `--backwards`).
- **`sqlmigrate --database`**: **Render** SQL against a chosen alias for name resolution.

### Rollback / reverse

- **`migrate <app> <earlier_migration>`**: **Reverse** migrations after the target for that app (and dependents as required).
- **`migrate <app> zero`**: **Unapply** every migration for the app.

### Squash / compress / maintain

- **`squashmigrations <app> [start] <end>`**: **Produce** squashed replacement migration(s) covering a range, optionally skipping earlier segments when mitigating non-elidable `RunPython`/`RunSQL`.
- **`squashmigrations --no-optimize` / `--squashed-name` / `--no-header`**: **Control** optimizer behavior and naming of squashed artifacts.
- **`squashmigrations --noinput`**: **Run** squashing without interactive confirmation prompts.
- **`optimizemigration <app> <migration>`**: **Shrink** operations inside a single existing migration module.
- **`optimizemigration --check`**: **Signal** when further optimization is possible without rewriting files.
- **`migrate --prune`**: **Clean** orphaned ledger references after deleting superseded files (paired conceptually with squash workflows).

## Distinctive vocabulary choices

- **`dependencies` + `run_before`**: Explicit **DAG edges** (and rare inverse edges) instead of relying on directory sort order or timestamps—this is the core organizing metaphor.
- **`--fake` vs `--fake-initial`**: Two different **“pretend applied”** modes—general ledger tampering versus the **initial-migration special case** that inspects existing tables/columns.
- **`replaces` + transitional squashing**: First-class notion that **two histories temporarily describe one product** until operators finalize the transition.
- **Historical models via `apps.get_model`**: Strong insistence that migrations reference **time-sliced model snapshots**, not live ORM classes—vocabulary that binds data migrations to graph position.
- **`Operation` as universal atom**: Schema DDL, imperative Python (`RunPython`), arbitrary SQL (`RunSQL`), and meta-operations (`SeparateDatabaseAndState`) share one ordered interpreter pipeline.
- **`swappable_dependency`**: Vocabulary for **configurable auth models** that avoids hardcoding `auth.User` edges in reusable apps.
- **`elidable`**: Marker allowing the **squash optimizer** to discard or merge helper operations—an explicit bridge between imperative migrations and declarative compression.
- **`zero` migration target**: Named sentinel for **complete app rollback**, not a separate command.
- **“Apps without migrations” vs migrated apps**: The docs draw a hard support line—relations from unmigrated apps to migrated apps are **unsupported**, encoding a binary vocabulary of participation in the framework.

## What this system's vocabulary makes easy / hard

- **Easy**: Expressing **ordered, cross-package schema evolution** where relational integrity forces partial orders; the `dependencies` graph and autodetector make “add FK → ensure referenced table exists” a normal sentence in the framework.
- **Hard**: **Safely compressing or reordering** histories that contain imperative `RunPython`/`RunSQL` (optimizer limitations, `CircularDependencyError`, irreversibility), and **recovering** from ledger drift on databases without transactional DDL—situations where the vocabulary pushes operators toward manual graph surgery, fake modes, or non-transactional migration splitting (`atomic = False`).
