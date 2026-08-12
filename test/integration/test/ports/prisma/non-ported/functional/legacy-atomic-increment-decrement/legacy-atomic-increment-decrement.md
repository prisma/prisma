# Non-ported — legacy-atomic-increment-decrement

- `packages/client/tests/functional/0-legacy-ports/atomic-increment-decrement/tests.ts` › `atomic increment` — `update({ data: { credit: { increment: 1.5 }, age: { increment: 1 } } })` — the ORM `MutationUpdateInput` is `Partial<DefaultModelRow>` (plain scalar values); there are no arithmetic SET operators (`col = col + N`) in the ORM API or the SQL AST.
- `packages/client/tests/functional/0-legacy-ports/atomic-increment-decrement/tests.ts` › `atomic decrement` — decrement operator on `update()` — same gap: no arithmetic SET expressions in the ORM/SQL AST.
- `packages/client/tests/functional/0-legacy-ports/atomic-increment-decrement/tests.ts` › `atomic increment with negative value` — increment by a negative value on `update()` — same gap: no arithmetic SET expressions in the ORM/SQL AST.
- `packages/client/tests/functional/0-legacy-ports/atomic-increment-decrement/tests.ts` › `atomic decrement with negative` — decrement by a negative value on `update()` — same gap: no arithmetic SET expressions in the ORM/SQL AST.
