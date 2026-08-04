import { buildCodecDescriptorRegistry } from '@internal/sql-relational-core/codec-descriptor-registry';
import type { CodecDescriptorRegistry } from '@internal/sql-relational-core/query-lane-context';
import { codecDescriptors } from './arktype-json-codec';

/**
 * Registry of every codec descriptor shipped by `@internal/extension-arktype-json`.
 *
 * Public consumer surface for the arktype-json codec set. Currently a single entry (`arktype/json@1`); the registry shape stays consistent with the other codec-shipping packages so consumers don't need to special-case extensions. See ADR 208.
 */
export const arktypeJsonCodecRegistry: CodecDescriptorRegistry =
  buildCodecDescriptorRegistry(codecDescriptors);
