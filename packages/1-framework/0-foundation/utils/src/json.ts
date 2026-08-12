/**
 * Structural types for values that can be losslessly round-tripped through
 * `JSON.stringify` / `JSON.parse`.
 *
 * These are *structural* (no nominal brand): a value satisfying `JsonObject`
 * is guaranteed only to have JSON-stringifiable shape, not to carry any
 * particular semantic identity. Use these as the type of opaque "JSON-shaped"
 * data crossing API boundaries when the consumer needs the JSON-cleanness
 * promise but does not need a domain-specific shape.
 *
 * Notable consumers of `JsonObject` include the framework's
 * `ContractSerializer` SPI: `serializeContract` returns `JsonObject` so that
 * call sites can stringify, hash, or feed the result into another SPI without
 * re-asserting JSON-cleanness.
 */

export type JsonPrimitive = string | number | boolean | null;

export type JsonArray = readonly JsonValue[];

export type JsonObject = { readonly [key: string]: JsonValue };

export type JsonValue = JsonPrimitive | JsonArray | JsonObject;
