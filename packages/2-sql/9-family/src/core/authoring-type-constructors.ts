import type { AuthoringTypeNamespace } from '@internal/framework-components/authoring';

export const sqlFamilyAuthoringTypes = {
  sql: {
    String: {
      kind: 'typeConstructor',
      args: [{ kind: 'number', name: 'length', integer: true, minimum: 1, maximum: 10485760 }],
      output: {
        codecId: 'sql/varchar@1',
        nativeType: 'character varying',
        typeParams: {
          length: { kind: 'arg', index: 0 },
        },
      },
    },
  },
} as const satisfies AuthoringTypeNamespace;
