import { ifDefined } from '@internal/utils/defined';

export type OperationClass = 'table' | 'column' | 'primaryKey' | 'unique' | 'index' | 'foreignKey';

// SQLite's default (and only) schema name; keeps `SqlitePlanTargetDetails`
// conformant with `SqlPlanTargetDetails`, which mandates a `schema` field.
const DEFAULT_SCHEMA = 'main';

export interface SqlitePlanTargetDetails {
  readonly schema: string;
  readonly objectType: OperationClass;
  readonly name: string;
  readonly table?: string;
}

export interface PlanningMode {
  readonly includeExtraObjects: boolean;
  readonly allowWidening: boolean;
  readonly allowDestructive: boolean;
}

export function buildTargetDetails(
  objectType: OperationClass,
  name: string,
  table?: string,
): SqlitePlanTargetDetails {
  return {
    schema: DEFAULT_SCHEMA,
    objectType,
    name,
    ...ifDefined('table', table),
  };
}
