/**
 * Codec type definitions for the PostGIS extension.
 *
 * The runtime value carried for a `pg/geometry@1` cell is a GeoJSON-shaped
 * object — see `core/geojson.ts` for the variant union. The `Geometry`
 * type re-exported here is what `contract.d.ts` will reference; the
 * optional generic `<S>` carries SRID metadata at the type level for
 * dimensioned columns (e.g. `Geometry<4326>`).
 */

import type { CodecTypes as CoreCodecTypes } from '../core/codecs';
import type { Geometry as GeometryValue } from '../core/geojson';

export type Geometry<_Srid extends number = number> = GeometryValue;

export type CodecTypes = CoreCodecTypes;
