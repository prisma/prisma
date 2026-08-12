# ADR 151 - Control Plane Descriptors and Instances

**Status:** Implemented
**Date:** 2025-11-18
**Authors:** Prisma Next Team
**Domain:** Core, Families, Targets, Adapters, Drivers, Extensions

## Context

The current control-plane stack (SQL family, Postgres target, adapters, drivers, extensions, CLI) evolved through several refactors:

- Families, targets, adapters, drivers, and extensions are described in multiple places with overlapping but inconsistent types
- Control-plane entrypoints (`./control`) already export descriptor-like objects, but their shapes and naming differ across packages
- Some instance interfaces live in core (`FamilyInstance`, `ControlPlaneDriver`), others in family packages (`SqlControlAdapter`), and some are only implicit
- Type-level compatibility between family/target/adapter/driver/extension is only partially enforced and relies on ad-hoc string fields

As we add new targets (MySQL, MongoDB) and families (document), we need a clear, cross-family pattern for:

- Descriptor identity and compatibility
- Instance interfaces and lifecycle
- Control vs runtime plane entrypoints
- How packs fit into the overall model

This ADR defines a consistent descriptor/instance pattern for the **control plane** only. A follow-up ADR will mirror this for the **execution/runtime plane**.

## Decision

We standardize on a **descriptor + instance** pattern for all control-plane participants:

- **Descriptors** are flat data objects with identity and a factory method
- **Instances** are concrete objects implementing well-defined interfaces
- All descriptors and instances are parameterized by **family** and **target** IDs
- Descriptor and base instance interfaces live in **core** packages and are **cross-family**
- Families define **family-specific interfaces** that extend or refine the core base interfaces

We apply this pattern to:

- **Family**: ControlFamilyDescriptor / ControlFamilyInstance
- **Target**: ControlTargetDescriptor / ControlTargetInstance
- **Adapter**: ControlAdapterDescriptor / ControlAdapterInstance
- **Driver**: ControlDriverDescriptor / ControlDriverInstance
- **Extension**: ControlExtensionDescriptor / ControlExtensionInstance

This ADR does **not** change runtime behavior; it formalizes types, naming, and entrypoint structure so we can safely refactor existing packs and add new ones.

### Canonical IDs

We treat the following identifiers as canonical, literal types:

- **Family IDs**: e.g. `type SqlFamilyId = 'sql'`
- **Target IDs**: e.g. `type PostgresTargetId = 'postgres'`

These IDs are:

- The values used in `contract.targetFamily` and `contract.target`
- Exposed on descriptors as `familyId` and `targetId`
- Reflected in instance interfaces for type-level wiring

### Cross-family descriptor interfaces

We introduce plane-first, cross-family descriptor interfaces in core, under:

- `@internal/framework-components/control` for control-plane descriptors and base instances
- (`@internal/framework-components/execution` mirrors this for runtime — see ADR 152)

Descriptors:

```ts
export interface ControlFamilyDescriptor<
  TFamilyId extends string,
  TFamilyInstance extends ControlFamilyInstance<TFamilyId> = ControlFamilyInstance<TFamilyId>,
> extends ComponentDescriptor<'family'> {
  readonly familyId: TFamilyId;
  readonly hook: TargetFamilyHook;
  create<TTargetId extends string>(options: {
    readonly target: ControlTargetDescriptor<TFamilyId, TTargetId>;
    readonly adapter: ControlAdapterDescriptor<TFamilyId, TTargetId>;
    readonly driver: ControlDriverDescriptor<TFamilyId, TTargetId>;
    readonly extensions: readonly ControlExtensionDescriptor<TFamilyId, TTargetId>[];
  }): TFamilyInstance;
}

export interface ControlTargetDescriptor<
  TFamilyId extends string,
  TTargetId extends string,
  TTargetInstance extends ControlTargetInstance<TFamilyId, TTargetId> = ControlTargetInstance<
    TFamilyId,
    TTargetId
  >,
> extends ComponentDescriptor<'target'> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
  create(): TTargetInstance;
}

export interface ControlAdapterDescriptor<
  TFamilyId extends string,
  TTargetId extends string,
  TAdapterInstance extends ControlAdapterInstance<TFamilyId, TTargetId> = ControlAdapterInstance<
    TFamilyId,
    TTargetId
  >,
> extends ComponentDescriptor<'adapter'> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
  create(): TAdapterInstance;
}

export interface ControlDriverDescriptor<
  TFamilyId extends string,
  TTargetId extends string,
  TDriverInstance extends ControlDriverInstance<TTargetId> = ControlDriverInstance<TTargetId>,
> extends ComponentDescriptor<'driver'> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
  create(url: string): Promise<TDriverInstance>;
}

export interface ControlExtensionDescriptor<
  TFamilyId extends string,
  TTargetId extends string,
  TExtensionInstance extends ControlExtensionInstance<TFamilyId, TTargetId> = ControlExtensionInstance<
    TFamilyId,
    TTargetId
  >,
> extends ComponentDescriptor<'extension'> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
  create(): TExtensionInstance;
}
```

