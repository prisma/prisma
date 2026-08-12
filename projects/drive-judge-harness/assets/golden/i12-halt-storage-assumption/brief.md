# Brief — add tag filtering on top of the existing array-column storage type

We want users to filter records by tag. The schema already stores tags, so this should be small.

**Approach (as specified):** Build the tag-filter query support directly on top of **the existing first-class `array` storage type** in the SQL contract — the one the contract already exposes for list-valued columns. Wire a `hasTag(column, value)` predicate that compiles to the array-containment operator for that storage type, add it to the query builder, and cover it with tests. Since the storage type already exists, no schema/contract changes should be needed — just the query-builder predicate and its compilation.

Deliver it as a single slice: the predicate, its compilation, and tests.
