# ADR 244 — Check constraints are opaque wire-named expressions

Status: **Accepted**

Related: [ADR 234 — Content-addressed wire names for Postgres-normalized objects](<./ADR 234 - Content-addressed wire names for Postgres-normalized objects.md>) (extended here), [ADR 243 — Name-identified indexes and exact-name adoption](<./ADR 243 - Name-identified indexes and exact-name adoption.md>) (its constraint carve-out no longer covers checks), [ADR 156 — Storage sets and check constraints](<./ADR 156 - Storage sets and check constraints.md>) (its check-constraint half is superseded by this ADR), [ADR 235 — The schema differ walks two derived schema IRs](<./ADR 235 - The schema differ walks two derived schema IRs.md>), [ADR 224 — Control Policy](<./ADR 224 - Control Policy — framework-locked vocabulary and family-owned dispatch.md>).

## Decision

A check constraint in the contract is **one opaque SQL predicate carried under a content-addressed wire name**. It is the third object kind on ADR 234's naming convention, after RLS policies and indexes, and for a wire-named check the convention holds in full: the name is `<prefix>_<8 hex of SHA-256(canonical(predicate))>`, equivalence between a declared check and a live one is name equality, and nothing ever parses the predicate. An exact-named check — one adopted verbatim from a live database ([ADR 243](<./ADR 243 - Name-identified indexes and exact-name adoption.md>)'s exact-name mode) — keeps its physical name and compares expression bodies byte-for-byte instead.

This reverses the check-constraint half of ADR 156, which defined `tables.*.checks[]` as a structured `{ kind: "inSet", column, setRef }` entry and said the shape was "intentionally not a general-purpose SQL expression system in the contract." It is now exactly that. ADR 156's other half — `storage.sets` and the `column.valueSet` that references it — is untouched and remains in force: value sets still drive generated union types, declaration-order sorting, and `db.enums`. They simply no longer travel into the check node.

Four rules follow from the decision and are the reason it is worth recording:

1. **The predicate is target text, written by the target, and the family never reads it.** A Postgres authoring hook renders the SQL; the SQL family names it, hashes it, and stores it.
2. **The name carries the identity, so the family composes it — from the table, the column, and the kind — and caps it in UTF-8 bytes**, truncating a derived prefix rather than refusing it.
3. **A database carrying old-model check names adopts by drop + add**, not by rename, because content pairing is impossible for a predicate the database reprints.
4. **Derivation is scoped to tables Prisma Next manages.** A check is generated only for a `managed` table; the contract describes an external schema without prescribing enforcement for it.

## A worked example

A model with a text-backed domain enum and a scalar-list column:

```prisma
enum user_type {
  @@type("pg/text@1")
  admin
  user
}

model User {
  id   Uuid      @id @default(uuid())
  kind user_type
  tags String[]

  @@map("user")
}
```

A text-backed enum has no type-level enforcement in the database, so membership becomes a predicate; a list column gets an element-non-null predicate, which no Postgres column type can express. Authoring emits both into the `user` table, and this is the shape they take in the emitted `contract.json`:

```jsonc
"checks": [
  { "name": "user_kind_check_836d43ef",
    "prefix": "user_kind_check",
    "expression": "\"kind\" IN ('admin', 'user')" },
  { "name": "user_tags_elem_not_null_aecbe9e2",
    "prefix": "user_tags_elem_not_null",
    "expression": "array_position(\"tags\", NULL) IS NULL" }
]
```

`name` is the full physical constraint name, exactly what `pg_constraint.conname` holds. `prefix` is present, which is what marks the check **wire-named**; a check with no `prefix` was adopted verbatim from a live database and is **exact-named**. That is the same two-arm `SqlObjectNaming` discriminator `Index` and `PostgresRlsPolicy` already carry ([ADR 243](<./ADR 243 - Name-identified indexes and exact-name adoption.md>)).

The planner renders the checks inline at `CREATE TABLE`:

```sql
CREATE TABLE "user" (
  "id"   uuid   NOT NULL,
  "kind" text   NOT NULL,
  "tags" text[] NOT NULL,
  CONSTRAINT "user_kind_check_836d43ef" CHECK ("kind" IN ('admin', 'user')),
  CONSTRAINT "user_tags_elem_not_null_aecbe9e2" CHECK (array_position("tags", NULL) IS NULL)
);
```

