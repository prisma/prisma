# Typed Placeholders in Client (Follow-up, Not in Initial Implementation)

## Goal

Enable typed placeholders so union-merged scalar masks can be parameterized
without ambiguity. This is a follow-up task and **not part of the initial
implementation**.

## Proposed Placeholder Shape

```ts
{ $type: 'Param', value: { name: '<path>', type: '<ScalarType>' } }
```

`type` is the scalar name expected by the query compiler (e.g., `Int`,
`String`, `DateTime`, `Json`).

## Scope

- Update runtime parameterizer to emit typed placeholders.
- Update `JsonInputTaggedValue` to include `$type: 'Param'` with a typed value.
- Update ParamGraph *building logic* to allow union-merged scalar masks by
  recording the combined mask (no ParamGraph type changes).
- Maintain backward compatibility with untyped placeholders during migration.

## Implementation Notes

- ParamGraph keeps the scalar bitmask. When unions disagree, the builder should
  **merge masks** instead of omitting the field, so all scalar categories are
  preserved.
- The runtime chooses the concrete scalar type based on the actual value class
  and emits it in the placeholder.
- For enums, emit the enum name (aligned with QC expectations).
- Extend `JsonInputTaggedValue` with a new variant for Param:

  ```ts
  export type ParamTaggedValue = { $type: 'Param'; value: { name: string; type: string } }
  ```

## Dependencies

- Requires QC parser changes to validate placeholder types.
- See engine task: `docs/plans/parameterization/tasks/05-typed-placeholders-qc.md`
  in `prisma-engines`.

## Files

- `packages/client/src/runtime/core/engines/client/parameterization/traverse.ts`
- `packages/json-protocol/src/index.ts`
- `packages/client-generator-*/src/utils/buildParamGraph.ts`

## Acceptance Criteria

- Param placeholders carry type info for all parameterized values.
- Typed placeholders are used in cache keys.
- QC accepts typed placeholders and rejects mismatches.

