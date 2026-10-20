import type { AuthoringTypeNamespace } from '@internal/framework-components/authoring';

export const sqlFamilyAuthoringTypes = {
  Raw: {
    kind: 'typeConstructor',
    documentation:
      'A column of a type no other column type covers, written exactly as the database catalog prints it, such as Raw(sql`tsvector`). Its values are typed unknown, and its default is a sql expression.',
    args: [{ kind: 'value', dataType: 'sql/expression', name: 'sql' }],
    output: {
      codecId: 'sql/raw@1',
      typeParams: { sql: { kind: 'arg', index: 0 } },
    },
  },
} as const satisfies AuthoringTypeNamespace;

/**
 * The type constructors every SQL target shares whose arguments are numbers. A target contributes them with `wholeNumber`, the data type whose values are its whole-number arguments, such as `pg/int4`.
 */
export function sqlFamilyTypeConstructors<const WholeNumber extends string>(input: {
  readonly wholeNumber: WholeNumber;
}) {
  return {
    sql: {
      String: {
        kind: 'typeConstructor',
        documentation: 'Variable-length text with a required maximum character length.',
        args: [{ kind: 'value', dataType: input.wholeNumber, name: 'length' }],
        output: {
          codecId: 'sql/varchar@1',
          typeParams: {
            length: { kind: 'arg', index: 0 },
          },
        },
      },
    },
  } as const satisfies AuthoringTypeNamespace;
}
