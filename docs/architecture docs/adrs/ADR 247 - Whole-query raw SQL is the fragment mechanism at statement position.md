# ADR 247 — Whole-query raw SQL is the fragment mechanism at statement position

Status: **Accepted**

Related: [ADR 012 — Raw SQL escape hatch with required annotations](<./ADR 012 - Raw SQL Escape Hatch.md>) introduced raw plans as AST-less envelopes carrying `meta.annotations`. This ADR supersedes that plan-construction model: a whole-query raw statement is an AST node like any other. ADR 012's minimal annotation schema is unaffected.

## The surface

A raw statement is the same tagged template that produces raw *fragments* inside a builder query, terminated differently. From the shipped demo (`examples/prisma-8-demo/src/queries/raw-query-demo.ts`):

```ts
const user = db.sql.public.user;

const plan = db.sql.raw`
  SELECT u.id, u.email, count(p.id) AS "postCount"
  FROM "user" u
  LEFT JOIN "post" p ON p."userId" = u.id
  GROUP BY u.id, u.email
  ORDER BY count(p.id) DESC, u.email ASC
  LIMIT ${limit}
`
  .returnsRow({
    id: user.columns.id,
    email: user.columns.email,
    postCount: 'pg/int8@1',
  })
  .build();
```

`plan` is an ordinary `SqlQueryPlan<{ id: string; email: string; postCount: bigint }>`. It flows through the same lowering, guardrail, decode, and execution machinery as a builder-produced plan, because it is the same kind of value.

A statement that reports how many rows it touched terminates differently and declares nothing:

```ts
const plan = db.sql.raw`
  UPDATE "post"
  SET "viewCount" = "viewCount" + 1
  WHERE "userId" IN (SELECT id FROM "user" WHERE kind = ${kind})
`
  .affectedCount()
  .build();
```

## Decision

**1. One statement-level node, sharing the fragment representation.** `RawQueryAst` (kind `raw-query`) joins `AnyQueryAst` beside `SelectAst`, `InsertAst`, `UpdateAst`, and `DeleteAst`. It carries the same `parts` array as the expression-position `RawExpr` — literal SQL interleaved with interpolated expression nodes and `ParamRef`s — plus the result its author declared. No new query lane, no new execution surface, no second path through the runtime.

**2. The result is declared at the terminator, once.** A raw template is unfinished until it is terminated:

- `.returnsRow(rowSpec)` declares the result columns and yields a buildable that mints a row-streaming plan.
- `.affectedCount()` declares no columns and yields a buildable that mints `SqlQueryPlan<SqlStatementStats>`.

A bare template builds nothing. The node's `result` field is the discriminator the rest of the system reads: `{ kind: 'rows', columns }` or `{ kind: 'affected-count' }`.

**3. `returns*` names what is usable where expressions go.** `.returns(codecId)` yields an expression; `.returnsRow(spec)` yields a statement that produces rows and therefore embeds in another template. `.affectedCount()` carries no prefix because it yields a plan handle and nothing else. The prefix is the reader's cue, and the type system enforces it: only a row-returning raw query is in the interpolation union.

**4. A row spec is hybrid.** Each entry is either a contract column reference — `user.columns.email`, which carries the column's codec id, its nullability, and the TypeScript type the contract resolves it to — or an explicit codec id (`'pg/int8@1'`) or `{ codecId, nullable }` descriptor for a column the contract has no name for, such as a `count(*)`. Both forms resolve through the same codec-type map the query builders read, so a mixed spec types each entry by its own form. The explicit form is structurally the contract-free lane's `ColumnDescriptor`, so a spec written against one lane reads as a spec for the other.

**5. The tag binds its context once.** `db.sql.raw` sits beside the namespace facets, not inside one: a raw statement names its own tables and is a peer of the table proxies. Constructing it binds the adapter's codec inferer and the contract, so an authoring site carries only its template, its spec, and a terminator — nothing about codecs or plan metadata is restated per call.

