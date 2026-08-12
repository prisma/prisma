# ADR 068 — Error mapping to RuntimeError

> **Superseded by [ADR 239 — Errors are structural envelopes with dotted namespace codes](ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md).** The `E.NAMESPACE.SUBCODE` spelling is dropped for dotted `NAMESPACE.SUBCODE`. The mapping this ADR describes — vendor and driver failures normalized to stable codes, provenance preserved — survives and moves onto the new scheme, with source detail carried in the envelope's `cause` field.

## Decision

Introduce a deterministic translation layer that maps source-specific failures (database, driver, adapter, compile profile, lane) into the canonical `RuntimeError` envelope and stable codes defined in ADR 027. This mapping is target-aware but lane-neutral and must be reproducible across environments.

## Why

- Give users and agents stable, portable error semantics regardless of database or driver
- Enable policy engines, budgets, and CI to act on errors by code rather than by string matching
- Preserve useful vendor context without leaking sensitive details per ADR 024
- Make error handling testable via fixtures and golden results

## Scope

### Sources to normalize
- **DB vendor errors**: SQLSTATE for Postgres, error numbers for MySQL, SQLite result codes, etc
- **Driver/transport**: connection refused, TLS handshake failures, timeouts, cancellation
- **Adapter/runtime**: pool exhaustion, transaction misuse, capability negotiation failures
- **Compile profile**: unsupported feature under active capabilities, lowering constraints
- **Lane/build**: malformed Plan, missing annotations, invalid params detected before compile

### Outputs
- A fully-populated `RuntimeError` per ADR 027: `code`, `message`, `severity`, `retryable`, `planId`, `sqlFingerprint`, `coreHash`, `profileHash`, `details`

## Mapping model

### 1) Normalization pipeline

1. Capture the raw failure plus context: `{ source, vendor, plan, sql, params, adapterMeta, timings }`
2. Classify with ordered matchers: `db → driver → adapter → compileProfile → lane`
3. Map to a canonical code and populate envelope fields
4. Scrub sensitive artifacts per ADR 024 and attach vendor-safe details
5. Emit to hooks and sinks with stable structure

### 2) Priority and fallbacks

- First matching classifier wins
- If no classifier matches, use `E.RUNTIME.UNKNOWN`
- Attach `details.vendor` with sanitized vendor fields
- Provide `suggestedAction` when possible

### 3) Severity and retryability

- `severity` and `retryable` are derived from mapping tables with defaults
- **Examples**:
  - Unique violation → `severity: error`, `retryable: false`
  - Connection reset → `severity: error`, `retryable: true`
  - Statement timeout → `severity: error`, `retryable: maybe` (policy-controlled)

## Canonical codes referenced

Use codes from ADR 027, examples included here for clarity:
- `E.RUNTIME.CONNECTION`
- `E.RUNTIME.TIMEOUT`
- `E.RUNTIME.CANCELLED`
- `E.RUNTIME.PERMISSION`
- `E.RUNTIME.CONSTRAINT_UNIQUE`
- `E.RUNTIME.CONSTRAINT_FK`
- `E.RUNTIME.CONSTRAINT_CHECK`
- `E.RUNTIME.SYNTAX`
- `E.RUNTIME.RESOURCE_EXHAUSTED`
- `E.PLAN.UNSUPPORTED_FEATURE`
- `E.PLAN.VALIDATION`
- `E.MIGRATION.CONFLICT`
- `E.RUNTIME.UNKNOWN`

## Mapping tables (illustrative v1)

### Postgres SQLSTATE → RuntimeError.code

| SQLSTATE | Meaning | Code | Retryable | Notes |
|----------|---------|------|-----------|-------|
| 23505 | unique_violation | `E.RUNTIME.CONSTRAINT_UNIQUE` | false | include constraint name if available |
| 23503 | foreign_key_violation | `E.RUNTIME.CONSTRAINT_FK` | false | include constraint, table |
| 23514 | check_violation | `E.RUNTIME.CONSTRAINT_CHECK` | false | include constraint |
| 22P02 | invalid_text_representation | `E.RUNTIME.VALIDATION` | false | bad cast/codec mismatch |
| 42601 | syntax_error | `E.RUNTIME.SYNTAX` | false | usually from Raw SQL lane |
| 42501 | insufficient_privilege | `E.RUNTIME.PERMISSION` | false | adapter should include role |
| 57014 | query_canceled | `E.RUNTIME.CANCELLED` | maybe | user cancel vs statement timeout |
| 57000 | operator_intervention | `E.RUNTIME.CANCELLED` | maybe | admin kill |
| 53300 | too_many_connections | `E.RUNTIME.RESOURCE_EXHAUSTED` | true | pool/backoff hints |
| 55P03 | lock_not_available | `E.RUNTIME.RESOURCE_EXHAUSTED` | true | include lock info when safe |
| 40001 | serialization_failure | `E.RUNTIME.RETRY` | true | app may retry transaction |

