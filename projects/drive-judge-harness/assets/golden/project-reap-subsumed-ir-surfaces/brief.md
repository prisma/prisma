# Brief — reap IR helpers subsumed by the entity-coordinate walk

A new **entity-coordinate walk**, `elementCoordinates(storage)`, was recently introduced and
is intended to be the single canonical way to walk a contract's storage IR (its namespaces,
tables/collections, and their elements). Earlier, the framework carried a set of
**asymmetry-driven helpers** — bits of SQL/Mongo-shaped path knowledge and pre-namespace
construction shims — that existed only because there was no uniform coordinate walk. The
coordinate walk now subsumes them.

Reap the helpers that are **cleanly removable** today, so `elementCoordinates` is the canonical
IR walk and the redundant surfaces are gone. The work spans the framework and the SQL/Mongo
family packs. Concretely, the redundant surfaces include:

- **Pre-namespace construction shims.** Loose POJO payload types and normalisation helpers
  (e.g. `normaliseNamespaceEntry`, the `*NamespacePayload` types) plus a default-namespace
  singleton that let the `SqlStorage` / `MongoStorage` constructors accept partially-built
  namespace data and silently inject a default. Authoring already routes through fully-built
  namespaces, so the constructors should require fully-constructed `Namespace` instances —
  no POJO coercion, no default injection.
- **Family-specific canonicalizer knowledge.** The framework canonicalizer hardcodes
  SQL-shaped `storage.namespaces.*.tables.*` path knowledge inline (preserve-empty guards and
  index/unique sorting). That family-specific knowledge belongs in the family packs, threaded
  into the framework canonicalizer as optional hooks. **This change must be output-preserving**
  — the canonical bytes and hashes must not move.
- **A migration-side aggregate helper** that re-derives storage element names independently.
  Its callers should walk via `elementCoordinates` instead, after which the helper can be
  deleted. Expect a `StorageBase`-vs-`Storage` type gap to resolve along the way.

Scope discipline matters: **only reap the cleanly-removable surfaces.** Some adjacent helpers
have structural prerequisites and are **out of scope** for this effort — e.g. promoting a
model's `table` field to a namespaced coordinate (touches the `contract.json` shape →
storage/profile hash regeneration), making hash computation namespace-kind-agnostic, and the
namespace-aware rewrite of the query-builder's unbound-tables selection. Defer those; do not
attempt them here.

You decide how to shape and sequence the work. Each landed change must pass the full
validation gate (`pnpm typecheck`, `pnpm test:packages`, `pnpm test:integration`,
`pnpm fixtures:check`, `pnpm lint:deps`) plus a deletion grep gate proving the reaped symbols
are gone.
