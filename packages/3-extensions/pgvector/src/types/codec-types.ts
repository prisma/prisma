/**
 * Codec type definitions for pgvector extension.
 *
 * This file exports type-only definitions for codec input/output types.
 * These types are imported by contract.d.ts files for compile-time type inference.
 *
 * Runtime codec implementations are provided by the extension's codec registry.
 */

import type { CodecTypes as CoreCodecTypes } from '../core/codecs';

/**
 * Type-level branded vector.
 *
 * The runtime values are plain number arrays, but parameterized column typing can
 * carry the dimension at the type level (e.g. Vector<1536>).
 */
export type Vector<N extends number = number> = number[] & { readonly __vectorLength?: N };

export type CodecTypes = CoreCodecTypes;