### MySQL error numbers → RuntimeError.code

| Errno | Meaning | Code | Retryable |
|-------|---------|------|-----------|
| 1062 | ER_DUP_ENTRY | `E.RUNTIME.CONSTRAINT_UNIQUE` | false |
| 1216 | ER_NO_REFERENCED_ROW | `E.RUNTIME.CONSTRAINT_FK` | false |
| 1217 | ER_ROW_IS_REFERENCED | `E.RUNTIME.CONSTRAINT_FK` | false |
| 1142 | ER_TABLEACCESS_DENIED | `E.RUNTIME.PERMISSION` | false |
| 2006 | CR_SERVER_GONE_ERROR | `E.RUNTIME.CONNECTION` | true |
| 2013 | CR_SERVER_LOST | `E.RUNTIME.CONNECTION` | true |
| 1205 | ER_LOCK_WAIT_TIMEOUT | `E.RUNTIME.TIMEOUT` | maybe |

### Driver/transport examples
- `ECONNREFUSED`, `ETIMEDOUT` → `E.RUNTIME.CONNECTION`, `retryable: true`
- TLS failure → `E.RUNTIME.CONNECTION`, `retryable: false`, `details.vendor.tlsReason`

### Compile profile examples
- Lowering requires `sql.jsonAgg` but capability absent → `E.PLAN.UNSUPPORTED_FEATURE`, `suggestedAction`: enable jsonAgg or rewrite projection
- Placeholder style mismatch detected at compile time → `E.PLAN.VALIDATION`

### Adapter/runtime examples
- Pool exhausted beyond budget → `E.RUNTIME.RESOURCE_EXHAUSTED`, `retryable: true`, `details.policy`
- Cross-tenant contract pin violation → `E.PLAN.VALIDATION`, `severity: error`

## Envelope population rules

- **`message`**: human-friendly summary without vendor internals or PII
- **`code`**: from mapping table
- **`severity`**: error unless explicitly downgraded by policy
- **`retryable`**: boolean or "maybe" when policy can sway
- **`planId`, `sqlFingerprint`**: include when available
- **`coreHash`, `profileHash`**: include if the failure occurred after verification
- **`details`**:
  - `vendor`: sanitized fields such as sqlstate, errno, constraint, table
  - `capabilities`: only if relevant to the failure
  - `policy`: lint or budget that triggered
  - `origin`: `db | driver | adapter | compileProfile | lane`

## SPI for mappings

Compile profiles and adapters expose registries:

```typescript
interface ErrorMapper {
  matches(input: UnknownError): boolean
  map(input: UnknownError, ctx: ErrorContext): RuntimeError
  priority: number // lower first
}

registerDbMapper('pg', pgSqlStateMapper)
registerDriverMapper('pg', pgDriverMapper)
registerProfileMapper('sql/pg', pgLoweringMapper)
```

- Mappers must be pure and deterministic
- Priority ensures DB vendor classification happens before driver fallbacks
- Mappers must never access raw params content beyond redaction rules

## Testing obligations

- Fixture-driven tests for each adapter/profile with vendor-native error samples and expected `RuntimeError`
- Golden JSON for envelope stability across upgrades
- Diff tests to ensure message text changes do not affect code, retryable, or structured details

## Privacy and redaction

- Do not include full SQL or parameter values by default
- Include `sqlFingerprint` and structured hints only
- Redact identifiers in message unless they are public DDL names and policy allows
- Store vendor raw messages only in debug logs gated behind local dev flags

## Versioning & evolution

- New mappings may be added without breaking changes
- Remapping an existing vendor code to a different canonical code is a breaking change and must be documented in release notes
- Envelope fields are governed by ADR 027 upgrade policy

## Open questions

- Do we want a policy overlay to force `retryable: false` for certain orgs even when vendor semantics suggest retry?
- Should we standardize a machine-consumable `suggestedAction` catalog for agents?

## Consequences

### Positive
- Stable, analyzable errors across targets
- Cleaner CI with consistent outcomes
- Safer telemetry with structured, redacted details

### Negative
- Ongoing maintenance of mapping tables per target and version
- Some vendor nuance is flattened into common codes

## Mitigations

- Keep vendor specifics available under `details.vendor` in a controlled way
- Document any lossy mappings and offer `suggestedAction` with target-aware tips

## Implementation notes

- Start with Postgres and MySQL coverage for the most common SQLSTATE/errno families
- Ship mapping tables with compile profiles and adapters, not in the lane
- Provide a lightweight utility `normalizeError(e, ctx)` for use in runtime and hooks
- Ensure hooks get the normalized error, never raw vendor exceptions
