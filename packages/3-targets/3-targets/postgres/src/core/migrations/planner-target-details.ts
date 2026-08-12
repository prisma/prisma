import { ifDefined } from '@internal/utils/defined';

export type OperationClass =
  | 'dependency'
  | 'type'
  | 'table'
  | 'column'
  | 'primaryKey'
  | 'unique'
  | 'index'
  | 'foreignKey'
  | 'checkConstraint'
  | 'rlsPolicy'
  | 'rowLevelSecurity';

export interface PostgresPlanTargetDetails {
  readonly schema: string;
  readonly objectType: OperationClass;
  readonly name: string;
  readonly table?: string;
}

export function buildTargetDetails(
  objectType: OperationClass,
  name: string,
  schema: string,
  table?: string,
): PostgresPlanTargetDetails {
  return {
    schema,
    objectType,
    name,
    ...ifDefined('table', table),
  };
}
