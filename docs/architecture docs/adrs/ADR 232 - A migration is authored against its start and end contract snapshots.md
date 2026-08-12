# ADR 232 — A migration is authored against its start and end contract snapshots

## At a glance

A migration takes the two contract snapshots it moves between as its inputs. It assigns them to the base class and writes its operations; it states nothing else about the transition:

```ts
import endContract from './end-contract.json' with { type: 'json' };
import type { Contract as End } from './end-contract';

class M extends Migration<never, End> {
  override readonly endContractJson = endContract;
  override get operations() {
    return [ createCollection('carts', { validator: { $jsonSchema: { /* … */ } } }), /* … */ ];
  }
}
```

From those snapshots the base supplies the two things every migration needs: the transition's identity, and typed access to the contract by name (a `ContractView`, [ADR 233](<ADR 233 - ContractView is a typed by-name accessor over a contract.md>)).

## Decision

A migration is the step that moves a database from one contract to the next. The state it starts from and the state it produces are what define it, so a migration takes those two contracts — its **start** and **end** snapshots — as its inputs. Each migration directory carries them as committed, immutable artifacts (`start-contract.json` / `end-contract.json` and their `.d.ts` types); the migration assigns them to `startContractJson` / `endContractJson`.

Two things follow from holding the snapshots, and the base owns both:

1. **Identity.** `describe()` returns `{ to: endContractJson.storage.storageHash, from: startContractJson?.storage.storageHash ?? null }`. A migration's from/to identity is a property of the two states it names, read from them directly.
2. **Typed access.** The family bases (`MongoMigration`, `SqliteMigration`, `PostgresMigration`) expose lazy, memoized `startContract` / `endContract` getters — a `ContractView` over each snapshot ([ADR 233](<ADR 233 - ContractView is a typed by-name accessor over a contract.md>)) — so hand-written migration logic reaches entities by name.

A migration that carries no contract — an extension-install migration that only issues DDL, say — overrides `describe()` directly and sets no snapshot fields.

## Identity is read from the snapshot

`storage.storageHash` is a property of any contract, target-independent, so identity derivation lives on the framework `Migration` base. The runner consumes a migration through `origin` / `destination`, each `{ storageHash }`, and those project straight from the snapshots the migration ships. There is a single source for a migration's identity — the snapshots in its own directory — so its declared transition and the contracts it carries cannot disagree.

## Generated schema, hand-authored transforms

Schema operations are a pure function of the contract diff, so the migration generator emits them in full and reads nothing from the contract at author time. The snapshots are on the class for the two things a diff cannot produce: the base's identity derivation, and hand-written logic.

That second case — a data migration, such as a backfill — is where the typed `startContract` / `endContract` views earn their place. Its logic cannot be synthesized from a schema diff; an author writes it, and `this.endContract` is where that code reads entity metadata by name. The view is a convenience exactly where authoring happens by hand, not over coordinates that generated code never spells.

## Consequences

- A migration's identity is read from the contract snapshots in its own directory; there is no separate hash for an author to keep in step.
- A migration's authored scaffold is a function of its snapshots and its operations, so re-emitting the scaffold leaves the migration's behaviour — its `ops.json` / `migration.json` — unchanged.
- Every migration has typed contract access; the type flows from the per-migration `end-contract.d.ts` through the family base's view getter.
- The base carries optional snapshot fields and a concrete `describe()` that a subclass may override, so a migration with no contract is still a valid migration.

## Alternatives considered

- **A hand-written `describe()` carrying the from/to hashes as literals.** The identity restated as strings beside the file that already holds the contracts those strings summarize — two sources for one fact, kept in step by the author. Rejected in favour of deriving identity from the snapshots.
- **A migration that references a single shared contract rather than a per-migration snapshot pair.** A migration would then read the current contract, not the one it was authored against, and its meaning would drift as the schema evolves. Rejected: a migration is a fixed transition and must name both endpoints as immutable snapshots.

## References

- [ADR 233 — ContractView is a typed, by-name accessor over a contract](<ADR 233 - ContractView is a typed by-name accessor over a contract.md>) (the typed access this migration model exposes).
- ADR 224 — Namespace concretions address entities by coordinate.
- ADR 223 — Target-owned default namespace.
