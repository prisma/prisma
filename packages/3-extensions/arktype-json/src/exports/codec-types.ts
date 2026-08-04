/**
 * Codec type definitions for the arktype-json extension.
 *
 * Re-export from types module for public API. The pack-meta references
 * this entrypoint via `import: { package:
 * '@internal/extension-arktype-json/codec-types' }` so the emitter
 * threads `CodecTypes` into `contract.d.ts`.
 */

export type { CodecTypes } from '../types/codec-types';