Postgres stores its own reprint of each predicate — `(kind = ANY (ARRAY['admin'::text, 'user'::text]))` for the first one, and something else again if the column is `varchar` — and none of that matters, because the verifier compares names.

## Why the structured shape could not hold

ADR 156's `{ kind: "inSet", column, setRef }` shape assumed the system could recognise its own constraints in the catalog. It could not, for the reason ADR 234 already documented for RLS predicates: Postgres does not store what you wrote. `pg_get_expr(c.conbin, c.conrelid)` returns the planner's reprint of a reparsed expression tree. A membership check on a `varchar` column comes back as

```
((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[]))
```

which no reasonable regular expression maps back to `{ column: 'role', values: ['user', 'admin'] }`. The implementation that tried — a reverse parser matching two predicate shapes and stripping unbalanced parentheses — was the direct source of the defects this decision removes. Anything it did not recognise it silently dropped, so hand-written checks were invisible to diffing, and the shapes it half-recognised drifted.

Two framings are worth separating here, because the weaker one is the one usually reached for.

**The weak framing:** the contract gave up target-agnosticism for checks. **The accurate framing:** the check node was the last object still claiming target-agnosticism, and the claim was already false everywhere around it. `Index` carries opaque `expression` and `where` bodies. `PostgresRlsPolicy` carries Postgres predicates in `using` and `withCheck`. The contract has carried target SQL since ADR 234. Reversing ADR 156's promise *increases* the consistency of the contract rather than eroding it.

One consequence of the reversal is genuinely new and should not be discovered by accident. Checks are the first object whose *invariant* was portable even though its spelling is not. "Every element of this array is a member of the set" and "no element of this array is NULL" are facts a target could enforce however it likes; `<@ ARRAY[…]::text[]` and `array_position(…, NULL) IS NULL` are Postgres's spellings of them. Emission runs through a target-contributed hook, and SQLite contributes none, so a contract retargeted to SQLite does not fail on the Postgres predicate — it emits no checks and loses the invariant quietly. That is the current answer to "what happens to a check when the target changes", and it is a worse failure mode than refusing to retarget. It is acceptable today only because the SQLite planner refuses check DDL anyway. A target that wants checks needs a portable-invariant channel, not a second predicate renderer.

## The seam: the target writes SQL, the family writes names

Check emission is driven by a duck-typed hook on a target pack's authoring contributions, resolved the same way `qualifyColumnType` is: the family declares the shape it will call, the pack happens to satisfy it, and the family never imports the pack.

```ts
// The target sees one column and answers with predicates.
postgresRenderCheckExpressions({ tableName, columnName, many, memberValues })
//   → readonly { kind: 'membership' | 'elementNotNull'; columnName: string; expression: string }[]
```

Nothing in that return value is a name. The family composes `${table}_${column}_${kindSuffix}` (`check` for membership, `elem_not_null` for the element rule), caps it, and appends the content hash. That split is deliberate and is the answer to a real hazard: the truncation in the next section is safe **because the family knows the `(table, column, kind)` triple it named the check after is unique within a table**. Had the target composed the prefix, the family's safety argument would have rested on a property of SQL text it declares itself unable to read — that the predicate happens to mention its column — which nothing in the seam requires or enforces.

The seam still carries more weight than its `qualifyColumnType` precedent, and this is worth stating plainly rather than leaving for a reader to notice. `qualifyColumnType` returns a native type name, a value the family already models. `renderCheckExpressions` returns arbitrary target SQL that the family then hashes into a persisted, database-visible physical name. The family is deriving identity from bytes it cannot interpret. Two costs come with that, both accepted:

- **No compile-time link.** The family's hook type and the target's function are two independent declarations of one contract. If they drift, the structural check simply stops matching and Postgres emits no checks at all — silently. A test asserts the wiring, which is the same cost `qualifyColumnType` already pays.
- **A target-shaped restriction sits family-side.** A numeric member set is refused while the contract is being built (`CONTRACT.ENUM_INVALID`, "numeric-enum CHECK constraints are not yet supported"), even though `"level" IN (1, 10)` is legal Postgres. The restriction is a statement about what the renderer currently writes, raised by a layer that is supposed not to know. Failing at `defineContract` is right — an int-backed enum that built fine and failed at every migration was worse — but the guard belongs in the renderer.

