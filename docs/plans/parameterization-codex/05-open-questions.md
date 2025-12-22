# Decisions and Open Questions

## Decisions

1. **Nulls**: keep structural (never parameterize).
2. **Union merge**: if variants disagree, omit the field entirely and emit a
   debug log during generation.
3. **Enums**: use `runtimeDataModel.enums` for membership checks.
4. **Nested selection traversal**: use DMMF output types.
5. **List validation**: validate each element before list-scalar parameterization.

## Open Questions

1. **JSON scalar vs object unions**
   - We assume JSON fields do not appear in the same union as input objects.
   - If such a union exists, we need a rule for object values (param vs recurse).

2. **User enum parameterizability in engines**
   - Verify that engines mark user enums `isParameterizable: true` for scalar
     fields (not just filters). If missing, it is a dependency.

3. **Legacy fallback scope**
   - Should we keep the legacy parameterizer for older clients only, or leave
     it as a permanent fallback when ParamGraph is missing?

