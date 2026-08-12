# D5e brief — Fix mongo facade `defineContract` wrap; complete blocked mongo migrations

## Context

D5d R1 landed F4 + pgvector + postgis contract migrations, then **correctly halted** on the mongo-runtime test migration when `pnpm typecheck --filter integration-tests` failed at `test/integration/test/mongo-runtime/query-builder.test.ts:291` with `PlanRow<typeof plan>` resolving `_id`/`count` to `never`. Root cause is a wrap-signature bug in `packages/3-extensions/mongo/src/contract/define-contract.ts` — structurally identical to the postgres bug D1 R1 caught and D1 R2 fixed.

This is the **same root cause as F3** (D5b's open finding on discriminated-union + embedded-relation precision loss in `test/integration/test/mongo/fixtures/contract.ts`). One wrap fix resolves both F3 and F5; D5e closes both.

D5e is opus-medium tier because it involves cross-package type threading (mongo facade ↔ mongo authoring layer), a possible contravariance trap (D1 R1's lesson — `ModelLike` had to be exported as a covariant equivalent of the contravariant `ContractModelBuilder`), and a discriminated-union + embedded-relation regression test that has to actually exercise F3's specific symptom. This is NOT mechanical work.

## Read first

1. `projects/facade-import-surface-completion/spec.md` — slice scope (FR11 covers facade-specific `defineContract` wraps).
2. `projects/facade-import-surface-completion/slices/facade-completion/plan.md` § "Dispatch 5e" — Done-when checklist.
3. `projects/facade-import-surface-completion/reviews/code-review.md` — **F3** (description of the discriminated-union + embedded-relation symptom), **F5** (description of the inline-models symptom from D5d), and the `### D5d R1 — PARTIAL` round note (full context on what landed + what halted + why opus-medium).
4. **The proven postgres pattern (THIS IS YOUR REFERENCE):** `packages/3-extensions/postgres/src/contract/define-contract.ts` (L1–129). Mirror its structure: `Omit<ReturnType<typeof baseDefineContract<…, Models, …>>, …>` with `const` generics threaded through both overloads, `ModelLike` as the covariant constraint.
5. **The broken mongo wrap:** `packages/3-extensions/mongo/src/contract/define-contract.ts` (L1–99). Note the single `Definition extends MongoDefinitionInput` generic that collapses `Models` to defaults.
6. **D1 R1→R2 lesson** in code-review.md (search `### Lessons from D1 R1→R2`): the contravariance pitfall on `attributesFactory?`. Apply the same investigation to mongo's model builder.
7. The existing mongo wrap test: `packages/3-extensions/mongo/test/contract-builder/define-contract.test-d.ts` — you'll add positive + F3-regression assertions here.

## Scope

### Step 1 — investigate mongo's authoring layer for the contravariance trap

Before touching the wrap, read:
- `packages/2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts` (or equivalent — `git grep -l 'ContractDefinition' packages/2-mongo-family/2-authoring/`)
- Whatever interface mongo's `ContractDefinition` constrains `Models` to (probably a `ContractModelBuilder` or similar).

If that interface has a contravariant member (e.g. an optional `attributesFactory?: (...) => ...` parameter, or any function-typed property where the function takes the model type as input), you have the D1 R1 contravariance trap and must:
- Export a covariant `MongoModelLike` interface (mirror `ModelLike` in `packages/2-sql/2-authoring/contract-ts/src/contract-builder.ts`).
- Re-export it from `packages/2-mongo-family/2-authoring/contract-ts/src/exports/contract-builder.ts`.
- Use it as `ModelsConstraint` in the mongo facade wrap.

If mongo's model builder is purely covariant, you can skip the `MongoModelLike` export and constrain on the existing type directly. Document in your structured return which case applied.

### Step 2 — rewrite `packages/3-extensions/mongo/src/contract/define-contract.ts`

Mirror postgres's pattern. The shape should be:

```ts
type MongoFamilyPack = typeof mongoFamilyPack;
type MongoTargetPack = typeof mongoTargetPack;

type ModelsConstraint = Record<string, MongoModelLike>; // or whatever covariant constraint applies
type ValueObjectsConstraint = …; // check ContractDefinition for the corresponding constraint
type ExtensionPacksConstraint = Record<string, ExtensionPackRef<'mongo', string>> | undefined;
// etc — match every constraint the base mongo defineContract exposes as generic

type MongoResult<
  const Models extends ModelsConstraint,
  const ValueObjects extends ValueObjectsConstraint,
  const ExtensionPacks extends ExtensionPacksConstraint,
  /* etc */
> = Omit<
  ReturnType<typeof baseDefineContract<MongoFamilyPack, MongoTargetPack, Models, ValueObjects, ExtensionPacks, /* etc */>>,
  'target' | 'targetFamily'
> & {
  readonly target: MongoTargetPack['targetId'];
  readonly targetFamily: MongoFamilyPack['familyId'];
};

type MongoBaseScaffold<…> = Omit<
  ContractDefinition<MongoFamilyPack, MongoTargetPack, Record<never, never>, Record<never, never>, …>,
  'family' | 'target' | 'models' | 'valueObjects' // whichever fields the inline form provides
>;

type MongoDefinition<const Models, const ValueObjects, …> = MongoBaseScaffold<…> & {
  readonly models?: Models;
  readonly valueObjects?: ValueObjects;
};

export function defineContract<
  const Models extends ModelsConstraint = Record<never, never>,
  const ValueObjects extends ValueObjectsConstraint = Record<never, never>,
  /* etc */
>(
  definition: MongoDefinition<Models, ValueObjects, …>,
): MongoResult<Models, ValueObjects, …>;

export function defineContract<…>(
  scaffold: MongoScaffold<…>,
  factory: (helpers: MongoHelpers) => { readonly models?: Models; readonly valueObjects?: ValueObjects; … },
): MongoResult<Models, ValueObjects, …>;

// impl signature stays wide as in postgres
```

The **negative `family?: never; target?: never;`** pattern from the existing mongo wrap (used to make `@ts-expect-error` tests work) is good — keep it. Add it to `MongoBaseScaffold` (or wherever the inline form lives) so the existing negative type assertions in `define-contract.test-d.ts` keep passing.

The single `as unknown as MongoResult<…>` cast on the impl return is acceptable (postgres does it too); narrow it as much as you can.

### Step 3 — add type assertions to `packages/3-extensions/mongo/test/contract-builder/define-contract.test-d.ts`

Three new assertions:

**(a) Inline definition form preserves model inference:**

```ts
const inline = defineContract({
  models: {
    User: defineModel(/* … minimal mongo model … */),
    Post: defineModel(/* … */),
  },
});
expectTypeOf(inline.models.User).not.toBeNever();
expectTypeOf(inline.models.Post).not.toBeNever();
```

**(b) Factory form preserves model inference:**

```ts
const built = defineContract({}, (helpers) => ({
  models: {
    User: helpers.defineModel(/* … */),
    Post: helpers.defineModel(/* … */),
  },
}));
expectTypeOf(built.models.User).not.toBeNever();
expectTypeOf(built.models.Post).not.toBeNever();
```

**(c) F3 regression — discriminated-union model with embedded relation:**

The exact symptom F3 caught was `tasks[0].comments[0].createdAt` resolving to `never`. Construct the minimal discriminated-union + embedded-relation contract that reproduces that, then assert the field resolves to its concrete type:

```ts
const fixture = defineContract({
  models: {
    Task: defineModel({
      kind: 'discriminator-or-equivalent',
      variants: {
        Pending: { /* … */ comments: embeddedMany(/* a Comment model with createdAt: Date */) },
        Done: { /* … */ },
      },
    }),
  },
});

type TaskRow = ResultOf<typeof fixture, 'Task'>; // whatever the user-facing inference shape is
expectTypeOf<TaskRow['comments'][number]['createdAt']>().toEqualTypeOf<Date>(); // NOT never
```

You'll need to look at `test/integration/test/mongo/fixtures/contract.ts` to see the actual F3 symptom shape and construct a minimal version. If the minimal repro is non-trivial, heartbeat with `phase: regression-test-shape` + describe.

### Step 4 — migrate the two blocked mongo files

After steps 1–3 land and you've confirmed `pnpm test --filter @internal/mongo` passes (including the new type assertions):

- **`test/integration/test/mongo-runtime/query-builder.test.ts`** — drop verbose imports (`@internal/mongo-contract-ts/contract-builder`, `@internal/family-mongo/pack`, `@internal/target-mongo/pack`), switch to `@internal/mongo/contract-builder`, drop `family:` and `target:` from the `defineContract(...)` call, remove the workaround comment D5b left.
- **`test/integration/test/mongo/fixtures/contract.ts`** — same migration; remove F3-workaround comment.

Run `pnpm typecheck --filter integration-tests` to confirm both migrate cleanly. Run `pnpm test:integration test/mongo-runtime/query-builder.test.ts` and any mongo integration suite that consumes the fixture to confirm runtime green.

## "Done when"

Per plan § D5e. Critical items:

- F3 + F5 both closed in `code-review.md` (you don't need to edit code-review.md yourself — flag in your structured return and the orchestrator does it).
- `pnpm typecheck --filter @internal/mongo --filter @internal/mongo-contract-ts --filter integration-tests` all exit 0.
- `pnpm test --filter @internal/mongo` exit 0; the new positive type assertions (a)+(b) AND the F3 regression test (c) are in the diff.
- `pnpm test:integration test/mongo-runtime/query-builder.test.ts` exit 0.
- `pnpm test:integration` for whatever mongo integration suite exercises the F3 fixture (likely a `mongo/` subdirectory) exit 0.
- `pnpm lint:deps` exit 0.
- Grep gate: `rg "@internal/(family-mongo|target-mongo)/(pack|control)" test/integration/test/mongo/fixtures/contract.ts test/integration/test/mongo-runtime/query-builder.test.ts` exit 1 (zero hits).
- No skips, no broad `as unknown as Record<string, unknown>` casts in test bodies.

## How to work

1. **Heartbeat** to `wip/heartbeats/implementer.txt` every ~5 min, at commit boundaries, before/after long shell commands. Format: `ts`, `role: implementer`, `agent_id` (your own), `round=D5e R1`, `phase`, `last_progress`, `next_step`.

2. **Suggested commit shape:**
   - Commit 1 (if needed): export `MongoModelLike` from the mongo authoring layer (only if step 1 finds a contravariance trap).
   - Commit 2: rewrite `packages/3-extensions/mongo/src/contract/define-contract.ts` to thread explicit generics.
   - Commit 3: add positive (a)+(b) + F3 regression (c) type assertions to `define-contract.test-d.ts`.
   - Commit 4: migrate `test/integration/test/mongo-runtime/query-builder.test.ts` + `test/integration/test/mongo/fixtures/contract.ts`.
   - (You can fold commits 2+3 if they're tightly coupled; keep the test migration as its own commit so the F3 fixture's `-workaround comment + verbose imports` diff is self-contained.)

3. **NO SKIPS, NO BROAD `as unknown as Record<string, unknown>` CASTS.** Narrow type-specific casts in the wrap impl are fine (mirror postgres's pattern); broad object-shape escape hatches in test bodies are not. The single `as unknown as MongoResult<…>` cast on the impl return is the only legitimate "wide" cast.

4. **If you find a constraint that won't compile in the wrap and can't fix it by mirroring postgres** (e.g. mongo's authoring layer is structurally different in some way that prevents the same pattern), **HALT + heartbeat** with `phase: blocked-on-authoring-layer` + describe the structural difference. That's an orchestrator-level finding.

5. **Scope discipline:** D5e is purely the mongo wrap fix + 2 test migrations. Do NOT touch postgres or sqlite facades. Do NOT migrate any other contracts (none left). Do NOT touch the pgvector/postgis work from D5d.

## Begin

Write your first heartbeat with `phase: orienting`, then read this brief + the postgres reference wrap + the broken mongo wrap + the existing mongo test + F3/F5 in code-review.md + the mongo authoring layer for the contravariance check. Then execute step 1.

## Structured return at end

- Verdict (DONE / BLOCKED / NEEDS-FOLLOWUP).
- Per-step outcome: (1) contravariance check result — did you need `MongoModelLike` or not? (2) wrap rewrite — paste the new generics signature inline; (3) test assertions added — list each + paste the F3 regression test's discriminated-union shape; (4) migrations — git diff stats for the two files.
- Commit SHAs + one-liners.
- Gate exit codes for everything in "Done when".
- Anything noteworthy — especially any structural difference between mongo's authoring layer and sql's that affected the wrap shape.
