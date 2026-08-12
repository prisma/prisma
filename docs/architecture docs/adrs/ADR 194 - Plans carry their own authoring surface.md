# ADR 194 — Plans carry their own authoring surface

## At a glance

A Mongo migration class already looks like a migration plan:

```ts
class AddPostsAuthorIndex extends Migration {
  override get operations() {
    return [createIndex('posts', [{ field: 'authorId', direction: 1 }])];
  }
  override describe() {
    return { from: 'v1', to: 'v2', labels: ['add-index'] };
  }
}
```

`operations` is the ordered list of things to execute. `describe()` gives the origin and destination contract hashes. That is structurally identical to `MigrationPlan` — the framework type the runner, the CLI, and `db update` all consume. The class _is_ a plan; we just hadn't wired the interface.

Meanwhile, when the planner produces a plan, the CLI needs to write it to disk as a `migration.ts` file the user can edit. The old design delegated that to a separate `MigrationScaffoldingCapability` SPI — a rendering function the target registered alongside its planner. That worked for Postgres's descriptor flow, but for Mongo the planner holds an internal IR (`OpFactoryCall[]`) that it doesn't want to surface through a generic capability interface. The plan itself is the natural place to ask "render yourself to TypeScript."

## Decision

Two coupled moves:

1. **`Migration` (the base class for class-flow migrations) implements `MigrationPlan`.** The abstract `plan()` method becomes `abstract get operations()`. `describe()` becomes abstract and non-optional. `origin` and `destination` are default-implemented getters derived from `describe()`. A class-flow migration file _is_ the plan — not something that produces one.

2. **`MigrationPlanWithAuthoringSurface extends MigrationPlan`** adds `renderTypeScript(): string`. Every planner result — from `plan(...)` and from the new `emptyMigration(context)` method — returns this richer type. The plan renders itself; no separate scaffolding SPI is needed.

`MigrationScaffoldingCapability` is deleted. `MigrationPlanner` gains `emptyMigration(context): MigrationPlanWithAuthoringSurface`, which `migration new` calls uniformly across targets.

### The interface split

```ts
interface MigrationPlan {
  readonly targetId: string;
  readonly origin?: { readonly storageHash: string; readonly profileHash?: string } | null;
  readonly destination: { readonly storageHash: string; readonly profileHash?: string };
  readonly operations: readonly MigrationPlanOperation[];
}

interface MigrationPlanWithAuthoringSurface extends MigrationPlan {
  renderTypeScript(): string;
}
```

`MigrationPlan` is the narrow shape. Consumers that only execute plans — `MigrationRunner`, `db update`, `db init` — depend on it and never touch `renderTypeScript()`. The authoring surface exists only on planner-produced results, where the CLI needs to materialize a `migration.ts`.

User-authored migrations satisfy `MigrationPlan` through the `Migration` base class. They are already the source file — they don't need to render themselves.

### `Migration` base class

```ts
abstract class Migration<TOperation extends MigrationPlanOperation = MigrationPlanOperation>
  implements MigrationPlan
{
  abstract readonly targetId: string;
  abstract get operations(): readonly TOperation[];
  abstract describe(): MigrationMeta;

  get origin(): { readonly storageHash: string } | null {
    const from = this.describe().from;
    return from === '' ? null : { storageHash: from };
  }

  get destination(): { readonly storageHash: string } {
    return { storageHash: this.describe().to };
  }
}
```

`describe()` is abstract because `MigrationPlan.destination` is non-optional — a migration that cannot describe itself cannot satisfy the interface. `Migration.run(...)` reads `instance.operations` and unconditionally writes both `ops.json` and `migration.json`.

### Planner-produced plans render themselves

Mongo's planner returns a `PlannerProducedMongoMigration` — a `Migration` subclass that also implements `MigrationPlanWithAuthoringSurface`. It holds the internal `OpFactoryCall[]` IR and uses it for both purposes: `get operations()` lowers the calls to runnable `MongoMigrationPlanOperation[]`, and `renderTypeScript()` renders them back to a TypeScript class the user can edit (see [ADR 195](ADR%20195%20-%20Planner%20IR%20with%20two%20renderers.md) for the rendering model).