## Why the fragment mechanism rather than a new surface

The fragment tag already solves the hard parts: interleaving SQL text with typed nodes, binding interpolated values as parameters rather than splicing them, and carrying a declared codec for what comes back. Statement position needs those same properties. Reusing the representation means the raw path inherits the machinery instead of duplicating it — one parts walker per target renderer serves both node kinds, one decode context builder serves projections and row specs, and a raw plan is indistinguishable from any other plan to middleware, telemetry, and the prepared-statement path.

It also settles composition for free, which a separate surface would have had to invent.

## Composition: embeddable iff row-returning

Interpolating a row-spec'd raw query into another raw template splices the inner parts into the outer parts list. Parameters keep their template order because the flattened list is the order:

```ts
const authorsWithPosts = db.sql.raw`
  SELECT p."userId" AS "userId", count(*) AS "postCount"
  FROM "post" p
  GROUP BY p."userId"
  HAVING count(*) >= ${minPosts}
`.returnsRow({
  userId: post.columns.userId,
  postCount: 'pg/int8@1',
});

const plan = db.sql.raw`
  WITH active AS (${authorsWithPosts})
  SELECT u.email, active."postCount"
  FROM active
  JOIN "user" u ON u.id = active."userId"
  ORDER BY active."postCount" DESC, u.email ASC
`
  .returnsRow({ email: user.columns.email, postCount: 'pg/int8@1' })
  .build();
```

Two rules follow, both deliberate:

**The inner spec is discarded on splice.** The outer template declares the row it returns; the inner declaration described a statement that is now a subquery, and a subquery's columns are not the outer result. Keeping the inner spec would mean deciding how two specs merge when the outer query renames, aggregates, or drops the inner columns — a question with no answer that holds for every SQL shape. Discarding is the rule that needs no exceptions.

**Embeddability keys on the declared result, not the statement keyword.** A mutation with `RETURNING` produces rows, so it takes a row spec and composes exactly like a `SELECT` — which is what makes data-modifying CTEs expressible:

```ts
const promoted = db.sql.raw`
  UPDATE "post"
  SET priority = 'high'
  WHERE title ILIKE ${`%${titleTerm}%`} AND priority <> 'high'
  RETURNING id, title, "userId"
`.returnsRow({
  id: post.columns.id,
  title: post.columns.title,
  userId: post.columns.userId,
});
```

A mutation without `RETURNING` terminates with `.affectedCount()`, which is a plan handle, and the type system rejects it as an interpolation. The enforcement is structural rather than a runtime check: the row-returning buildable exposes the AST accessor the splice needs, and the affected-count buildable does not.

## Responsibilities

- **Lane (`@internal/sql-relational-core`)** owns the node, the terminators, spec normalization (a bare codec id becomes `{ codecId, nullable: false }`), and the splice.
- **Contract-typed lane (`@internal/sql-builder`)** owns `db.raw`, the table proxy's `columns` accessor, and the resolution of spec entries to TypeScript row types.
- **Adapters** render the node by walking its parts through the same expression renderer that serves `RawExpr`, emitting each target's placeholder form (`$N` for Postgres, `?` for SQLite).
- **Runtime** reads the node's `result` where it decodes: a row spec becomes the decode context's aliases and per-column codecs. Which runtime operation a plan belongs to needs no raw-specific code — a row-returning statement is run through `runtime.query(plan)`, which streams decoded rows, and a statement declaring an affected-row count through `runtime.execute(plan)`, which resolves to `SqlStatementStats`. Guardrails run over the SQL text via `evaluateRawGuardrails`, because a raw statement has no structural shape for the AST lints to inspect.

## Result semantics

**The declared result picks the runtime operation.** A row-returning statement is run through `runtime.query(plan)` and streams rows decoded against its spec; a statement declaring an affected-row count is run through `runtime.execute(plan)`, which resolves to `SqlStatementStats`. The terminator and the operation say the same thing, so a raw statement needs no dispatch of its own — the row type each terminator mints is what tells a caller which operation its plan belongs to.

