import { temporalAuthoringPresets, temporalCodecPreset } from '@internal/family-sql/control';
import type { AuthoringFieldNamespace } from '@internal/framework-components/authoring';

export const sqliteAuthoringFieldPresets = {
  bigIntNumber: {
    kind: 'fieldPreset',
    output: {
      codecId: 'sqlite/bigintnumber@1',
      nativeType: 'integer',
    },
  },
  temporal: {
    .../* @__PURE__ */ temporalAuthoringPresets({
      codecId: 'sqlite/datetime@1',
      nativeType: 'text',
    }),
    datetime: /* @__PURE__ */ temporalCodecPreset({
      codecId: 'sqlite/datetime@1',
      nativeType: 'text',
    }),
  },
} as const satisfies AuthoringFieldNamespace;
