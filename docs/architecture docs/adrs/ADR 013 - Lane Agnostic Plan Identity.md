# ADR 013 — Lane-agnostic Plan identity and hashing

## Context

Multiple query lanes exist (DSL, ORM, raw SQL, future TypedSQL). The runtime, CI, and PPg need a consistent way to identify a query Plan, detect meaningful changes, and de-duplicate telemetry. If identity depends on the authoring lane or incidental metadata, teams get noisy diffs and unstable dashboards. We need a lane-agnostic hashing and identity scheme focused on the executable surface.

## Decision

Define a lane-agnostic Plan identity and hashing method that relies only on executable content and contract binding:
- Ignore the authoring lane and volatile metadata when computing identity and change fingerprints
- Ship two derived hashes on every Plan:
  - `planId` for stable identity across runs of the same logical query
  - `sqlFingerprint` for change detection of the compiled SQL text

## What participates in identity

### Included in planId
- `meta.target` - engine affects compilation and behavior
- `meta.coreHash` - binds identity to a specific data contract
- Normalized SQL string - whitespace-collapsed, trailing semicolon removed
- Parameter shape, not values - number and order of parameters, plus best-effort type tags when available

### Included in sqlFingerprint
- Normalized SQL string only

### Excluded from both
- `meta.lane`
- `meta.createdAt`
- `meta.profileHash`
- `meta.annotations` and `meta.annotations.ext`
- `meta.refs` and `meta.projection`
- `meta.codecs`
- Any runtime timing, row counts, or plugin diagnostics

## Normalization rules

### SQL normalization
- Trim leading/trailing whitespace
- Remove a single trailing semicolon if present
- Collapse all internal runs of whitespace to a single space
- Do not rewrite quoting, identifiers, or case beyond what the compiler already emits deterministically

### Parameter shape
- If `meta.codecs.params` exists, derive a type tag per position (examples: int, text, bool, json)
- Otherwise use placeholders only - represent as an array of length `params.length` with ? markers
- Do not include actual runtime values

## Serialization
- Build a canonical string N = `target | coreHash | sqlNormalized | paramsShapeJson`
- Compute `planId = sha256(N)` as `<hex>`
- Compute `sqlFingerprint = sha256(sqlNormalized)` as `<hex>`

## Rationale
- `target` and `coreHash` ensure identity changes when the backend or contract changes, even if SQL text coincidentally matches
- Using parameter shape avoids churn across executions while still distinguishing `WHERE id = $1` from `WHERE id IN ($1, $2)`
- Excluding lane and annotations prevents identity churn when authors switch between DSL, ORM, raw, or when policies evolve
- Keeping `sqlFingerprint` separate allows CI and PPg to highlight SQL changes specifically

## Examples

### Lane swap, same SQL
- DSL → raw with identical compiled SQL and params
- `planId` unchanged
- `sqlFingerprint` unchanged

### Param value change at runtime
- `WHERE id = $1` with 1 vs 2
- `planId` unchanged
- `sqlFingerprint` unchanged

### Contract change
- Same query after adding a column in the contract (new coreHash)
- `planId` changes
- `sqlFingerprint` unchanged

### Whitespace and formatting change
- Compiler version collapses spaces differently
- `sqlNormalized` unchanged by our normalization
- `planId` and `sqlFingerprint` unchanged

### Predicate change
- Add `AND active = true`
- `sqlFingerprint` changes
- `planId` changes

## Consequences

### Positive
- Stable dashboards and de-duped telemetry across lanes
- Clean CI change detection focused on meaningful SQL diffs
- Easier golden testing and plan recording without lane noise

### Trade-offs
- Structural hints like refs and projection do not affect identity; policies should rely on Plan content, not identity, for enforcement
- Parameter types in shape are best-effort and depend on codecs when available

## Implementation notes
- Implement normalization in a small shared utility used by compiler and runtime
- Freeze `planId` and `sqlFingerprint` at Plan construction time
- Expose both hashes on `plan.meta` for observability and CI
- Add a debug field `identityInputs` behind a dev flag to aid troubleshooting

## Testing
- Golden tests to assert identical `planId` across lanes for the same SQL
- Tests proving param values do not change identity while param count/order do
- Cross-platform tests to ensure normalization is byte-stable
- Regression tests tying coreHash changes to planId changes

## Backwards compatibility
- Existing prototype Plans can adopt `planId` and `sqlFingerprint` without breaking consumers
- Older telemetry keyed on ad-hoc hashes should migrate to `planId`

## Open questions
- Whether to offer an optional stricter identity that also includes `meta.projection` for teams that treat projection changes as separate identities
- Whether to include adapter version in identity for long-term forensic reproducibility

## Decision record
Adopt lane-agnostic identity and hashing based on normalized SQL, parameter shape, target, and coreHash. Exclude volatile fields to prevent accidental churn when swapping lanes or changing annotations. Produce both `planId` and `sqlFingerprint` for complementary observability and CI needs.