```ts
class PlannerProducedMongoMigration
  extends Migration<AnyMongoMigrationOperation>
  implements MigrationPlanWithAuthoringSurface
{
  constructor(
    private readonly calls: readonly OpFactoryCall[],
    private readonly meta: MigrationMeta,
  ) { super(); }

  override get operations() { return renderOps(this.calls); }
  override describe() { return this.meta; }
  renderTypeScript() { return renderCallsToTypeScript(this.calls, this.meta); }
}
```

### `emptyMigration(context)` unifies `migration new`

`MigrationPlanner` gains:

```ts
emptyMigration(context: MigrationScaffoldContext): MigrationPlanWithAuthoringSurface;
```

Both targets implement it. The CLI calls `planner.emptyMigration(ctx)` uniformly — no strategy branching, no target-specific rendering in the CLI. For Mongo, the result is a `PlannerProducedMongoMigration` with empty ops. For Postgres, it's a plain object whose `renderTypeScript()` delegates to the existing (now Postgres-internal) scaffolding function.

### Postgres's throwing stub

Postgres's `plan(...)` returns a plan whose `renderTypeScript()` throws a structured error — a contained fiction. Descriptor-flow plans are never rendered back to TypeScript through this path (the CLI calls `renderDescriptorTypeScript(...)` on the capability instead). The stub exists so `MigrationPlannerSuccessResult.plan` has a uniform type at the framework level. It disappears when one authoring strategy is consolidated on (see [ADR 193](ADR%20193%20-%20Class-flow%20as%20the%20canonical%20migration%20authoring%20strategy.md)).

## Consequences

- The plan is self-describing _and_ self-rendering. No separate scaffolding SPI, no `switch(familyId)` in the CLI for rendering.
- `migration new` is strategy-agnostic: one code path for all targets.
- `migration plan --target mongo` works — the plan renders itself to a runnable `migration.ts` with `OpFactoryCall`-based operations (see [ADR 195](ADR%20195%20-%20Planner%20IR%20with%20two%20renderers.md)).
- The `ops.json`-is-the-contract principle ([ADR 192](ADR%20192%20-%20ops.json%20is%20the%20migration%20contract.md)) is preserved: `Migration` satisfies `MigrationPlan`, and `MigrationPlan.operations` is what gets serialized to `ops.json`.

## Alternatives considered

### Keep `MigrationScaffoldingCapability` as the rendering SPI

The scaffolding capability takes a plan and a context and returns TypeScript source. This works for descriptor-flow targets where the plan is a plain data structure the renderer inspects. For Mongo's class flow, the plan holds a richer internal IR (`OpFactoryCall[]`) that the capability interface would need to expose — either by widening the capability's type parameter or by downcasting inside the renderer. Putting `renderTypeScript()` on the plan avoids this: the plan closes over its own IR and renders itself without leaking internals through a generic interface.

### `Migration` wraps a `MigrationPlan` instead of implementing it

The base class could hold a `readonly plan: MigrationPlan` field and delegate to it. This adds indirection without benefit — every `Migration` would need to construct a plan object in its constructor from the same data it already has. Making `Migration` _be_ a `MigrationPlan` eliminates the wrapper and lets the runner, CLI, and `db update` consume a migration instance directly.

### Separate interfaces for planner plans and user-authored plans

Instead of `MigrationPlanWithAuthoringSurface extends MigrationPlan`, we could have had completely separate types: `PlannerPlan` (with `renderTypeScript`) and `AuthoredPlan` (without). The CLI would use `PlannerPlan`; the runner would use `AuthoredPlan`. This doubles the vocabulary for something that is fundamentally the same shape — both carry `targetId`, `origin`, `destination`, and `operations`. The extension-based split keeps one base type and adds the authoring surface only where needed.
