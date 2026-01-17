# Design Decisions and Open Questions

## Decisions Made

### 1. Null Handling

**Decision**: Null values are **never parameterized**.

**Rationale**:
- Null is semantically meaningful in filters (`{ email: null }` means "IS NULL" vs `{ email: 'value' }` means "= value")
- Null vs non-null produces different SQL and query plans
- Keeping null in the cache key ensures correct plan selection
- This matches the Codex design decision: "Nulls: keep structural (never parameterize)"

### 2. Union Type Merge Strategy

**Decision**: When variants disagree on parameterizability, **omit the field entirely** from the union node and emit a debug log during generation.

**Rationale**:
- Conservative approach ensures correctness with untyped placeholders
- Avoids runtime ambiguity about which scalar type to use
- Debug logging helps identify problematic unions for future optimization
- Follow-up task (typed placeholders) can re-enable parameterization for merged unions

### 3. Enum Handling

**Decision**: Use `runtimeDataModel.enums` for membership checks, only store enum **names** in ParamGraph.

**Rationale**:
- Avoids duplicating enum values in ParamGraph
- runtimeDataModel already contains all enum definitions
- Keeps ParamGraph size minimal
- String-based lookup is fast enough for typical enum sizes

### 4. Nested Selection Traversal

**Decision**: Use DMMF **output types** to build separate output nodes for selection traversal.

**Rationale**:
- Output types precisely describe which fields have arguments
- Avoids guessing relation types at runtime
- Enables proper handling of nested `arguments` in selections
- Output nodes are pruned to only include fields that lead to parameterizable args

### 5. List Validation

**Decision**: Validate **every element** before parameterizing a list-scalar field. If any element fails, preserve the entire list.

**Rationale**:
- Ensures all elements are valid for the declared scalar type
- Prevents cache key collisions from partial parameterization
- Lets the query compiler surface precise validation errors for invalid elements
- FieldRef or structural values in a list prevent the entire list from being parameterized

### 6. Feature Flag

**Decision**: **Always on** - no feature flag or opt-in mechanism.

**Rationale**:
- This is a correctness fix, not just an optimization
- It's backward compatible (produces correct cache keys)
- Legacy fallback is automatic when ParamGraph is missing
- Gradual rollout risk is mitigated by comprehensive testing

### 7. Shared vs Duplicated Code

**Decision**: Initially **duplicate** the ParamGraph builder in both generators, refactor later if needed.

**Rationale**:
- Simpler to implement initially
- Both generators may diverge in their exact code structure
- Can extract to shared package once the implementation stabilizes
- Code is small enough that duplication is manageable

---

## Open Questions

### 1. JSON Scalar vs Object Unions

**Question**: How should we handle fields that accept both JSON scalar and input objects in a union?

**Context**: Some edge cases might have fields where:
- One variant is `Json` scalar (parameterize whole object)
- Another variant is an input object type (recurse into child)

**Current assumption**: JSON fields do not appear in the same union as input objects in DMMF. If such a union exists, the runtime sees a plain object and must decide whether to parameterize or recurse.

**Proposed resolution**:
- If the edge has `Object` flag and `Json` in scalar mask, check if the child node has any edges for the object's keys
- If yes, recurse (it's an input object)
- If no, parameterize as JSON

**Status**: Needs verification with actual DMMF outputs. May not be an issue in practice.

---

### 2. User Enum Parameterizability in Engines

**Question**: Does the engines DMMF mark user enum fields as `isParameterizable: true`?

**Context**: We rely on `isParameterizable` being set correctly for all user enum fields, not just in filters but also in create/update data.

**Expected behavior**: User enum fields should have `isParameterizable: true` when the query compiler can accept a placeholder for that value.

**Status**: Needs verification by inspecting DMMF output from engines branch.

---

### 3. Legacy Fallback Scope

**Question**: Should the legacy parameterizer be kept permanently or deprecated after initial rollout?

**Options**:
- **A. Keep permanently**: Legacy implementation remains as fallback for all future versions
- **B. Deprecate after stabilization**: Remove legacy code after schema-aware implementation proves stable
- **C. Keep for backward compatibility only**: Legacy only used for clients generated without ParamGraph

**Current decision**: Option A for initial implementation. Revisit after real-world validation.

---

### 4. String Table Size

**Question**: For very large schemas, could the string table become a performance concern?

**Context**: String-to-index lookup uses a Map built at query time. For schemas with thousands of unique field names, this could add measurable overhead.

**Proposed mitigations**:
- Build the string index once at client initialization, cache it
- Most queries only access a subset of fields
- Consider frequency-based ordering (common fields first)

**Status**: Likely not an issue for typical schemas. Monitor in benchmarks.

---

### 5. Cache Key Compatibility

**Question**: Will the change in parameterization logic invalidate existing query plan caches?

**Context**: Schema-aware parameterization may produce different placeholder paths than the legacy heuristic for some edge cases. This could cause cache misses during transition.

**Analysis**:
- Placeholder paths follow the same format (`query.arguments.where.id.equals`)
- The difference is in **what** gets parameterized, not path format
- Cache misses only affect warm-up performance, not correctness
- Query plans are re-compiled as needed

**Conclusion**: Cache invalidation is expected and acceptable during rollout. Performance returns to normal after cache warm-up.

---

### 6. Debug Logging Verbosity

**Question**: How verbose should debug logging be during ParamGraph generation?

**Options**:
- **A. Silent**: No logs, only errors
- **B. Warnings only**: Log when union conflicts cause field omission
- **C. Verbose**: Log all union merges, pruning decisions, etc.

**Current decision**: Option B - log warnings for union conflicts to help diagnose cache key issues. Make it configurable via environment variable for debugging.

---

## Future Considerations

### Typed Placeholders

A follow-up task ([06-typed-placeholders-client.md](./06-typed-placeholders-client.md)) introduces typed placeholders that carry scalar type information. This enables:

- Re-enabling parameterization for union-merged scalar masks
- More precise validation at the query compiler level
- Potential cache key optimizations

### ParamGraph Compression

If ParamGraph size becomes a concern for very large schemas, consider:

- Run-length encoding for sparse nodes
- Delta encoding for string indices
- Binary format (MessagePack)
- External loading (fetch from CDN)

### Incremental Updates

For faster client regeneration, consider:

- Caching intermediate ParamGraph build results
- Only rebuilding affected portions when schema changes
- Sharing ParamGraph between similar operations
