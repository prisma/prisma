# ADR 131 — Codec typing separation: emit-time type map, lane compile-time, runtime registry

## Status
Accepted

## Context

We need deterministic compile-time result typing for query lanes while keeping the contract JSON code-free and runtime registries out of the typing path. Codecs (encode/decode) are provided by adapters/packs at runtime; lanes must not depend on runtime composition to typecheck in editors/CI or no-emit environments.

Related: ADR 010 (Canonicalization), ADR 011 (Unified Plan), ADR 020 (Result typing rules), ADR 114 (Codecs & branded types).

## Decision

1. `contract.json` remains code-free and may carry optional per-column `typeId` as extension-owned decorations (namespaced `namespace/name@version`).
2. `contract.d.ts` is types-only and includes a minimal codec type map for the IDs actually referenced by the contract. The map references pack/adapter type exports; it does not embed runtime implementations.
3. Query lanes infer projection types at compile time using:
   - If column has `typeId` → `CodecTypes[typeId].output`
   - Else → storage scalar → JS mapping per target family
   - Nullability propagates from storage metadata
4. Lanes do not consume or receive runtime codec registries for typing.
5. Runtime composes a `CodecRegistry` from adapter and packs, validates that all declared `typeId`s have implementations, and performs encode/decode per precedence:
   1) Plan hint (`annotations.codecs`)
   2) Declared `typeId`
   3) Runtime overrides
   4) Registry by scalar
   5) Driver/native value (advisory)

## Consequences

- Deterministic editor/CI typing with `.d.ts` alone (or builder generics in no-emit mode).
- No registry dumps or executable code in `contract.json`.
- Clear SoC: types at emit/build time; implementations at runtime.
- Explicit validation error if a declared `typeId` lacks a codec implementation at execution.

## Notes on No-Emit Mode

- In no-emit environments, the TS builder is generic over composed `CodecTypes`; columns may carry literal `typeId`s. Lanes infer types from generics; runtime composes registries and validates coverage.

## Alternatives Considered

- Inferring types from a runtime-built registry: rejected due to editor/CI determinism concerns and environment coupling.