## Naming: derived prefixes truncate, and the budget is bytes

ADR 234 states that the naming format, the normalizer, and the lowering-time prefix bound are object-kind-agnostic, and that a new object kind decides only its hash tuple and whether rename needs a kind-specific planner action. Checks add a third per-kind decision: **what happens when the prefix overruns the bound.**

Indexes and policies throw. A check's prefix is derived from the table and column names, and it truncates instead.

The distinction is not "checks versus everything else" but **authored versus derived under an author who cannot intervene**. An author who overruns an index prefix can shorten the `name:` they typed. A check prefix has no authoring surface at all — the shape that forced this is real, not hypothetical. The Supabase extension's `custom_oauth_providers.acceptable_client_ids` is a `text[]` column on a table with a 22-character name: its derived prefix is 58 bytes, a perfectly legal exact name, and a 67-byte wire name. Truncation cuts that to `custom_oauth_providers_acceptable_client_ids_elem_not_`, eating into the `_elem_not_null` marker, so the name no longer says which rule it enforces. That is a real loss and the price of the decision; throwing instead would make a legal schema unbuildable with no remedy available to its author. (That column no longer emits a check at all — its schema is `external`, see [Derivation is scoped to managed tables](#derivation-is-scoped-to-managed-tables) — but the shape recurs on any managed table with names that long, and the truncation-collision property is pinned in `check-constraint.authoring.test.ts`.) (`defaultIndexName` is also derived and still throws, and that conforms to the rule: a derived index prefix is overridable — the author shortens it by typing a `name:` — so the throw is a prompt to intervene. A check prefix has no such override, which is why the two land differently.)

Truncation is safe because identity does not live in the prefix. The hash does, and the predicate a check is named after always embeds the column — two columns of the same table whose prefixes truncate identically still produce different predicates and therefore different names.

**The budget is 54 UTF-8 bytes, not 54 characters.** Postgres truncates identifiers at `NAMEDATALEN - 1` = 63 bytes, and the wire name appends a 9-byte `_<8hex>` suffix. A prefix of non-ASCII identifiers sits far under 54 characters and far over 54 bytes, so a character-based cap declares a name the database will silently shorten — leaving the declared check permanently `not-found`, the truncated live one permanently `not-expected`, and the repair plan issuing an `ADD CONSTRAINT` that collides with the constraint already there. Truncation cuts on a code-point boundary, so a multibyte character is never split.

The hash tuple is the whole predicate and nothing else: `sha256(JSON.stringify([normalizeSqlBody(expression)]))`, first 8 hex characters. Schema, table, and constraint name are carried independently by the catalog and are orthogonal to "is this the same check."

## Derivation is scoped to managed tables

Membership and element-non-null checks are derived **only for tables whose effective control policy is `managed`**. A table under `external`, `tolerated`, or `observed` gets none.

The reason is a distinction the contract already makes everywhere else: **the contract *describes* an external schema, it does not *prescribe* enforcement for it.** Deriving a check from column shape is a statement about what Prisma Next will install. For a schema Prisma Next never creates, that statement is simply false — and it is not harmlessly false. `external` suppresses extras but not `declaredMissing`, so a check declared on a table the database never had it on fails verify forever, while the same policy forbids any plan that would install it. The failure has no remedy inside the model. The Supabase pack's `auth` schema was the live instance: two `text[]` columns on `auth.custom_oauth_providers` grew element-non-null checks that a real Supabase database has no reason to carry.

The rule is applied at two layers, because the policy reaches the builder two ways:

