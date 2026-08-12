# ADR 238 — Always-qualified builder surface with per-facade default-namespace projection

Status: **Accepted**.

Related: [ADR 223 — Target-owned default namespace](ADR%20223%20-%20Target-owned%20default%20namespace.md), [ADR 221 — Contract IR two planes with uniform entity coordinate and pack-contributed entity kinds](ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md).

## Context

ADR 223 made a target's default namespace a static descriptor fact and deferred multi-namespace flat access and bare-name collision ergonomics. Two questions had to be decided: how a contract on a target that supports multiple namespaces is navigated, and how a target that supports a single namespace keeps flat ergonomics. Throughout, whether namespaces are in play is a property of the **target**, not of the contract.

## Decision

### 1. The builder surface is always qualified

The SQL builder and ORM client require the namespace at the call site (`sql.<ns>.<table>`, `orm.<ns>.<Model>`); there is no flat by-bare-name access at the builder layer.

```ts
await sql.auth.users.select({ id: true }).build().execute();
await orm.public.Profile.find({ where: { id } });
```

This separates **navigation** (which namespace's table/model?) from **ergonomics** (don't make me type the namespace when there's only one): navigation is a builder concern, ergonomics a facade concern.

### 2. Whether call sites must qualify is decided by the target, not the contract

Each facade projects its surface by whether its **target** supports more than one namespace — independently of how many namespaces a given contract actually declares:

- A target that supports multiple namespaces (Postgres) exposes the qualified surface. Call sites name the namespace (`db.sql.public.users`) **even when the contract declares only a single namespace**.
- A target that supports a single namespace (SQLite, Mongo) exposes that namespace's tables and models directly, so access is flat (`db.sql.users`).

Each facade is written for one target, so it fixes this shape in its own code: the Postgres facade returns the qualified builder; the SQLite facade returns its single namespace's tables and models. Nothing about the target or the contract is consulted at runtime to make the choice.

### 3. Mongo needs no projection

The Mongo ORM is keyed by model name, not by namespace, and is already flat — there is no flat-vs-qualified distinction to project.

### 4. Unknown access returns `undefined`, not a throw

Accessing an unknown namespace, table, or model yields `undefined` at runtime; the always-qualified contract is enforced at the **type level** (unknown access is a compile error). Throwing on property access would break ordinary JS probing (e.g. `then` / `toJSON` checks by frameworks and serializers).

## Consequences

- **Breaking change (deliberate):** consumers of a target that supports multiple namespaces (Postgres) must qualify bare-name access with the namespace — including contracts that declare only one namespace. Recorded as the `qualify-flat-builder-accessors` upgrade entry (0.13 → 0.14).
- Consumers of a single-namespace target (SQLite, Mongo) write flat `db.sql.<table>` / `db.<Model>` with no change.

## References

- [ADR 223 — Target-owned default namespace](ADR%20223%20-%20Target-owned%20default%20namespace.md)
- [ADR 221 — Contract IR two planes with uniform entity coordinate and pack-contributed entity kinds](ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md)
