/** The data type this extension owns. A geometry is written as text, which it takes unchanged, and stored as HEXEWKB. ADR 254. */

import {
  type DataType,
  type DataTypeReader,
  readJsonMatching,
  refuseJsonValue,
} from '@internal/framework-components/codec';
import { sqlDataType } from '@internal/sql-contract/data-type';
import { pgText } from '@internal/target-postgres/data-types';
import { isInternalError } from '@internal/utils/internal-error';
import { type as arktype } from 'arktype';
import { decodeEWKBHex, encodeEWKBHex } from './ewkb';
import type { Geometry } from './geojson';

export const postgisGeometryParams = arktype({ 'srid?': 'number.integer >= 1' });

const HEX_TEXT = /^(?:[0-9A-Fa-f]{2})*$/;

/** The geometry HEXEWKB holds, or `undefined` when it is not EWKB. */
function geometryOf(hex: string): Geometry | undefined {
  try {
    return decodeEWKBHex(hex);
  } catch (error) {
    if (isInternalError(error)) throw error;
    return undefined;
  }
}

/**
 * A geometry has one spelling, the upper-case little-endian HEXEWKB PostGIS prints. A column with an SRID holds only geometries in that SRID, as PostGIS refuses any other.
 */
const readGeometry: DataTypeReader = (json, params) => {
  const hex = readJsonMatching('postgis/geometry', json, HEX_TEXT, 'a HEXEWKB string');
  const srid = params['srid'];
  const geometry = geometryOf(hex);
  if (geometry === undefined || (typeof srid === 'number' && geometry.srid !== srid)) {
    return refuseJsonValue(
      'postgis/geometry',
      typeof srid === 'number'
        ? `a HEXEWKB string of a geometry with SRID ${srid}`
        : 'a HEXEWKB string',
      json,
    );
  }
  const stored = encodeEWKBHex(geometry);
  if (stored === hex) return json;
  return refuseJsonValue(
    'postgis/geometry',
    `"${stored}", the HEXEWKB PostGIS prints for this geometry`,
    json,
  );
};

export const postgisGeometry = sqlDataType('postgis/geometry', {
  params: postgisGeometryParams,
  read: readGeometry,
  texts: [
    { text: 'geometry', written: true, catalog: true },
    {
      text: 'geometry(geometry,{srid})',
      written: true,
      catalog: true,
      display: 'geometry(Geometry,{srid})',
    },
  ],
  casts: { [pgText.id]: (value) => value },
});

export const postgisDataTypes: readonly DataType[] = [postgisGeometry];
