# ADR 233 — ContractView is a typed, by-name accessor over a contract

## At a glance

A `ContractView` reads a contract's entities by name, with the default namespace unwrapped:

```ts
import { MongoContractView } from '@internal/family-mongo/ir';

const view = MongoContractView.fromJson<Contract>(contractJson);
view.collection.carts.validator;
```

instead of the entity's full storage coordinate:

```ts
contractJson.storage.namespaces.__unbound__.entries.collection.carts.validator;
```

The view is a **superset of the contract** — usable anywhere the contract is — so a single value serves both roles.

## Decision

A contract addresses its entities by storage coordinate: `storage.namespaces.<id>.entries.<kind>.<name>`. That coordinate is exact and correct for the serialized artifact, but it is not a reading surface — it spells a namespace-binding sentinel, an `entries` dictionary, and a kind key, none of which mean anything to code that just wants "the `carts` collection."

`ContractView` is a separate object that presents the same entities by name. It is:

- **A superset of the contract.** The view carries the whole contract plus by-name accessors, so a caller holds one value that is both the contract and the ergonomic surface over it.
- **Per target, via a `from` / `fromJson` factory.** `from(contract)` wraps an already-deserialized contract; `fromJson(json)` deserializes and wraps in one step. The view type is generic over the contract, so access stays fully typed against the specific contract passed.
- **Default-namespace-unwrapping.** A single-namespace target reads its entities flat; a multi-namespace target keeps the namespace as a coordinate.

The contract type itself stays a raw mirror of the serialized form. The view is a projection computed from whatever contract it is given, so the emitter and serializers own no part of it — nothing about the accessor is baked into the emitted artifact.

## The per-target shape

Each target's view unwraps that target's default namespace and surfaces its entity-kind slots:

| Target | Access | Namespace handling |
| --- | --- | --- |
| Mongo | `view.collection.<name>` | single namespace unwrapped to the root |
| SQLite | `view.table.<name>`, `view.valueSet.<name>` | single namespace unwrapped to the root |
| Postgres | `view.namespace.<schema>.table.<name>` | schemas addressed under a fixed `namespace` member |

Pack-contributed entity kinds (beyond a family's built-in kinds) remain reachable under `entries` on the projected namespace, keyed by the kind's registered name.

## Schemas are addressed under a member, not the contract root

The view shares one namespace projection with the runtime `enums` surface: a namespace-keyed map, `view.namespace.<schema>`, with the default namespace unwrapped for single-namespace targets. A multi-namespace target keeps each schema as a coordinate under the fixed `namespace` member rather than lifting schema names onto the view's root.

Schema names are user-chosen. A schema placed at the root and named like a contract field — `storage`, `domain` — would shadow that field, and because the view is a structural superset of the contract, the type system would not catch it. Addressing schemas under `namespace` makes the collision impossible: the only keys at the root are the contract's own fields and a family's fixed entity-kind slots, all known ahead of time. A single-namespace target still reads its entities flat, because it has exactly one namespace to unwrap and no schema coordinate to disambiguate.

## Consequences

- A reader of a contract reaches entities by name without spelling the namespace sentinel, the `entries` dictionary, or a kind key.
- The view is substitutable for the contract, so one value carries both the raw contract and the by-name surface.
- The projection is single-sourced with the runtime `enums` surface, so the two present namespaces the same way.
- A view over a contract that lacks the expected default namespace fails loudly at construction rather than yielding an undefined slot.

## Alternatives considered

- **An accessor method on the contract type itself.** The author-facing contract is data-only — its emitted `.d.ts` declares no methods — so a getter there is invisible to consumer code, and it would couple the emitter to a convenience concern. Rejected in favour of a separate view object.
- **Denormalised accessor data emitted into the contract artifact.** Duplicates every entity in the canonical artifact and invites drift between the copies. Rejected.
- **Schema names at the view's root** (a flat `view.<schema>.…`). A schema named like a contract field silently shadows it, uncaught by the type system. Rejected in favour of the `namespace` member.
- **Free helper functions over the contract** (`tables(contract)`, `collections(contract)`). Workable, but scatters the surface across many functions and gives the projection no single home. Rejected in favour of one view object per target.
- **A class whose static factory returns a non-instance.** A `class` existing only to host a `static from()` that returns a plain projection shape adds a type that is never instantiated. Rejected in favour of a plain `{ from, fromJson }` factory.

## References

- ADR 232 — A migration is authored against its start and end contract snapshots (the view's consumer).
- ADR 224 — Namespace concretions address entities by coordinate (the raw coordinate the view projects from).
- ADR 225 — Three-layer extensibility for pack-contributed entity kinds (the `entries` dictionary the view reads).
- ADR 223 — Target-owned default namespace (the default-namespace sentinel the view unwraps).
- [`docs/architecture docs/patterns/interface-plus-factory.md`](../patterns/interface-plus-factory.md) — the `from` / `fromJson` factory shape.
