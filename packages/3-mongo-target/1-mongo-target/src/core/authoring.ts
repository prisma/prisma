import {
  type AuthoringFieldNamespace,
  type AuthoringTypeNamespace,
  temporalAuthoringPresets,
  temporalCodecPreset,
  temporalTypeAliases,
} from '@internal/framework-components/authoring';
import { MONGO_DATE_CODEC_ID } from './codec-ids';

const mongoDateStorage = { codecId: MONGO_DATE_CODEC_ID } as const;

export const mongoAuthoringFieldPresets = {
  temporal: {
    ...temporalAuthoringPresets(mongoDateStorage),
    timestamp: temporalCodecPreset(mongoDateStorage),
  },
} as const satisfies AuthoringFieldNamespace;

export const mongoAuthoringTypes = {
  temporal: temporalTypeAliases(mongoDateStorage),
} as const satisfies AuthoringTypeNamespace;