- **At the emission site**, when the source declares the policy (`@@control`, a table's `control`, or a contract-level `defaultControlPolicy`): the check is never derived.
- **After the build**, when a contract *specifier* stamps a default onto an already-built contract — which is how a pack like the Supabase extension declares `external`. Emission has already run by then, so the derived checks must be stripped. Every SQL contract specifier (`prismaContract`, `emptyContract`, `typescriptContract`, `typescriptContractFromPath`) funnels its loaded contract through one step, `applySqlSpecifierControlPolicy`, which stamps the specifier default and then strips derived checks from the tables the stamped policy leaves non-managed. The funnel holds by construction rather than by call-site discipline: a specifier cannot accept a `defaultControlPolicy` without also supplying the namespace factory the strip rebuilds through.

One consequence for contract identity is worth stating on its own: the strip recomputes the storage hash, since the stripped contract describes different storage. The storage hash is therefore a property of the **specifier-applied** contract, not of the storage the builder emitted — the strip is the first post-build transform that moves it.

A derived check is identified as a **wire-named** one. That is exact today because authoring is the only producer of checks and it names every one of them; an exact-named check can only have been adopted from a live database. The slice-3 opt-out surface re-examined this marker and it stands: `@noCheck` adds no producer of checks — an opted-out check is never emitted — so wire-named remains exactly "derived by authoring". It stops being exact the day a user-authored check surface exists (`@@check` is a project non-goal), at which point an authored check needs its own marker.

**Per-column opt-out (delivered by slice 3).** Scoping to `managed` fixes the case that cannot be repaired; it does not let the author of a managed table decline enforcement on a specific column. Slice 3 delivered that surface for each generated kind: the `@noCheck` field attribute (TS: `noCheck(...)`), whose concrete kinds persist on the storage column, and whose effect is simply that the check is never declared. Two decisions were settled for it and hold. First, **opting out of enforcement does not change declared types**: the enum union and the non-null element type stand, so runtime values may diverge from the types once enforcement is waived — the author's accepted risk, stated in the docs rather than encoded in the type. Second, inference stays conservative: because introspection is opaque and cannot classify a live predicate, `contract infer` emits the enforced form only when a live check's name matches the derived wire name, and the unenforced form otherwise, with any hand-written check surfacing separately.

## Equivalence, and what it does not detect

A check node is a table's diff-tree child with id `check:<name>`, and the differ always asks the *expected* node whether it equals the actual one. The receiver's naming mode selects the comparison:

| Receiver | Compares | Why |
| --- | --- | --- |
| wire-named | ids only | The name's hash already commits to the predicate |
| exact-named | the expression, byte-for-byte | Both sides are the database's own reprint, so bytes are stable |

Every outcome then reduces to name presence. Declared and not live is `declaredMissing` and plans an `ADD CONSTRAINT`. Live and not declared is `extraAuxiliary`: reported by `db verify --strict` only, and dropped only by a plan whose control policy allows `destructive` ([ADR 224](<./ADR 224 - Control Policy — framework-locked vocabulary and family-owned dispatch.md>)). A predicate change re-suffixes the name and therefore surfaces as one missing and one extra — a drop and an add, not an in-place comparison.

The check node no longer classifies as `valueDrift`. That category means "the value set of an existing type drifted" and still has a real producer in native-enum member drift; a check that carries no values was borrowing the name. Check divergence now classifies as `declaredIncompatible` like every other paired divergence. The one behavioural consequence: the `external` control policy used to suppress check divergence through the `valueDrift` branch and no longer does.

**What name-only comparison does not detect: a predicate edited in place under an unchanged constraint name.** `ALTER TABLE … DROP CONSTRAINT x` followed by `ADD CONSTRAINT x CHECK (true)` leaves a database that verifies clean against a contract whose declared predicate is something else entirely. This is not a new trade-off — it is the same one accepted for RLS policies in ADR 234 and for indexes in ADR 243, and the reasoning is unchanged: detecting it means comparing bodies, comparing bodies against a reprint is what does not work, and a verifier that fires on predicates the user did not change is worse than one that misses a deliberate out-of-band edit. It is stated here because a check constraint enforces data integrity, which raises the stakes relative to an index without changing the argument.

## Adoption of legacy names is drop + add

A database deployed before this decision carries unsuffixed check names — `User_role_check`, `User_tags_elem_not_null`. Indexes handle this case with a content-pairing pass: match a declared object to a live one by comparing bodies, then `RENAME`. That mechanism cannot work here, for two independent reasons:

- **The bodies never match.** The live predicate is Postgres's reprint; the declared one is the renderer's text. Byte comparison across that boundary is exactly the comparison this ADR exists to avoid.
- **A prefix-based rename would bless an unverified predicate.** Renaming `User_role_check` to `User_role_check_836d43ef` asserts that the live constraint enforces the declared predicate. Nothing checked that. Once the wire name is in place, name-based comparison trusts it forever.

So the legacy check surfaces as an ordinary extra and the wire-named one as an ordinary addition. Under a policy allowing `destructive` the two land in one migration and the database converges. Under an additive-only policy the new check installs, the stale one survives, and `db verify --strict` reports it — which is an accurate description of the database's state, not a failure. The cost is one revalidation scan per adopted check, and soundness is worth it.

Rename *within* the new model — a prefix change with an unchanged predicate, which pairs cleanly by hash and plans as `ALTER TABLE … RENAME CONSTRAINT` — is a separate mechanism from legacy adoption and lands separately. This section will gain its account of the rename pairing pass when that work merges, following the mid-project amendment precedent of [ADR 235](<./ADR 235 - The schema differ walks two derived schema IRs.md>).

## Consequences

### Positive

- **Introspection is complete.** Every `contype = 'c'` constraint is captured verbatim — free-form predicates, composite `AND`s, `NOT VALID` constraints (the body arrives without the suffix), one row per constraint on partitioned and inheriting tables. Nothing is silently skipped — the failure mode any shape-recognising parser carries by construction.
- **The planner reconciles diff issues and never synthesizes schema objects.** An element-non-null constraint is declared in the contract like everything else, so it is diffable, installs on a column added after `CREATE TABLE`, and is repairable when dropped by hand — none of which holds for an object a planner invents at one call site.
- **Array-typed domain enums are correct by construction.** `IN` against an array column is not a legal Postgres comparison at all (`operator does not exist: text[] = text`); the containment form `"roles"::text[] <@ ARRAY[…]::text[]` is, rejects NULL elements as a side effect, and casts the column rather than assuming its element type, so a `varchar[]` column works too.
- **Reprint drift is structurally impossible.** The hash is computed from authored text and never recomputed from an introspected body, so how Postgres chooses to print a predicate cannot cause a diff.

### Negative

- **Out-of-band predicate edits under an unchanged name are undetected**, as above.
- **Constraint names in the catalog are uglier.** A DBA reading `pg_constraint` sees `user_kind_check_836d43ef`. The hash suffix is data the user is asked to ignore.
- **A truncated prefix is not reconstructible.** Two checks on one table can legitimately share a prefix and differ only in hash. Anything that treats a prefix as a stable identity — a rename pass pairing on it, a human reading a plan — must know that `prefix` is not injective for checks, unlike for indexes and policies.
- **Retargeting silently drops invariants**, as above.
- **A contract inferred from a foreign database declares checks that database does not have.** The element-non-null rule is applied to every list column at build time, and `contract infer` does not read checks back out of the catalog, so round-tripping a pulled schema re-derives a constraint the live database never had. On a table the contract owns this is a plannable difference, not drift: verify reports the check as missing, and the next plan installs it. Scoping derivation to `managed` tables (below) removed the unfixable case; the slice-3 `@noCheck` opt-out removed the remaining cost: `contract infer` now emits `@noCheck(elementNotNull)` for every list column whose live database lacks the derived wire-named check, so a pulled managed schema verifies clean immediately, with no migration.
- **This is a breaking contract change.** `CheckConstraint` and its arktype wire schema change shape, so every emitted contract regenerates and every storage hash moves. Databases carrying old-model names need one migration under a destructive policy to converge.

## Alternatives considered

**Keep the structured shape and improve the parser.** Rejected. The parser is the defect source, not an implementation weakness: matching Postgres's reprint requires a Postgres grammar in JavaScript, tracked against Postgres versions, and every shape it fails to recognise silently disappears from the diff. ADR 234 rejected the same alternative for the same reason.

**Keep the predicate structured but compare by name anyway.** Rejected. Structure that no consumer trusts is cost with no benefit; if the name is the equivalence relation, the structured fields are dead weight the emitter must keep consistent.

**Refuse to build a schema whose derived check prefix overruns the cap.** Rejected. It makes legal schemas unbuildable with no remedy available to the author — the Supabase case above is a shipped example, not a hypothetical. The index stance assumes an escape hatch that derived check names do not have.

**Adopt legacy names by renaming them into wire names.** Rejected. It asserts, without evidence, that the live predicate matches the declared one, and name-based comparison then trusts that assertion permanently.

**Have the target compose the check's wire prefix.** Rejected. It splits one concept across a package boundary — the target spelling names, the family capping and hashing them — and makes the truncation-safety argument depend on a property of target SQL that nothing in the seam requires.
