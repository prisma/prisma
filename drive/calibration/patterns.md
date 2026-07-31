# Patterns — shapes the team has learnt to recognise

Three families of accreted pattern live here:

- **Edge-case patterns (Example-Mapping)** — domain shapes worth considering at slice-spec time. The slice author walks this list to surface acceptance criteria the spec might otherwise miss.
- **Slice-composition patterns** — recurring decomposition shapes for projects. The project planner picks the closest match instead of decomposing from scratch.
- **Consumer audiences** — the two audience groups whose surface every user-observable change must consider. Manual-QA scripts name both unless the slice is explicitly single-audience.

Patterns accrete through retros and slice planning (per [`README.md § Maintenance discipline`](./README.md#maintenance-discipline)).

## Edge-case patterns (Example-Mapping)

Common edge cases prisma-next slices should consider during spec-shaping:

- **Empty inputs** (empty arrays, empty objects, empty strings) in operation arguments — codecs vs runtime behaviour.
- **Unicode / large strings** in identifiers, JSON columns, BSON keys.
- **Null vs undefined** distinction in TypeScript-vs-database mapping.
- **Migration ordering** when contract changes affect existing fixtures — regenerate-fixtures should be in the slice plan.
- **Capability gating** — if a feature requires a capability, gating-error tests are part of the slice-DoD.

_(Add patterns as the team accrues experience.)_

## Slice-composition patterns

Common shapes the team uses for project decomposition:

- **Sandwich pattern**: contract / IR layer first → emitter / consumer layer → adapter / target layer. Good for projects that introduce a new feature end-to-end.
- **Migration pattern**: feature flag / dual-write first → migrate consumers → remove old path. Almost always a project (multi-slice).
- **Refactor-with-call-site-migration**: refactor the source → migrate one consumer (the canary) → migrate the rest (parallel). The canary slice catches design issues before fan-out.

## Consumer audiences

Manual-QA scripts for slices that touch user-observable surface should name and exercise **both** consumer audiences (unless the slice's "What this script is testing" block explicitly says single-audience):

### Extension authors

The audience that authors `@internal/extension-*` packages and consumes the framework's authoring substrate, IR, and ADR-defined extension points.

- **Substrate location.** `packages/3-extensions/` (worked examples of real extensions) + the framework export surface in `packages/0-framework/` and `packages/1-sql/` / `packages/1-document/`.
- **Common probes.**
  - "Does the upgrade-skills coverage gate fire on a planted regression?"
  - "Does the ADR's new extension point work end-to-end for at least one example extension?"
  - "Do the extension's tests still pass after a framework substrate change?"

### End users

The audience that uses prisma-next via the demo or example apps.

- **Substrate location.** `examples/` (the demo + the example apps under `examples/*`).
- **Common probes.**
  - "Does `pnpm demo` still run cleanly?"
  - "Does the example app's `pnpm dev` produce the expected first-run output?"
  - "Does a deliberately-malformed schema produce the documented error envelope?"

Scripts that touch only one audience must say so explicitly in the "What this script is testing" block — that's a coverage statement, not a gap.
