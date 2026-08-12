/**
 * Control-plane extension descriptor for arktype-json.
 *
 * Composes pack metadata and the control-plane hooks into the migration-
 * plane shape the framework's control stack consumes. Lives at the
 * control-plane entrypoint so `src/core/**` stays free of migration-plane
 * imports (per `.cursor/rules/multi-plane-entrypoints.mdc`).
 *
 * Unlike pgvector, arktype-json has no database extension to install
 * (`jsonb` is a built-in Postgres type), no contract space, no query
 * operations, and the only control-plane hook is the identity
 * `expandNativeType` (jsonb is dimension-free; the schema in typeParams
 * affects runtime validation only, never DDL).
 */

import type {
  CodecControlHooks,
  SqlControlExtensionDescriptor,
} from '@internal/family-sql/control';
import { ARKTYPE_JSON_CODEC_ID } from '../core/arktype-json-codec';
import { arktypeJsonPackMeta } from '../core/pack-meta';

const arktypeJsonControlPlaneHooks: CodecControlHooks = {
  expandNativeType: ({ nativeType }) => nativeType,
};

export const arktypeJsonExtensionDescriptor: SqlControlExtensionDescriptor<'postgres'> = {
  ...arktypeJsonPackMeta,
  types: {
    ...arktypeJsonPackMeta.types,
    codecTypes: {
      ...arktypeJsonPackMeta.types.codecTypes,
      controlPlaneHooks: {
        [ARKTYPE_JSON_CODEC_ID]: arktypeJsonControlPlaneHooks,
      },
    },
  },
  create: () => ({
    familyId: 'sql' as const,
    targetId: 'postgres' as const,
  }),
};

export default arktypeJsonExtensionDescriptor;
