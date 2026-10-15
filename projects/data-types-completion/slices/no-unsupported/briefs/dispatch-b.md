# Dispatch b: `Bit`, `VarBit` and `Interval` constructors

Read `common-rules.md` first. Design: section 13.5.

## Build

1. Three new Postgres type constructors in `packages/3-targets/3-targets/postgres/src/core/type-constructors.ts`, next to their neighbours and written the same way: `Bit(length?)` with codec `pg/bit@1`, `VarBit(length?)` with codec `pg/varbit@1`, `Interval(precision?)` with codec `pg/interval@1`. Each maps its argument onto the data type parameter of the same name, carries `inferred: true` and has documentation in the form its neighbours use.
2. If a test checks that each data type has at most one constructor marked `inferred`, or that each marked constructor is the name infer writes, it covers the new ones. If assembly refuses two marked constructors for one data type, make sure none of the three collides.

## Tests

- Emit tests in the Postgres target or `contract-psl`, wherever the neighbours' constructors are tested: `Bit`, `Bit(8)`, `VarBit`, `VarBit(16)`, `Interval`, `Interval(3)`, each as a scalar and as a list, give the expected codec and `dataTypeParams`.
- A PGlite test that a planned migration creates each column and introspection reports the expected `format_type` text (`bit(8)`, `bit varying(16)`, `interval(3)`, and the bare forms). Report what Postgres returned for the bare `Bit` (Postgres makes it `bit(1)`).
