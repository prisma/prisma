# ADR 122 — Database Initialization & Adoption

## Context

Prisma Next must support adoption in a wide range of scenarios, from greenfield projects starting with an empty database to brownfield projects integrating with existing legacy schemas. Teams also need to incrementally expand their data contracts over time, adding new tables and features to existing systems without disrupting production.

The initialization process defines how a database first comes under Prisma Next management:
- Creating the initial data contract
- Initializing the database contract marker
- Establishing the baseline migration
- Managing multi-service deployments with independent contracts

## Decision

Prisma Next supports three adoption paths:

### 1. Greenfield Adoption

**Scenario:** Starting a new project with an empty database.

**Workflow:**
1. Write PSL or TypeScript schema definition for complete application domain model
2. Emit contract → H0
3. Create baseline migration: ∅ → H0 with all CREATE TABLE operations
4. Deploy application + baseline migration
5. Runner initializes marker with H0, applies baseline

**Characteristics:**
- No introspection needed
- Contract is source of truth from day one
- Fastest bootstrap path
- Clean audit trail

### 2. Brownfield-Conservative Adoption

**Scenario:** Existing project with established database schema; adopt Prisma Next for all existing tables.

**Workflow:**
1. Run introspection on existing database schema
2. Generate initial contract H0 from introspected schema
3. Create baseline migration: ∅ → H0
4. Write application code using DSL for H0 tables
5. Deploy application (no migration needed if DB already matches H0)
6. Initialize marker with H0 if not already present

**Characteristics:**
- Requires validation post-introspection (triggers, constraints, application-level invariants may be missing)
- One-time adoption cost
- Historical migrations discarded (not tracked in Prisma Next migration graph)
- Future migrations start from H0

**Safety Considerations:**
- Introspection is read-only and non-destructive
- Baseline can be created without applying it
- Marker initialization only happens when baseline would successfully apply
- Preflight validates readiness before production deployment

### 3. Brownfield-Incremental Adoption

**Scenario:** Existing project adopts Prisma Next gradually, starting with new features and expanding coverage over time.

**Workflow:**
1. Run introspection on existing database schema
2. Generate initial contract H0 (covers only existing tables)
3. Create baseline migration: ∅ → H0
4. Deploy application using H0 tables
5. When adding new features: update contract to H1 (includes new tables)
6. Create migration: H0 → H1 (CREATE TABLE for new tables)
7. Deploy application + migration
8. Repeat step 5-7 for each feature wave

**Characteristics:**
- Minimal disruption to existing systems
- Phased adoption reduces risk
- New code can be deployed while migration is in progress (see version skew semantics below)
- Maintains complete audit trail of contract evolution

## Initialization Operations

### Introspection

**Purpose:** Generate initial contract from existing database schema.

**Process:**
- Connect to database with read-only credentials
- Inspect schema (table definitions, columns, types, constraints)
- Optionally detect indexes, triggers, custom types, and database-side prerequisites surfaced by schema IR (e.g., Postgres extensions)
- Generate contract JSON representation

**Output:** Contract that can be used as H0

**Limitations:**
- May miss application-level invariants (e.g., "email must be unique within tenant")
- Cannot automatically infer policies or data classifications
- May not detect custom constraint logic implemented in triggers or stored procedures
- Database-side prerequisites required by components (e.g., enabling a Postgres extension) are not inferred from `contract.extensions`. They are modeled as component-owned database dependencies declared by configured components and verified via pure schema-IR hooks.

**Post-Introspection Validation:**
- Manual review of generated contract
- Annotation with policies, capabilities, custom constraints
- Testing against real application code to verify completeness

### Baseline Creation

**Purpose:** Create edge from empty (∅) to current contract state.

**Process:**
1. Take target contract (H0)
2. Generate edge metadata: { edgeId, from: ∅, to: H0, opsHash, createdAt }
3. Embed destination contract in migration package
4. Generate operations: CREATE TABLE for each table
5. Create migration.json with complete metadata

**Output:** Baseline migration package ready for application

### Marker Initialization

**Purpose:** Record in database that it is now under Prisma Next management.

**Process:**
1. After baseline validation and preflight
2. Write to `prisma_contract.marker` table:
   - `core_hash` ← H0's coreHash
   - `profile_hash` ← H0's profileHash
   - `version` ← 1
   - `updated_at` ← now()
3. Optionally initialize `prisma_contract.ledger` with first applied edge

**Safety:**
- Only happens after successful preflight validation
- Atomic write (single INSERT or UPDATE)
- Rollback: remove marker row (reverts to unmanaged state)

**Error Handling:**
- If marker already exists with different hash: indicates partial adoption (see ADR 123)
- If marker exists with same hash: idempotent (no-op)

## Adoption Strategies