Note: All control-plane descriptors extend `ComponentDescriptor<Kind>` which provides:
- `kind`: Discriminator literal
- `id`: Unique identifier
- `version`: Component version (semver)
- `targets?`: Target compatibility metadata
- `capabilities?`: Capability declarations
- `types?`: Type import specifications for contract.d.ts
- `operations?`: Operation manifests for building registries

Notes:

- Descriptors are **open for extension** via declaration merging or family-specific subtypes; families may add extra fields
- Adapters, drivers, and extensions are **strictly single-target** (`targetId` is a single literal, not an array)
- `kind` is a plane-level discriminator: `'family' | 'target' | 'adapter' | 'driver' | 'extension'`

### Cross-family instance interfaces

We keep base instance interfaces in core to document the pattern and enable shared tooling. Families extend these base interfaces with richer, family-specific contracts.

Base instances:

```ts
export interface ControlFamilyInstance<TFamilyId extends string = string> {
  readonly familyId: TFamilyId;
  // Family-specific methods such as validateContract, verify, schemaVerify, introspect, emitContract, etc.
}

export interface ControlTargetInstance<
  TFamilyId extends string = string,
  TTargetId extends string = string,
> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
  // Plane-specific hooks may be added here in future ADRs
}

export interface ControlAdapterInstance<
  TFamilyId extends string = string,
  TTargetId extends string = string,
> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
  // Family-specific control adapter interfaces (e.g. SqlControlAdapter) extend this
}

export interface ControlDriverInstance<TTargetId extends string = string> {
  readonly targetId?: TTargetId;
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ readonly rows: Row[] }>;
  close(): Promise<void>;
}

export interface ControlExtensionInstance<
  TFamilyId extends string = string,
  TTargetId extends string = string,
> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
}
```

Family packages define richer interfaces like:

```ts
export interface SqlControlAdapter<TTarget extends string = string>
  extends ControlAdapterInstance<'sql', TTarget> {
  introspect(
    driver: ControlDriverInstance<TTarget>,
    contractIR?: unknown,
    schema?: string,
  ): Promise<SqlSchemaIR>;
}
```

### Entry points and exports

We standardize control-plane entrypoints and default exports:

- Each pack exposes a **control-plane entrypoint**:
  - Family: `@internal/family-sql/control`
  - Target: `@internal/targets-postgres/control`
  - Adapter: `@internal/targets-postgres-adapter/control`
  - Driver: `@internal/targets-postgres-driver/control`
  - Extensions: `@internal/extensions-*/control`
- Each control-plane entrypoint:
  - `export default` a flat descriptor object implementing the appropriate `Control*Descriptor` interface
  - May optionally export named types for family-specific interfaces (e.g. `SqlControlAdapter`)

Descriptors:

- Are **frozen const objects** that implement the descriptor interface
- Encapsulate a **stateless factory function** `create(...)`
- Never hold mutable state; lifecycle is a caller concern:
  - Each `create(...)` call is permitted to create a fresh instance
  - Callers decide whether to cache instances

Instances:

- Are created via descriptor factories
- Implement the appropriate family-specific interfaces
- May be classes or plain objects; class vs object is an implementation detail

### Type-level compatibility

We enforce **compile-time compatibility** across the control-plane wiring:

- Families, targets, adapters, drivers, extensions are parameterized by `TFamilyId` and `TTargetId` literal types
- `defineConfig` uses these generics so mis-wiring is a type error:
  - A Postgres adapter cannot be wired to a Mongo target
  - A SQL extension for `targetId = 'postgres'` cannot be used with a MySQL target
