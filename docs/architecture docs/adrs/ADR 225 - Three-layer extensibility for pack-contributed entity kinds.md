# ADR 225 — Three-layer extensibility for pack-contributed entity kinds

**Status:** Accepted
**Date:** 2026-06-08

---

## Decision

A pack-contributed entity kind — an RLS policy, a Postgres role, a materialised view — is registered across three layers, and **one `discriminator` string ties them together**:

```
discriminator: 'postgres-policy-select'
  ├─ IR class                  PostgresPolicySelectIr      (how it lives in memory + hashes)
  ├─ entityTypes factory       AuthoringContributions.entityTypes      (how a parsed node becomes that IR)
  └─ pslBlockDescriptors entry AuthoringContributions.pslBlockDescriptors  (how it reads/writes as PSL)
```

A contribution provides all three under the same discriminator:

1. **An IR class** following the three-layer polymorphic IR pattern ([`three-layer-polymorphic-ir.md`](../patterns/three-layer-polymorphic-ir.md)): framework interface → family abstract base → target concrete class, frozen in its constructor.
2. **An `entityTypes` factory** carrying the `discriminator` and an `output.factory: (input, ctx) => IRNode` that constructs the IR instance from the lowering input.
3. **A `pslBlockDescriptors` entry** — an `AuthoringPslBlockDescriptor` carrying the same `discriminator`, describing the PSL block as data ([ADR 126](ADR%20126%20-%20PSL%20top-level%20block%20SPI.md)).

Parsing and lowering route by discriminator; printing routes by keyword. Parsing sets `PslExtensionBlock.kind = descriptor.discriminator`, and the lowering machinery looks up the factory by that key; printing looks up the descriptor by the block's own `keyword` (several keywords may share one discriminator — see [ADR 126](ADR%20126%20-%20PSL%20top-level%20block%20SPI.md)) to reconstruct PSL from the IR node. Convention: `<target-or-family>-<kind>`, e.g. `postgres-policy-select`.

## Why three layers, one key

A contributed entity must be addressable at three distinct layers, each with its own extension point:

1. **Contract / Schema IR** — the in-memory class that represents the entity after lowering, carries its data as frozen properties, and hashes deterministically.
2. **Semantic lowering** — the bridge from a parsed source node to the IR class instance.
3. **PSL parse and print** — reading the entity from PSL source and writing it back.

Without a single shared key the three would be wired together ad hoc, and nothing would stop a contribution from supplying two of the three (a descriptor with no factory, say) or mismatching them. Routing every layer through one `discriminator` makes the connection explicit and checkable, and lets the framework dispatch generically — it never learns a contributed kind's name.

## The three layers in detail

### Layer 1 — IR class

The IR class follows the three-layer polymorphic IR pattern so framework tooling (hashing, walking, serialisation) processes contributed entities generically:

```
framework interface      → minimum contract every entity satisfies
family abstract base     → refines for the family's persistence model
target concrete class    → the contributed entity kind; freezes itself in the constructor
```

The concrete class freezes at construction — `freezeNode(this)` from the [frozen-class-ast pattern](../patterns/frozen-class-ast.md), or `Object.freeze(this)` directly. A kind needs no family intermediate layer if the family adds nothing for it; target-only kinds satisfy the framework interface directly.

### Layer 2 — `entityTypes` factory

Registered on `AuthoringContributions.entityTypes`, the factory carries:
- `kind: 'entity'` — identifies it as an entity-type descriptor.
- `discriminator` — the shared routing key.
- `output.factory: (input, ctx) => IRNode` — constructs the IR instance from the lowering input, called after the PSL node is parsed (or after the TS DSL helper is invoked).
- optionally `validatorSchema` (an arktype `Type`) that validates the raw input before `factory` runs.

### Layer 3 — `pslBlockDescriptors` entry

Registered on `AuthoringContributions.pslBlockDescriptors`, the descriptor carries `kind: 'pslBlock'`, the `keyword` it claims, the same `discriminator`, whether the block is named, and a `parameters` map of `ref` / `value` / `option` / `list` descriptors. Its full semantics are [ADR 126](ADR%20126%20-%20PSL%20top-level%20block%20SPI.md).

The framework enforces at load time that every `pslBlockDescriptors` entry has a matching `entityTypes` factory under the same discriminator (`assertPslBlocksHaveFactories`). A factory may exist without a descriptor — for kinds reachable only through the TS DSL, not PSL.

## How the three layers connect at runtime

```
PSL source text
  └─→ generic parser      → PslExtensionBlock { kind: discriminator, name, parameters }
  └─→ generic validator   → checks parameters against the descriptor
  └─→ entityTypes factory → looked up by discriminator; constructs the IR instance
  └─→ namespace.entries[discriminator][name]   (ADR 224 coordinate model)
  └─→ generic printer     → looks up the descriptor by keyword; reconstructs PSL from the IR node
```

The `entries[discriminator][name]` path mirrors the IR's coordinate model ([ADR 224](ADR%20224%20-%20Namespace%20concretions%20address%20entities%20by%20coordinate.md)), so a generic walker reading `entries` structurally reaches built-in and contributed kinds alike, without knowing their names ahead of time.

## Consequences

- **One string connects all three layers.** A contribution cannot accidentally mismatch them: the load-time check catches a descriptor with no factory, and the printer fails fast on a discriminator with no descriptor.
- **The framework adds no per-kind knowledge.** Parser, validator, printer, and walkers dispatch structurally on `entries` and discriminator lookup; no new keyword names are learned.
- **Contributed kinds are coordinate-addressable on the same terms as built-ins.** `entries[discriminator][name]` works for `policy_select` exactly as `entries['model'][name]` works for `model`.
- **Adding a kind is additive.** A new `(descriptor, factory, IR class)` triple needs no change to the framework parser, printer, or walker.

## Alternatives considered

**A separate key per layer** — let each layer name its own contributions and wire them together by lookup tables. Rejected: it admits partial or mismatched registration (a parsed block with no lowering, a printer that can't find a descriptor) and offers no single point to validate the contribution as a whole. One discriminator makes "is this kind fully registered?" a single, checkable question.

**Framework awareness of each kind** — let the framework hold a registry of known contributed kinds and branch on them. Rejected: it reintroduces the core changes this extensibility exists to avoid; every new kind would touch framework dispatch. Structural dispatch on `entries` plus discriminator lookup keeps the framework closed to per-kind knowledge.

## References

- [Three-layer polymorphic IR pattern](../patterns/three-layer-polymorphic-ir.md)
- [Frozen-class AST + visitor pattern](../patterns/frozen-class-ast.md)
- [JSON-canonical / class-in-memory round-trip pattern](../patterns/json-canonical-class-in-memory.md)
- [ADR 126 — PSL top-level block SPI](ADR%20126%20-%20PSL%20top-level%20block%20SPI.md) — the descriptor SPI for layer 3
- [ADR 221 — Contract IR two planes with uniform entity coordinate](ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md) — the coordinate model
- [ADR 224 — Namespace concretions address entities by coordinate](ADR%20224%20-%20Namespace%20concretions%20address%20entities%20by%20coordinate.md) — `entries[kind][name]` in the IR and PSL AST