### Cold Start (Single Deployment)

**When to use:** Greenfield or new environment.

**Process:**
1. Create contract + baseline in one step
2. Deploy application + migration together
3. Runner applies baseline, initializes marker, starts application
4. No downtime or phased rollout needed

**Trade-offs:**
- Simplest approach
- Fastest path to production
- No version skew or temporary inconsistency

### Warm Start (Application-First)

**When to use:** Brownfield where application code is already deployed.

**Process:**
1. Introspect existing database
2. Generate and validate contract H0
3. Deploy new application code (compatible with H0)
4. In background: initialize marker with H0
5. Application continues running against H0

**Trade-offs:**
- Application code deployed before marker initialization
- Risk if deployed code expects marker to exist (should handle gracefully)
- Useful for zero-downtime adoption

### Phased Adoption (Wave-Based)

**When to use:** Brownfield-incremental with many tables or complex schemas.

**Process:**
1. Wave 1: Adopt core tables (users, auth)
   - Introspect, generate H0 with core tables only
   - Deploy baseline, application uses H0
2. Wave 2: Adopt feature tables (posts, comments)
   - Update contract → H1 (includes new tables)
   - Create migration H0 → H1
   - Deploy migration, application uses H1
3. Wave N: Continue as needed

**Trade-offs:**
- Spreads adoption risk over time
- Allows gradual validation
- Maintains complete history of adoption
- Longer time to full Prisma Next coverage

## Incremental Contract Expansion

The most common brownfield scenario: gradually adding new capabilities to an existing contract.

### Scenario: Adding New Tables

**Starting state:**
- Contract H0 covers existing tables (users, orders)
- Database at H0
- Marker set to H0
- Application deployed for H0

**Goal:** Add new table (posts) to contract

**Process:**
1. Update PSL or TypeScript schema: add posts table definition
2. Emit new contract → H1 (includes users, orders, posts)
3. Planner diffs H0 → H1: identifies new table posts
4. Generator creates migration: "add posts table"
   - Edge: H0 → H1
   - Operation: CREATE TABLE posts (...)
   - Embedded contracts: H0 source, H1 destination
5. Preflight validates migration in shadow database
6. Deploy: application code + migration
7. Runner applies migration: updates marker to H1, continues application

**Query Semantics During Rollout:**

Applications deployed for H1 can safely run against H0 database temporarily:
- Queries against users/orders tables: work (present in both H0 and H1)
- Queries against posts table: fail with clear error "table 'posts' not found"
- Runtime verification catches mismatch before queries execute
- No version skew safety issues because schema has not changed, only contract expanded

