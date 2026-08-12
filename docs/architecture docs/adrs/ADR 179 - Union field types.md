# ADR 179 — Union field types

## At a glance

A field that can hold one of several types uses the `union` property — a third field type descriptor alongside `codecId` (scalar) and `type` (value object). Each union member makes the same choice:

```json
{
  "valueObjects": {
    "SearchResult": {
      "fields": {
        "score": { "nullable": false, "union": [
          { "codecId": "mongo/int32@1" },
          { "codecId": "mongo/string@1" }
        ]},
        "location": { "nullable": false, "union": [
          { "type": "Address" },
          { "type": "GeoPoint" }
        ]},
        "data": { "nullable": false, "union": [
          { "codecId": "mongo/string@1" },
          { "type": "Attachment" }
        ]}
      }
    }
  }
}
```

Three things to notice:

1. **`union` is an array of members**, each carrying either `codecId` or `type` — the same choice individual fields make.
2. **Scalar unions** (`score`): the field holds an `int32` or a `string`. Common in MongoDB documents and schema evolution scenarios.
3. **Mixed unions** (`data`): scalars and value objects can coexist in the same union. The field holds either a plain string or a structured Attachment.

The resulting TypeScript types:

```typescript
type SearchResult = {
  score: number | string;
  location: Address | GeoPoint;
  data: string | Attachment;
}
```

## Context

MongoDB documents commonly hold fields with mixed types — a `score` that's sometimes a number and sometimes a string, a `metadata` field that can be a string or a structured object. SQL JSONB columns have the same characteristic. Schema evolution often produces fields that accumulate types over time.

Before this decision, the contract had no way to express this. A field was either a scalar (`codecId`) or a value object (`type`). Mixed-type fields had to be modeled as raw JSON or as `any`, losing all type safety.

## Problem

How should the contract express that a field can hold values of different types — scalars, value objects, or a mix?

## Decision

### `union` as a third field type descriptor

The field type system gains a third option:

| Property | Meaning | Example |
|---|---|---|
| `codecId` | One scalar type | `"mongo/string@1"` |
| `type` | One value object | `"Address"` |
| `union` | Multiple types (any mix of scalars and value objects) | `[{ "codecId": "..." }, { "type": "..." }]` |

All three are mutually exclusive on a field. `codecId` and `type` are the degenerate single-member cases; `union` is the general form.

Each member in the `union` array makes the same `codecId` vs `type` choice. This keeps the field type system consistent — no new concepts, just the existing primitives composed into an array.

### Structured vs unstructured unions

The contract now has two ways to express "one of several types," serving different needs:

| | Polymorphic value object ([ADR 173](ADR%20173%20-%20Polymorphism%20via%20discriminator%20and%20variants.md) / [ADR 178](ADR%20178%20-%20Value%20objects%20in%20the%20contract.md)) | `union` field |
|---|---|---|
| **Discriminated?** | Yes — explicit discriminator field | No — runtime type inspection |
| **Shared base?** | Yes — variants share fields via `base` | No — members are independent types |
| **Type narrowing** | Discriminator value narrows the type | `typeof` / structural inspection |
| **Use case** | Structured variants with shared fields | Heterogeneous values, schema evolution, mixed types |

Both produce TypeScript union types. The polymorphic pattern is stronger (compile-time narrowing via discriminator), while `union` is more flexible (any mix of types, no shared structure required).

**When to use which:**

- If the values share fields and have a clear discriminator, use a polymorphic value object. Example: `ContactInfo` with `EmailContact` and `PhoneContact` variants, discriminated by `channel`.
- If the values are independent types with no structural relationship, use `union`. Example: a `score` field that holds `int32 | string`.

### `union` with `many` and `nullable`

Union fields compose with the same modifiers as other fields:

```json
"tags": { "nullable": false, "many": true, "union": [
  { "codecId": "mongo/string@1" },
  { "codecId": "mongo/int32@1" }
]}
```

This represents an array where each element is either a string or an int32 (`(string | number)[]`).

## Consequences

### Benefits

- **Completes the field type system.** Every field type a database can produce — scalar, composite, or mixed — has a contract representation.
- **No new concepts.** `union` composes the existing `codecId` and `type` primitives into an array. The mental model is the same at every level.
- **Schema evolution friendly.** Fields that accumulate types over time (common in MongoDB, JSONB columns) can be accurately represented instead of falling back to untyped JSON.

### Costs

- **Runtime type inspection.** Unlike polymorphic value objects, unstructured unions have no discriminator. The ORM runtime must inspect the actual value to determine its type. This is a performance cost for runtime type resolution, but it matches how MongoDB and JSONB actually work.
- **Operator gating is ambiguous.** If a union contains `int32 | string`, which operators are available? Only operators valid for *all* members (intersection), or operators for *any* member (union)? This is a design decision for the query builder — the contract represents the types, and the query layer decides the operator policy.

## Related

- [ADR 178 — Value objects in the contract](ADR%20178%20-%20Value%20objects%20in%20the%20contract.md) — `type` as a field type descriptor
- [ADR 173 — Polymorphism via discriminator and variants](ADR%20173%20-%20Polymorphism%20via%20discriminator%20and%20variants.md) — structured polymorphism as an alternative to unstructured unions