- `familyId` and `targetId` fields are both:
  - Runtime values (used for logging, validation, and metadata)
  - Type-level anchors for TS inference and narrowing

### Scope for first phase (control plane)

This ADR covers:

- Cross-family interfaces in core for the **control plane**
- Refactoring and naming alignment for the **SQL family + Postgres target**:
  - **Core:** `ControlFamilyDescriptor`, `ControlFamilyInstance`, `ControlDriverInstance` in `@internal/framework-components/control`
  - **SQL family:** `SqlControlAdapter`, SQL control family instance
  - **Postgres target pack:** Postgres control adapter descriptor and instance
  - **Postgres driver pack:** Postgres control driver descriptor and instance

Non-goals for this ADR:

- Document family and MongoDB target
- MySQL or other SQL targets
- Execution/runtime plane descriptors and instances (handled in a follow-up ADR)

## Consequences

### Benefits

- **Consistency**: All control-plane participants follow the same descriptor + instance pattern
- **Type safety**: Mis-wiring family/target/adapter/driver/extension becomes a compile-time error
- **Clear separation**: Descriptors are pure data + factory; instances own state and behavior
- **Cross-family reuse**: Shared tooling (CLI, test harnesses) can rely on a small set of core interfaces
- **Future-proofing**: Adding new targets/families is a matter of implementing descriptors and instances, not inventing new shapes

### Risks and mitigations

- **Refactor surface area**: Touching core and multiple packs risks breakage
  - Mitigation: First phase is limited to control plane and the SQL + Postgres stack
  - Tests that exercise `prisma-next.config.ts`, adapters, and drivers provide guardrails
- **Runtime vs control drift**: Control and runtime planes might diverge over time
  - Mitigation: A follow-up ADR defines a mirrored pattern for the execution plane

### Migration plan (control plane) - COMPLETED

1. ✅ Introduced the new `Control*Descriptor` and `Control*Instance` interfaces in `@internal/framework-components/control`
2. ✅ Removed legacy types completely:
   - `DriverDescriptor` → removed (use `ControlDriverDescriptor`)
   - `FamilyDescriptor` → removed (use `ControlFamilyDescriptor`)
   - `ControlPlaneDriver` → removed (use `ControlDriverInstance`)
   - `AdapterDescriptor`, `TargetDescriptor`, `ExtensionDescriptor` → removed (use `Control*Descriptor` variants)
3. ✅ Updated the SQL family:
   - `SqlControlAdapter` extends `ControlAdapterInstance<'sql', TTarget>`
   - `SqlControlFamilyInstance` (family-specific interface) extends `ControlFamilyInstance<'sql'>`
4. ✅ Updated Postgres packs:
   - `@internal/targets-postgres/control` exports a default `ControlTargetDescriptor<'sql','postgres'>`
   - `@internal/targets-postgres-adapter/control` exports a default `ControlAdapterDescriptor<'sql','postgres'>`
   - `@internal/targets-postgres-driver/control` exports a default `ControlDriverDescriptor<'sql','postgres'>`
5. ✅ Updated `defineConfig` and CLI config types to expect `Control*Descriptor` shapes exclusively
6. ✅ Updated all tests and CLI commands to use `Control*Descriptor` types
7. ✅ Retained `FamilyInstance` interface for CLI command handlers (provides full method set: `validateContract`, `verify`, `schemaVerify`, `introspect`, `emitContract`, `toSchemaView`)

**Note**: `ControlFamilyDescriptor.create()` requires a `driver` parameter even for commands that don't use it (e.g., `contract emit`) to ensure consistent descriptor patterns.

## References

- [ADR 005 - Thin Core Fat Targets](./ADR%20005%20-%20Thin%20Core%20Fat%20Targets.md)
- [ADR 011 - Unified Plan Model](./ADR%20011%20-%20Unified%20Plan%20Model.md)
- [ADR 065 - Adapter capability schema & negotiation v1](./ADR%20065%20-%20Adapter%20capability%20schema%20&%20negotiation%20v1.md)
- [ADR 112 - Target Extension Packs](./ADR%20112%20-%20Target%20Extension%20Packs.md)
- [ADR 150 - Family-Agnostic CLI and Pack Entry Points](./ADR%20150%20-%20Family-Agnostic%20CLI%20and%20Pack%20Entry%20Points.md)

