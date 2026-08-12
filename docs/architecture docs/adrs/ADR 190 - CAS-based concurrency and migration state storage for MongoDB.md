# ADR 190 — CAS-based concurrency and migration state storage for MongoDB

## At a glance

A developer runs `migrate`. The runner executes the DDL commands (create indexes, drop indexes), and the database is now in a new state. Two questions arise:

1. **Where do we record the new state?** The next migration needs to know the database is now at contract version X, not the version before. Without a record, every subsequent `migrate` would re-run from scratch.

2. **What if two developers run `migrate` at the same time?** On Postgres, the runner acquires an advisory lock (`pg_advisory_lock`) to serialize access. MongoDB has no native advisory lock. If both runners read "database is at version A," both apply the same migration, and both try to record "database is now at version B" — or worse, they apply *different* migrations and the database ends up in an undefined state.

## Decision

We store migration state in a `_prisma_migrations` collection using two document types: a **marker** (which contract the database currently satisfies) and **ledger entries** (an audit trail of applied migrations). Concurrency is handled via compare-and-swap (CAS) on the marker document, using MongoDB's document-level atomicity.

```
_prisma_migrations
├── { _id: "marker", storageHash: "v2", profileHash: "p2", updatedAt: ... }
├── { type: "ledger", edgeId: "->v1", from: "", to: "v1", appliedAt: ... }
├── { type: "ledger", edgeId: "v1->v2", from: "v1", to: "v2", appliedAt: ... }
└── ...
```

### The marker

A singleton document (`_id: "marker"`) that records the storage hash and profile hash of the contract the database currently satisfies. This is the Mongo implementation of the marker described in [ADR 021 (Contract Marker Storage)](ADR%20021%20-%20Contract%20Marker%20Storage.md), mapping directly to the framework's `ContractMarkerRecord` interface.

The runner performs three operations on the marker:

- **Read**: `findOne({ _id: 'marker' })` — check whether a marker exists and what hash the database is at.
- **Initialize**: `insertOne({ _id: 'marker', storageHash, profileHash, ... })` — first migration on a fresh database.
- **Update (CAS)**: the concurrency primitive, explained below.

### Compare-and-swap

The CAS update is the key design element. It uses `findOneAndUpdate` with a filter that includes the expected current hash:

```ts
const result = await db.collection('_prisma_migrations').findOneAndUpdate(
  { _id: 'marker', storageHash: expectedFrom },
  {
    $set: {
      storageHash: destination.storageHash,
      profileHash: destination.profileHash,
      updatedAt: new Date(),
    },
  },
  { upsert: false },
);
return result !== null;
```

This works because MongoDB's `findOneAndUpdate` is atomic at the document level — the filter check and the update happen as a single operation. No other process can modify the document between the filter match and the write.

Here's the race scenario:

1. Runner A reads the marker: `storageHash = "v1"`
2. Runner B reads the marker: `storageHash = "v1"`
3. Runner A applies its migration, then calls `findOneAndUpdate({ storageHash: "v1" }, { $set: { storageHash: "v2" } })` — **succeeds** (hash was still "v1")
4. Runner B applies its migration, then calls `findOneAndUpdate({ storageHash: "v1" }, { $set: { storageHash: "v3" } })` — **fails** (hash is now "v2", filter doesn't match, returns `null`)

Runner B gets a clean `MARKER_ORIGIN_MISMATCH` error. No data corruption, no undefined state, no retry ambiguity.

### The ledger

Append-only documents recording each applied migration as an edge (from → to):

```ts
await db.collection('_prisma_migrations').insertOne({
  type: 'ledger',
  edgeId: `${fromHash}->${toHash}`,
  from: fromHash,
  to: toHash,
  appliedAt: new Date(),
});
```

The ledger is for audit and history — which migrations were applied, in what order, and when. It is not used for correctness decisions. The marker alone is authoritative for "where is the database now?"

### Single collection

Both the marker and ledger live in `_prisma_migrations`. The marker is identified by `_id: 'marker'`; ledger entries have auto-generated `_id` values plus `type: 'ledger'`.

One collection to create, one to query, one to reason about during setup and introspection. This mirrors the single-table pattern Postgres uses for its migration metadata.

## Alternatives considered

### Advisory lock simulation

We could simulate Postgres-style advisory locks with a lock document and a TTL:

```ts
await db.collection('_prisma_locks').insertOne({
  _id: 'migration',
  acquiredAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
});
```

This adds significant complexity: lock expiry, stale lock cleanup, retry loops with backoff, and a second collection to manage. All of this for a scenario — concurrent `migrate` — that is rare in practice and easily detected. CAS on the marker is simpler: one atomic operation, no TTL, no cleanup, no retry loop. The losing runner gets a clean error.

### Separate marker and ledger collections

We could split `_prisma_migrations` into `_prisma_marker` and `_prisma_ledger`. This doubles the setup (two collections to create, two to query, two to reason about) with no meaningful benefit. The marker is one document; the ledger is a modest number of append-only documents. They coexist without interference.

### Retry on CAS failure

We could automatically retry the migration when CAS fails, on the assumption that the other runner applied the same plan. We chose not to because:

- The plans may be different (two developers applying different migrations).
- Silent retry hides the fact that a race occurred, which is operationally important to know.
- Concurrent applies are rare enough that a clean error with a "retry manually" message is the right UX.
