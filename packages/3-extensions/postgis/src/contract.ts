/**
 * TS contract source for the `extension-postgis` package.
 *
 * Authored against the contract-space package layout convention. The
 * same emit pipeline application authors use is applied here:
 *
 *   `prisma-next contract emit` → `<package>/src/contract.{json,d.ts}`
 *   `prisma-next migration plan` → `<package>/migrations/<dirName>/`
 *
 * The descriptor at `src/exports/control.ts` then wires the emitted
 * JSON artefacts via JSON-import declarations.
 *
 * ## IR coverage
 *
 * postgis ships **no tables** of its own. The single object the
 * extension contributes to the contract IR is the parameterised native
 * type `geometry`, registered under `storage.types`. Per-column
 * instances on the user's side carry concrete `typeParams.srid`
 * (e.g. `geometry({ srid: 4326 })`); the registration here declares
 * the parameterised shape so the verifier sees `geometry` as part of
 * postgis's space contribution and so the pinned `contract.json` on
 * disk is materially distinct from an empty space.
 *
 * ## Why TS, not PSL
 *
 * The contract-space package layout convention prefers PSL
 * (`src/contract.prisma`). postgis is the same narrow exception
 * pgvector takes: PSL's `types {}` block instantiates parameterised
 * types at app authoring time (e.g. `Geom4326 = postgis.Geometry(4326)`)
 * but has no surface for an extension to register the parameterised
 * BASE type itself (the `storage.types.geometry` entry with empty
 * `typeParams` shown below). Until PSL grows that surface, this
 * extension keeps its contract source in TS.
 *
 * @see docs/architecture docs/adrs/ADR 212 - Contract spaces.md
 */

import { defineContract } from '@internal/postgres/contract-builder';
import { POSTGIS_GEOMETRY_CODEC_ID } from './core/constants';
import { POSTGIS_NATIVE_TYPE } from './core/contract-space-constants';

export const contract = defineContract({}, () => ({
  types: {
    [POSTGIS_NATIVE_TYPE]: {
      kind: 'codec-instance',
      codecId: POSTGIS_GEOMETRY_CODEC_ID,
      nativeType: POSTGIS_NATIVE_TYPE,
      typeParams: {},
    },
  },
  models: {},
}));

export default contract;
