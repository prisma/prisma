# ADR 037 — Transactional DDL fallback & compensation

## Context

- Some targets support fully transactional DDL, others do not or only partially
- Even on transactional targets, certain statements are excluded or require special modes
- The migration runner must keep the database in a recoverable state, surface residual risk, and provide a deterministic resume path when full rollback is impossible

## Decision

- Classify every operation by transactional semantics and partition each migration edge into commit groups with explicit boundaries
- When a non-transactional or partially transactional operation is present, attach a compensation plan and journal each step to a ledger
- Prefer forward recovery over rollback after a boundary failure, using re-discovery and re-planning from current state
- Surface a partial-apply risk score before execution and record outcomes in telemetry and the ledger

## Operation taxonomy

Each op in the JSON ops spec declares:

- **txSemantics**: `inTx | requiresTx | nonTx | longRunning`
- **compensation**: `reversible | forwardOnly | none`
- **pre and post checks**: assertions for idempotency and safe replay

### Examples

- **`createIndex` on Postgres**: `inTx` when normal, `nonTx` when `CONCURRENTLY`
- **`addColumn` nullable**: `inTx`, `reversible`
- **`renameTable` on some engines**: `nonTx`, `reversible`
- **`alterColumn` type**: engine dependent, often `nonTx`, `forwardOnly`

## Commit grouping and boundaries

Algorithm applied by the runner per edge:

1. Topologically sort ops by declared dependencies
2. Partition into groups:
   - Group contiguous `inTx` ops into a single transaction
   - Isolate `nonTx` and `longRunning` ops into their own boundary groups
   - Insert barriers around ops tagged `requiresTx` to ensure they run inside an exclusive transaction only
3. Execute groups in order with advisory lock held for the edge:
   - For transactional groups, wrap in a transaction or savepoint where supported
   - For non-transactional groups, ensure pre-checks pass, journal before and after, then run compensations on failure if defined

### Savepoints

- If the adapter declares `supportsSavepoints`, sub-groups within a transaction may use savepoints for finer-grained rollback

## Compensation strategy

### Principles

- Prefer compensating changes that restore invariants or enable forward re-plan, not perfect rollback
- Keep compensations simple, deterministic, and idempotent

### Examples

- **`createIndex` failure**: compensation `dropIndex if exists`, re-plan may recreate with different method
- **`renameTable` A→B failure halfway through subsequent ops**: compensation `renameTable B→A` if post-check confirms B exists and A is free
- **`addColumn` not null with default**: plan as staged sequence to avoid non-atomic behavior:
  1. add nullable
  2. backfill
  3. set default
  4. set not null

  Compensations are reversible for steps 1–3, forward-only for 4

### Irreversible ops

- When an op declares `compensation: none`, the runner requires `--allow-irreversible` in non-interactive modes and emits a high risk score

## Ledger and resume

### Ledger entries per step

- `edgeId`, `opId`, `groupId`, `ts`, `status` (`planned|started|succeeded|failed`)
- `preResult`, `postResult` snapshots for checks
- `error` payload if failed

### Resume rules

- On restart, the runner reads the ledger and re-evaluates post checks per op
- If post holds, mark as succeeded and continue
- If post fails but pre holds, re-run the op
- If neither holds, stop and require operator intervention or re-plan

## Risk surfacing

### Partial-apply risk score

Computed before execution from:
- count of `nonTx` ops
- presence of `forwardOnly` or `none` compensation
- adapter flags `supportsTransactionalDDL`, `supportsSavepoints`

### Levels

- **low**: no `nonTx` ops or all reversible within a transaction
- **medium**: `nonTx` reversible ops present
- **high**: `forwardOnly` or `none` compensation present

### User experience

- Print a one-line summary with risk level and notable ops
- In CI and PPg, block by policy when risk exceeds configured threshold unless overridden

## Error taxonomy

- **`runner/boundary-failed`**: failure inside a commit boundary
- **`runner/compensation-failed`**: compensation could not restore invariants
- **`runner/irreversible-op`**: irreversible op without explicit allowance
- **`runner/replan-required`**: residual drift requires re-planning

All errors include the current observed schema digest and hints to re-plan from observed to target contract.

## Adapter SPI additions

### Capabilities

- `supportsTransactionalDDL`: boolean
- `supportsSavepoints`: boolean
- `ddlExceptions`: list of statements that are never transactional on this target

### Helpers

- `beginTx`, `commitTx`, `rollbackTx`, `savepoint`, `rollbackTo`
- `advisoryLock(namespace, key)` with best-effort semantics

### Normalization

- Adapters map concrete DDL into op semantics for accurate `txSemantics` defaults when not specified by the planner

## Preflight and shadow

- For edges with high risk, preflight in a shadow database is required by default
- Preflight validates pre/post checks and exercises `nonTx` paths without production impact
- PPg can enforce this as a gate

## Configuration

### Runner flags

- `--allow-non-tx`: allow non-transactional boundaries in non-interactive runs
- `--allow-irreversible`: required when any op declares `compensation: none`
- `--fail-on-risk=medium|high`: set risk threshold
- `--shadow-url=...`: enable preflight on a shadow database

### Project policy

- Policy file sets organization defaults for risk thresholds and allowances
- CI can temporarily relax policies for approved migrations via signed overrides

## Telemetry

Emit on each boundary:
- `groupId`, `tx` (`true|false`), `risk`, `durationMs`, `result`
- For `nonTx`, include `compensation`: `attempted|skipped|succeeded|failed`

## Consequences

### Positive
- Predictable behavior across targets with and without transactional DDL
- Clear resume and recovery story with a durable ledger
- Transparent risk surfacing for humans and platforms

### Trade-offs
- More complex runner logic and larger surface area in adapters
- Compensation cannot guarantee perfect rollback on all engines and must rely on forward re-plan

## Alternatives considered

- **Hard-block non-transactional edges**: rejected for practicality, too many real-world engines require allowances
- **Always shadow-first then apply blindly**: still leaves production-only differences and does not address mid-run failures

## Open questions

- Standard compensation catalog across adapters vs per-adapter overrides
- PPg auto-safeguards for high-risk edges such as forced snapshots where available
- User-defined custom compensations registered alongside custom ops
