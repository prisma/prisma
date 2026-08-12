# ADR 043 — Advisory lock domain & key strategy

## Context

Multiple actors can operate on the same database: local migrate runners, CI preflight, background jobs, and PPg orchestration. We need a deterministic, cross-runner way to prevent concurrent schema changes and other exclusive operations without relying on vendor-specific implicit locks. PostgreSQL exposes advisory locks, some targets do not. We also support multi-tenant apps where certain operations must serialize per tenant rather than globally

## Decision

Define a standardized lock domain model and key derivation scheme that all runners use. On targets with advisory locks, we acquire them using the derived keys. On targets without native advisory locks, we use a portable lease lock table with the same keys and semantics

## Goals

- Avoid conflicting schema or ledger updates across processes and environments
- Make lock keys deterministic and collision-resistant across databases and tenants
- Provide a safe fallback when advisory locks are unavailable
- Offer predictable failure and backoff behavior with clear diagnostics

## Non-goals

- Implement deadlock detection beyond ordering rules
- Provide TTL-based auto-release for native advisory locks
- Cross-database distributed locking

## Lock domains

Lock domains describe what is being serialized. All runners must acquire domains in a fixed order when multiple are needed

1. **contract.marker**
   Protects reads/writes of the contract marker and migration ledger
2. **migrate.schema**
   Serializes schema-level migration application across the whole database
3. **migrate.tenant**
   Serializes tenant-scoped data tasks and tenant migrations
4. **backfill.job**
   Serializes long-running data backfills that should not overlap for the same subject
5. **promotion**
   Serializes PPg branch promotion or cutover actions

**Acquisition order**: contract.marker → migrate.schema → migrate.tenant → backfill.job → promotion
Runners must never acquire domains out of order

## Key derivation

We derive a 64-bit lock key from a canonical string

```
keyInput = `${namespace}:${domain}:${dbUuid}:${tenantId ?? '-' }:${subject ?? '-' }`
```

- **namespace** is fixed as prisma-next
- **domain** as listed above
- **dbUuid** comes from the contract marker per ADR 021
- On first install we generate a stable UUID and persist it with the marker so forks and restores do not collide by host:port
- **tenantId** is required for tenant-scoped operations, else omitted
- **subject** is optional extra disambiguation for backfills, e.g. table name or index name

We compute xxhash64(keyInput) and use either
- PostgreSQL single bigint advisory lock: `pg_try_advisory_lock(hash64 as bigint)`
- PostgreSQL two-int form by splitting the 64-bit hash into hi/lo 32-bit signed ints
- Other targets use the same hash as the primary key in the lease table

This ensures all runners derive identical keys without sharing configuration

## Cross-runner behavior

- Local, CI, and PPg runners derive identical keys for the same DB because dbUuid binds the lock to the specific database instance and survives rehosts and restores
- PPg preflight uses isolated shadow databases and does not contend with production locks
- PPg promotion operations target production and therefore acquire the same keys as client-side runners, preventing races

## Failure handling and backoff

- All lock acquisitions use non-blocking try first
- If unavailable, runners back off with exponential backoff + jitter and a bounded ceiling
- Default migrate backoff: start 100 ms, factor 1.7, jitter ±20%, max wait 30 s total
- Default promotion backoff: max wait 90 s total
- While waiting, runners query lock introspection where available
- PostgreSQL: join pg_locks to pg_stat_activity to include blocking PID and application name in diagnostics
- If the ceiling is reached, return a stable error code LOCK_UNAVAILABLE with domain, key, and suggested next steps

## Stale lock mitigation

- Native advisory locks are released on backend termination
- To detect apparent staleness without unsafe force-release, we emit a heartbeat in the migration ledger table while holding migrate.schema
- If a different process observes a heartbeat older than a configurable threshold, it fails fast with LOCK_STALE_SUSPECTED and logs details
- PPg exposes an operator action to clear stale sessions, never an automatic unlock

## Targets without advisory locks

Introduce a portable lease lock table

```sql
prisma_lock(
  lock_key    text primary key,
  owner_id    text not null,
  acquired_at timestamptz not null,
  lease_until timestamptz not null
)
```

- Acquire by `INSERT ... ON CONFLICT DO NOTHING` with `lease_until = now() + leaseDuration`
- Renew by `UPDATE ... WHERE owner_id = ? AND lease_until > now()`
- Steal only when `lease_until <= now()` and configured to allow takeover for the domain
- **Recommended defaults**
  - Lease duration 30 s, renew every 10 s
  - Takeover disabled for migrate.schema and promotion, enabled for backfill.job
  - Use owner_id as a random UUID per runner process to avoid collisions

## Transaction scope

### For PostgreSQL

- Use session-level advisory locks for long operations like migrations and backfills
- For short metadata actions tied to a single transaction, transaction-level locks are acceptable but runners must not mix scopes in the same flow
- For lease locks, wrap acquisition and renewal in their own transactions with SERIALIZABLE or REPEATABLE READ depending on the adapter

## Diagnostics

On lock acquisition failure, emit a structured error per ADR 027

- **code**: LOCK_UNAVAILABLE | LOCK_STALE_SUSPECTED | LOCK_TAKEOVER_DENIED
- **domain**, **key**, **dbUuid**, **tenantId?**, **subject?**
- **blocking**: adapter-specific metadata when available
- **retryAfterMs**: backoff suggestion

Runners should also log lock lifecycle events for observability

## Security considerations

- Keys contain no secrets and are derived from non-PII identifiers
- PPg never exposes raw pg_stat_activity details to unprivileged tenants; redact as needed per ADR 024
- Lease tables require least-privilege DML grants only

## Implementation guidance

- Provide a shared @prisma/locks utility that implements the derivation, acquisition, and backoff policy so all subsystems stay consistent
- Adapters must declare whether native advisory locks are supported; otherwise fall back to the lease lock table automatically
- Enforce acquisition order in code to prevent deadlocks across domains
- Expose configuration for backoff ceilings and lease durations but keep sensible defaults

## Testing

- Unit tests for key derivation determinism and stability across environments
- Integration tests that simulate contention between two runners
- Crash-recovery tests to ensure locks release after backend termination
- Lease lock takeover tests under clock skew within a bounded tolerance

## Alternatives considered

- **Using host:port:database as the DB identity**
  Rejected due to collisions across clones and restores
- **TTL-based native advisory locks**
  Not supported by PostgreSQL; unsafe to emulate
- **Single global lock for all operations**
  Over-serializes and reduces throughput for tenant-scoped or background work

## Consequences

### Positive

- Deterministic and portable locking across runners and PPg
- Clear ergonomics and diagnostics when contention happens
- Safe fallback for targets lacking native advisory locks

### Negative

- Additional heartbeat and lease machinery to maintain
- Careful configuration required to balance takeover and safety for lease locks

## Open questions

- Should we allow operator-initiated forced takeover for migrate.schema in PPg with audit logging
- Do we need domain-specific timeouts distinct from backoff ceilings for very large backfills
