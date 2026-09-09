# Deferred

## Runtime deviations from the contract on Mongo

**Raised:** 2026-09-09, while recording relation nullability on the contract (TML-3233).

**What:** Mongo has no foreign keys, so a required to-one reference can point at a document that does not exist, and more generally a stored document can disagree with the contract in many ways. After TML-3233 the Mongo ORM's types follow the contract, so a dangling required reference is a runtime data error that the types do not admit. There is no structured handling of that class of error today.

**Why deferred:** It is a general concern about reconciling stored data with the contract at read time, for example validating on read or coercing read data into the contract's shape, and it applies to every Mongo read path, not only to relations. It is independent of the model-and-result-types work.

**What happens today (verified 2026-09-09):** the Mongo ORM compiles a to-one include as `$lookup` followed by `$unwind` with `preserveNullAndEmptyArrays: true`. When the referenced document does not exist, `$lookup` yields an empty array and `$unwind` drops the key, so the row comes back with no property for the relation at all, not `null`. Decoding passes it through unchanged. No test covers this case. With `nullable: false` on the relation, the type says the related object is present and the runtime can hand back `undefined`.

**Next step:** Decide the read-time policy for contract deviations on Mongo (reject, coerce, or report) and where it lives in the runtime, then open a Linear project for it. The implementer's report on TML-3233 records what the Mongo ORM does today when a referenced document is missing; start from that.