**A declared column the result omits is an error.** The runtime never parses the SQL, so the spec is its only description of what comes back; a spec naming a column the statement does not return is a mismatch the caller has to see. It raises `RUNTIME.RAW_ROW_COLUMN_MISSING`, naming the column and both column lists. This is distinct from `RUNTIME.DECODE_FAILED`, which means a codec rejected a value the runtime did expect.

**A result column the spec does not declare is dropped.** Adding a column to a `SELECT *`-shaped statement, or to a `RETURNING` list, does not break a caller who did not ask for it. Surplus columns are not decoded and do not appear in the row.

## Deliberate limitations

**Raw statement plans carry no annotations.** `.annotations()` is not part of this surface. One consequence is concrete: `evaluateRawGuardrails` reads `meta.annotations.intent` to decide whether a mutation contradicts a read-only intent, so `LINT.READ_ONLY_MUTATION` cannot fire for a raw statement plan until annotations reach it. Every other raw guardrail — `LINT.SELECT_STAR`, `LINT.NO_LIMIT`, and the unbounded-select budget — is text-derived and applies today.

**An affected-count statement cannot be prepared.** A prepared statement executes through the row path, which reports no statistics, so a prepared `.affectedCount()` plan would stream nothing at all. `prepare()` refuses one with `RUNTIME.PREPARE_AFFECTED_COUNT_UNSUPPORTED` where the statement is declared, rather than leaving the emptiness to be discovered at execution. Row-returning raw statements prepare and stream normally; a prepared path that reports statistics is a separate surface.

**`raw` is a reserved storage-namespace name.** `db.raw` is the tag, so a contract declaring a storage namespace named `raw` would have that namespace shadowed while the type still promised its tables. `sql()` refuses such a contract at construction with `ORM.NAMESPACE_RESERVED` rather than answering `undefined` for every table in it. The check reads storage namespaces only, because storage is what the surface dispatches on.

## Consequences

- A raw statement is subject to the same lints, budgets, middleware, telemetry, and abort handling as any other plan. Raw is an escape hatch from the *builder*, not from the runtime.
- `SqlQueryPlan.ast` is populated for raw plans, so every consumer that branches on `plan.ast` sees a node it can dispatch on. Any target renderer that walks `AnyQueryAst` exhaustively must handle `raw-query`.
- Column-level codec identity is resolved from the spec's codec ids, not from contract storage lookup, so a computed column decodes exactly as declared.
- Nullability in a spec is carried for the TypeScript row type. It is not enforced at decode: a `null` in a column declared non-nullable passes through, matching how the builder path treats a contract column.

## Alternatives considered

**A separate raw execution surface (a `$queryRaw`-style client method).** Rejected: it would need its own decode, guardrail, and telemetry integration, and raw plans would stop being composable with anything. Making raw a node keeps one pipeline.

**Reusing the AST-less plan shape from ADR 012.** Rejected: a plan with no AST cannot carry per-column codecs, so results come back as wire values, and nothing downstream can dispatch on what the statement is. The declared row spec is precisely the metadata an AST-less plan lacked, and once the plan carries it, it is an AST.

**Inferring the row shape by parsing the SQL.** Rejected: it puts a SQL parser in the runtime for every dialect, and it fails on exactly the statements raw exists to serve — target-specific syntax, extension operators, functions the contract has never seen. Declaring the row is a sentence the author writes once.

**A marker on the embedded query instead of discarding the inner spec.** Rejected: a cheaper marker would still leave the two-specs question open at every splice site. Discarding is the rule a reader can state in one sentence.

**Keying embeddability on the statement keyword (`SELECT` embeds, `UPDATE` does not).** Rejected: it would require classifying the SQL text, and it would be wrong — a data-modifying CTE is a legitimate and useful shape. The declared result already answers the question exactly.
