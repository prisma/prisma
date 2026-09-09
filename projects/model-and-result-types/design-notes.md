# Model and result types — Design notes

## Principles

See `design-brief.md`. It is the agreed design and supersedes the earlier notes here.

## Decisions taken in the spec beyond the brief

- Separator `_`; `__unbound__` spelled `unbound` in member names; the variant union is `Any<Base>`.
- `RelationKeys`, `Scalars`, and `Shape` (which replaced `With`; see `shape-design-brief.md`) live in `framework-components` so one symbol serves both families, re-exported from each family's contract types entrypoint.
- `Scalars` is distributive so it works on the variant union.
- The ORM row derivations are not redefined in terms of the emitted types; equality is enforced by type tests. Redefinition would require threading the emitted map through `TypeMaps`, which the brief lists as unchanged.

## Open questions

Carried in the brief: `Scalars` versus `Row`, `With` as a name, renaming `ResultType` to `Result`, and the exact separator and `__unbound__` spelling. The spec picks defaults for all of them so implementation can proceed.