**Key insight:** Version skew (app knows about tables DB doesn't have yet) is not a problem. The DSL raises clear errors when referencing unavailable tables. This is different from hidden schema changes, which would be a problem.

### Edge Case 1: Adopting Manually-Created Tables

**Problem:** Existing table in DB (posts) was added via manual SQL, now want to expose via contract.

**Solution: Idempotent Migration (Recommended)**

Follow ADR 038 (Operation Idempotency):
- Migration includes: CREATE TABLE IF NOT EXISTS posts (...)
- Precondition: none (idempotent operation)
- Postcondition: table posts exists with correct schema
- Result: Works whether table exists or not

**Workflow:**
1. Introspect database, detect posts table
2. Update contract to include posts definition
3. Create migration: H0 → H1 with CREATE TABLE IF NOT EXISTS posts
4. Preflight validates (operation is idempotent, so preconditions flexible)
5. Runner applies: marker updated to H1, application continues
6. If posts already exists: CREATE TABLE IF NOT EXISTS is no-op (success)
7. If posts doesn't exist: CREATE TABLE IF NOT EXISTS creates it (success)

**Trade-offs:**
- Less strict verification (doesn't verify that posts *should* already exist)
- Simpler workflow (no need to detect and reconcile existing state)
- Safe for incremental adoption because precondition is minimal

**Caveat:** Requires manual schema validation that existing table matches definition (columns, types, constraints).

### Edge Case 2: Multi-Stage Adoption

**Problem:** Want to add multiple tables incrementally (posts week 1, comments week 2, likes week 3).

**Option A: Regular Migrations (Recommended Default)**

```
Week 1: H0 → H1 (add posts)
Week 2: H1 → H2 (add comments)
Week 3: H2 → H3 (add likes)
```

**Benefits:**
- Clear migration history
- Each stage can be validated and rolled back independently
- Matches existing mental model
- Easy to correlate with business features/sprints

**Workflow:**
1. Each week: update contract, create migration
2. Run preflight for that week's migration
3. Deploy and apply
4. Proceed to next week

### Option B: Intermediate Baselines (Optional Optimization)

```
Week 1: Create migration H0 → H1 (add posts)
        Create baseline B1: ∅ → H1
Week 2: Create migration H1 → H2 (add comments)
        Create baseline B2: ∅ → H2
Week 3: Create migration H2 → H3 (add likes)
        Create baseline B3: ∅ → H3
```

**Benefits:**
- New environments joining mid-rollout can bootstrap to intermediate state
- Faster than replaying H0 → H1 → H2
- Useful if stages represent significant milestones

**Cost:**
- More artifacts to maintain
- More baselines to manage and validate
- Complexity increases

**Guidance:** Consider intermediate baselines if:
- Stage deployments span weeks and new environments come online
- Each stage is a stable, testable milestone
- Bootstrap speed is a constraint

For most teams, regular migrations suffice and intermediate baselines can be retroactively added via squashing (ADR 102).

### Option C: Bulk Update (Not Recommended)

Add all tables in one contract update: H0 → H3

**Drawbacks:**
- Loses incremental history
- Single large migration is riskier than staged smaller ones
- Harder to correlate with business milestones
- More difficult to debug if one table's migration fails

Avoid unless there is explicit reason.

## Multi-Service Namespacing

**Problem:** Multiple services in same database, each with independent schema/contract.

**Solution: Schema-Level Namespacing (Postgres) or Database Separation**

### Postgres Schema Namespacing

Each service gets dedicated schema:

```sql
CREATE SCHEMA service_a;
CREATE SCHEMA service_b;
```

Configuration per service (ADR 021):

```typescript
const db_a = connect({
  markerLocator: { schema: 'service_a' },  // marker in service_a.prisma_contract.marker
  connectionString: process.env.DATABASE_URL_A
});

const db_b = connect({
  markerLocator: { schema: 'service_b' },  // marker in service_b.prisma_contract.marker
  connectionString: process.env.DATABASE_URL_B
});
```

**Semantics:**
- Each service maintains independent contract, migrations, migration graph
- Marker location: service_a.prisma_contract.marker
- Ledger location: service_a.prisma_contract.ledger
- Each service treats its schema as complete database

**Permissions:**
- Service A cannot see service B schema by default (REVOKE)
- Explicit cross-schema queries possible but not recommended
- Permission model: each service has own application role

**Why not multi-contract support in single schema?**
- Multiple overlapping contracts in single schema too complex
- Version conflicts: service_a needs H1, service_b needs H2 (which wins?)
- Query verification ambiguity: which contract applies to a table?
- Marker conflicts: which contract hash should marker store?

Schema-level isolation is simpler, cleaner, and leverages database native features.

### MySQL/SQLite Database Separation

For databases without schema support, use separate databases:

```typescript
const db_a = connect({
  connectionString: 'mysql://user:pass@localhost:3306/service_a'
});

const db_b = connect({
  connectionString: 'mysql://user:pass@localhost:3306/service_b'
});
```

- Each database is independent
- Same marker/ledger isolation as schema approach
- Requires database provisioning infrastructure

## Safety Guarantees

### Non-Destructive Introspection

- Read-only connection only
- No schema modifications
- Safe to run repeatedly
- Can introspect production without risk

### Preflight Validation

- All initialization operations validated in shadow database before applied
- Baseline migration tested end-to-end
- Marker initialization only after successful preflight
- Ability to cancel before any changes committed

### Rollback Paths

**If marker initialization fails:**
- Remove marker row → database reverts to unmanaged state
- Can re-run initialization

**If baseline migration fails:**
- Rollback transaction (atomic per ADR 037)
- Database reverts to previous state
- Marker not written (only written after successful apply)

**If adoption abandoned:**
- No data loss (introspection and preflight are read-only)
- Database remains in previous state
- Can retry at any time

### Audit Trail

- All marker changes logged with timestamp
- All migrations recorded in database ledger (audit trail)
- Complete history available for compliance/debugging

## Cross-Environment Adoption

### Development

- Permissive: auto-initialize marker if missing
- Allow manual DDL with reconciliation prompts
- Introspect on first mismatch
- Fast feedback for experimentation

### Staging

- Strict: require marker, no auto-init
- Detailed diagnostics on drift
- Preflight required before any migration
- Production-like safety but easier debugging

### Production

- Very strict: refuse all execution on drift
- Log drift events for audit
- Require explicit remediation
- No auto-recovery
- All initialization pre-validated in staging

## Related Concepts

- **ADR 001** — Migrations as Edges (foundation for initialization model)
- **ADR 021** — Contract Marker Storage (marker initialization, multi-service locator)
- **ADR 029** — Shadow DB Preflight Semantics (preflight validation of baselines)
- **ADR 038** — Operation Idempotency (idempotent edge case 1 adoption)
- **ADR 123** — Drift Detection, Recovery & Reconciliation (initialization errors, marker inconsistencies)
