# ADR 189 — Structural index matching for MongoDB migrations

## At a glance

The migration planner is comparing two contracts and finds the same index described with different names:

```ts
const origin = new MongoSchemaIndex({
  keys: [{ field: 'email', direction: 1 }],
  unique: true,
});
// MongoDB would call this "email_1"

const destination = new MongoSchemaIndex({
  keys: [{ field: 'email', direction: 1 }],
  unique: true,
});
// The contract calls this "idx_users_email"
```

Are these the same index? If yes, the planner emits no operations — the database already has what's needed. If no, the planner drops one and creates the other, which on a large collection can take minutes and block writes during foreground index builds.

Getting this wrong in either direction is costly: unnecessary rebuilds waste time and risk downtime; missing a real structural change leaves the database out of sync with the contract.

## Decision

The planner matches indexes by structure, not by name. Two indexes are equivalent if and only if they have the same keys (fields, order, directions) and the same behavioral options (unique, sparse, TTL, partial filter expression). Name is not part of identity.

The mechanism is a **lookup key** — a canonical string computed from an index's structural properties:

```ts
function buildIndexLookupKey(index: MongoSchemaIndex): string {
  const keys = index.keys.map((k) => `${k.field}:${k.direction}`).join(',');
  const opts = [
    index.unique ? 'unique' : '',
    index.sparse ? 'sparse' : '',
    index.expireAfterSeconds != null ? `ttl:${index.expireAfterSeconds}` : '',
    index.partialFilterExpression ? `pfe:${canonicalize(index.partialFilterExpression)}` : '',
    index.wildcardProjection ? `wp:${canonicalize(index.wildcardProjection)}` : '',
    index.collation ? `col:${canonicalize(index.collation)}` : '',
    index.weights ? `wt:${canonicalize(index.weights)}` : '',
    index.default_language ? `dl:${index.default_language}` : '',
    index.language_override ? `lo:${index.language_override}` : '',
  ]
    .filter(Boolean)
    .join(';');
  return opts ? `${keys}|${opts}` : keys;
}
```

Object-valued options (`partialFilterExpression`, `wildcardProjection`, `collation`, `weights`) use `canonicalize()` — a key-order-independent serialization — so that `{ locale: 'en', strength: 2 }` and `{ strength: 2, locale: 'en' }` produce the same lookup key.

Two indexes that produce the same lookup key are the same index. For example:


| Index                           | Lookup key               |
| ------------------------------- | ------------------------ |
| `{ email: 1 }`, unique          | `email:1\|unique`        |
| `{ email: 1 }`, not unique      | `email:1`                |
| `{ lastName: 1, firstName: 1 }` | `lastName:1,firstName:1` |
| `{ createdAt: 1 }`, TTL 86400s  | `createdAt:1\|ttl:86400` |


The planner builds a `Map<string, MongoSchemaIndex>` for both origin and destination, then diffs the key sets:

- Key in destination but not in origin → `createIndex`
- Key in origin but not in destination → `dropIndex`
- Key in both → no-op

This gives O(1) per-index comparison and deterministic results.

### What the lookup key includes

Each component is included because it changes the index's behavior at the database level:

- **Key fields and order.** `{ a: 1, b: 1 }` and `{ b: 1, a: 1 }` are different compound indexes with different query optimization characteristics. MongoDB treats them as distinct.
- **Direction.** `{ a: 1 }` (ascending) and `{ a: -1 }` (descending) are different indexes. Direction matters for sort-order optimization in compound indexes.
- **`unique`**. A unique index enforces a constraint; a non-unique index does not.
- **`sparse`**. A sparse index omits documents missing the indexed field.
- **`expireAfterSeconds`**. A TTL index with a 24-hour expiry is different from one with a 7-day expiry.
- **`partialFilterExpression`**. A partial index scoped to `{ status: "active" }` is different from one scoped to `{ status: "archived" }`.
- **`wildcardProjection`**. A wildcard index on `{ name: 1, email: 1 }` differs from `{ name: 1 }`.
- **`collation`**. Per-index collation changes sort and comparison behavior.
- **`weights`**. Text index weights change relevance scoring.
- **`default_language`**. Changes how text indexes tokenize and stem words.
- **`language_override`**. Changes the per-document field used to determine language.

### What the lookup key excludes

**Name.** Index names are metadata, not behavior. An index named `email_1` and an index named `idx_users_email` with identical keys and options serve the same purpose — keeping both would be redundant. This follows [ADR 009 (Deterministic Naming Scheme)](ADR%20009%20-%20Deterministic%20Naming%20Scheme.md), which establishes that names are derived metadata, not identity.

One consequence: intentional name-only renames cannot be expressed through the planner. If a team wants to rename `email_1` to `idx_users_email` without changing structure, the planner sees a no-op. This requires a hand-authored migration. In practice this is rare — index names are almost never meaningful to application code — and the cost of getting structural matching wrong (unnecessary rebuilds on large collections) is far higher.

## Alternatives considered

### Name-based matching

Match indexes by name: same name = same index, different name = different index. This is simpler to implement but produces worse behavior:

- **Renames cause rebuilds.** Changing an index name would appear as a drop + create, potentially rebuilding a large index and blocking writes. Structural matching correctly treats this as a no-op.
- **Auto-generated names are fragile.** MongoDB's default naming convention (`field_direction`) can differ between driver versions or manual creation. Two identical indexes created in different ways could have different names, causing the planner to emit redundant operations.
- **Names aren't semantically meaningful.** Unlike table or column names in SQL, index names are rarely referenced in application code. They're an implementation detail of the database, not part of the application's contract with the data layer.

### Hybrid matching (name as tiebreaker)

Match by structure first, use name as a tiebreaker when structure is identical. This adds complexity without benefit — if two indexes have identical structure, they're functionally identical regardless of name. There's nothing to "break."