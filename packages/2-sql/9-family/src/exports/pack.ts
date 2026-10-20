import type { FamilyPackRef } from '@internal/framework-components/components';
import {
  type SqlExpression,
  sqlExpressionRegistration,
} from '@internal/sql-contract/sql-expression';
import { sqlAttributeSpecs } from '@internal/sql-contract-psl/attribute-specs';
import { sqlFamilyEntityTypes, sqlFamilyPslBlockDescriptors } from '../core/authoring-entity-types';
import { sqlFamilyAuthoringFieldPresets } from '../core/authoring-field-presets';
import { sqlFamilyAuthoringTypes } from '../core/authoring-type-constructors';
import {
  sqlFamilyGeneratorDescriptors,
  sqlFamilyGeneratorFunctions,
} from '../core/generator-functions';

export { sqlFamilyTypeConstructors } from '../core/authoring-type-constructors';
export { idGeneratorFunctionBindings } from '../core/generator-functions';

const sqlFamilyPackBase = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
  dataTypes: sqlExpressionRegistration.dataTypes,
  authoring: {
    field: sqlFamilyAuthoringFieldPresets,
    type: sqlFamilyAuthoringTypes,
    dataTypes: sqlExpressionRegistration.authoring.dataTypes,
    entityTypes: sqlFamilyEntityTypes,
    pslBlockDescriptors: sqlFamilyPslBlockDescriptors,
    attributeSpecs: sqlAttributeSpecs,
  },
  generatorFunctions: sqlFamilyGeneratorFunctions,
  controlMutationDefaults: {
    defaultFunctionRegistry: new Map(),
    generatorDescriptors: sqlFamilyGeneratorDescriptors,
  },
} as const satisfies FamilyPackRef<'sql'>;

const sqlFamilyPack: typeof sqlFamilyPackBase & {
  readonly __dataTypeArguments?: {
    readonly 'sql/expression': { readonly input: SqlExpression; readonly canonical: string };
  };
} = sqlFamilyPackBase;

export default sqlFamilyPack;
