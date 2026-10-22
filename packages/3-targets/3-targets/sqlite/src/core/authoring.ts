import { sqlTargetTypeConstructors } from '@internal/family-sql/pack';
import type {
  AuthoringFieldNamespace,
  AuthoringTypeNamespace,
} from '@internal/framework-components/authoring';
import {
  temporalAuthoringPresets,
  temporalCodecPreset,
  temporalTypeAliases,
} from '@internal/framework-components/authoring';
export const sqliteAuthoringTypes = {
  .../* @__PURE__ */ sqlTargetTypeConstructors({ sizeType: 'sqlite/real' }),
  BigIntNumber: {
    kind: 'typeConstructor',
    documentation:
      'A SQLite integer represented as a JavaScript number within its safe integer range.',
    output: {
      codecId: 'sqlite/bigintnumber@1',
    },
  },
  temporal: /* @__PURE__ */ temporalTypeAliases(
    { codecId: 'sqlite/datetime@1' },
    'a JavaScript Date',
  ),
} as const satisfies AuthoringTypeNamespace;

export const sqliteAuthoringFieldPresets = {
  temporal: {
    .../* @__PURE__ */ temporalAuthoringPresets({
      codecId: 'sqlite/datetime@1',
    }),
    datetime: /* @__PURE__ */ temporalCodecPreset({
      codecId: 'sqlite/datetime@1',
    }),
  },
} as const satisfies AuthoringFieldNamespace;
