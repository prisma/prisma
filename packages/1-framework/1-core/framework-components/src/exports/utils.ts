/**
 * Family-agnostic utilities consumed across the framework. Currently exposes the JSON canonicaliser used to derive stable cache keys from `JsonValue`-shaped data (e.g. {@link CodecRef.typeParams}).
 */

export { canonicalizeJson } from '../utils/canonicalize-json';
