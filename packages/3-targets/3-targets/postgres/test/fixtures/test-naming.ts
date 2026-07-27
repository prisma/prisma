import { namingFromFlat, type SqlObjectNaming } from '@prisma-next/sql-schema-ir/naming';

/**
 * Builds the naming union from flat test data, throwing on a
 * name/prefix mismatch with the same wording the load boundaries use.
 */
export function testNaming(name: string, prefix?: string | undefined): SqlObjectNaming {
  const naming = namingFromFlat(name, prefix);
  if (naming === undefined) {
    throw new Error(`"${name}": prefix "${prefix}" does not match the wire name`);
  }
  return naming;
}
