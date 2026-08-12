# ADR 040 — Node task execution environment & sandboxing

## Context

Migration edges can attach node tasks for data moves, backfills, or one-off administrative steps that cannot be expressed as pure DDL. These tasks must run safely across environments, avoid uncontrolled side effects, and be observable. We need a clear execution model, sandbox, and declaration surface so the runner can enforce limits and policies consistently.

## Problem

- Arbitrary scripts risk privilege escalation, non-determinism, and accidental data exposure
- Task retries and partial application can corrupt state without idempotency guarantees
- Long-running backfills can starve resources or break CI without clear limits
- Lack of structured logs and results hinders auditability

## Decision

Introduce a sandboxed task runtime with a minimal API, declared capabilities, and enforced limits:
- Tasks are small modules conforming to a Task Manifest describing needs and guarantees
- The runner executes tasks in a least-privilege environment with strict resource caps
- Transactions, retries, and idempotency are opt-in and declared, not assumed
- All IO is mediated by the runner and logged with structured metadata
- Results are normalized and recorded in the migration ledger

## Task model

### Task manifest

Each task exports metadata and a handler:

```typescript
export interface TaskManifest {
  name: string
  version: string
  description?: string
  requiresTx?: boolean          // defaults to false
  idempotent?: boolean          // defaults to false
  timeoutMs?: number            // default 15m
  memoryMb?: number             // default 256
  cpuSeconds?: number           // soft cap, best-effort
  needs: {
    db: 'read' | 'write' | 'admin'  // runner maps to least-privilege role
    fs?: 'tmp' | 'none'             // tmp grants ephemeral scratch only
    net?: 'none' | 'ppg' | 'egress-allowlist' // default none
    secrets?: string[]              // named secrets the runner may inject
  }
  inputsSchema?: JsonSchema        // optional validation for params
  outputsSchema?: JsonSchema       // optional validation for result payload
}

export interface TaskHandler {
  run(ctx: TaskContext): Promise<TaskResult>
}
```

### Task context

```typescript
export interface TaskContext {
  contract: ContractSummary           // coreHash, profileHash
  db: DbHandle                        // limited API, not raw driver
  log: TaskLogger                     // structured events
  clock: () => Date                   // runner-provided clock
  tmpdir?: string                     // if fs: 'tmp'
  secrets: Record<string, string>     // only what was declared
  params: unknown                     // validated against inputsSchema if present
  budget: { remainingMs: number }     // updated by runner
}
```

### Result

```typescript
export interface TaskResult {
  ok: boolean
  summary?: string
  metrics?: Record<string, number>    // rowsProcessed, batches, etc
  outputs?: unknown                   // validated against outputsSchema if present
  warnings?: string[]
}
```

## Sandbox and privilege model

### Process isolation
- Tasks run in a separate process or lightweight container namespace depending on host capabilities

### Least privilege DB roles
- Runner provides a scoped `DbHandle` bound to the declared `needs.db` level:
  - **`read`**: SELECT only
  - **`write`**: DML only, no DDL
  - **`admin`**: DDL permitted, gated by policy and advisory lock
- **No raw driver by default**: `DbHandle` exposes only parameterized query methods and helpers for paging and batching

### Filesystem
- Default `fs: 'none'`
- If `fs: 'tmp'`, runner provides an empty ephemeral directory cleaned on exit

### Network
- Default `net: 'none'`
- `ppg` allows calls to PPg internal endpoints via runner proxy
- `egress-allowlist` permits explicit destinations configured by ops
- **No Network Egress**: Custom operations are prohibited from making network requests - enforced by sandbox
- **No WASM Engines**: WebAssembly modules are not allowed in custom operations

### Secrets
- Only secrets listed in `manifest.needs.secrets` may be mounted into `ctx.secrets`

## Resource limits

### Timeouts
- Per-task cap from `timeoutMs`
- Runner sends soft cancellation, then hard kill if overrun

### Memory
- Enforced resident set limit from `memoryMb`

### CPU
- Soft budget in `cpuSeconds` used for scheduling and alerts

### Batches
- Runner encourages cooperative progress via `DbHandle.iterateInBatches` with backpressure

## Transactions

- If `requiresTx: true`, the runner encloses `handler.run` in a single transaction when the adapter supports transactional DDL
- If the adapter lacks full transactional DDL, the runner follows ADR 037 for compensation steps and surfaces partial-apply risk in logs and ledger

## Idempotency and retries

- If `idempotent: true`, the task must tolerate replay without changing final state
- The runner classifies retryable errors vs terminal based on adapter and error taxonomy
- On retry, runner re-evaluates pre-checks, and logs a monotonic attempt count

## Logging and audit

- `ctx.log.event({ level, code, message, fields })` produces structured events linked to migration edge, task name, attempt
- Logs are written to the migration ledger and forwarded to telemetry respecting ADR 024 redaction rules
- The final `TaskResult` is stored with checksum and size limits to prevent PII leakage

## Pre and post checks

- Tasks leverage per-family pre/post checks declaratively ([ADR 028](ADR%20028%20-%20Migration%20Structure%20&%20Operations.md), [ADR 188](ADR%20188%20-%20MongoDB%20migration%20operation%20model.md))
- **Pre**: assert preconditions before any work
- **Post**: assert invariants after successful completion
- The runner blocks execution if pre-checks fail and marks the edge as not applicable

## Error handling

- Task exceptions are captured into a `RuntimeError` per ADR 027 with stable codes
- Policy maps specific codes to retry, skip, or block behavior
- Partial successes emit warnings and are treated as failures unless policy allows degradation

## Security

- No dynamic `require` from untrusted paths
- No uncontrolled env inheritance
- No shelling out unless explicitly enabled by policy and adapter profile
- Parameterized SQL only through `DbHandle`, which rejects unsafe concatenation

## Configurability

Organization and project policies can set:
- Maximum `timeoutMs`, `memoryMb`, `cpuSeconds`
- Default `needs` floors and disallowed capabilities
- Allowed egress domains and secret names
- Whether admin tasks are permitted outside PPg

## Alternatives considered

- **Allowing arbitrary scripts with a raw driver**: Rejected for safety and reproducibility
- **Forcing all tasks into a single global transaction**: Rejected due to adapter limitations and long-running backfills
- **Containerization as the only sandbox**: Kept optional to support minimal local and CI environments

## Consequences

### Positive
- Predictable, reviewable execution with strong guardrails
- Clear contracts for idempotency and transactional behavior
- Portable across environments and adapters

### Negative
- Slightly higher integration effort for complex backfills
- Strict limits may require tuning for large datasets

## Implementation notes

- Provide a Task SDK to generate manifests and validate params
- Implement a `DbHandle` with safe primitives and cursor helpers
- Add runner adapters for process and container sandboxes
- Extend the migration ledger to record task attempts, results, and logs

## References

- ADR 037 — Transactional DDL fallback & compensation
- ADR 038 — Operation idempotency classification & enforcement
- ADR 043 — Advisory lock domain & key strategy
- ADR 028 — Migration structure & operations
- ADR 188 — MongoDB migration operation model
- ADR 024 — Telemetry schema & privacy
- ADR 028 — Migration structure & operations
