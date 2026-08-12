import type { AuthoringTypeNamespace } from '@internal/framework-components/authoring';
import { POSTGIS_GEOMETRY_CODEC_ID } from './constants';

export const postgisAuthoringTypes = {
  postgis: {
    Geometry: {
      kind: 'typeConstructor',
      args: [{ kind: 'number', name: 'srid', integer: true, minimum: 0 }],
      output: {
        codecId: POSTGIS_GEOMETRY_CODEC_ID,
        nativeType: 'geometry',
        typeParams: {
          srid: { kind: 'arg', index: 0 },
        },
      },
    },
  },
} as const satisfies AuthoringTypeNamespace;
