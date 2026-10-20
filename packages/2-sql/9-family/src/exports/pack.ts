import type { FamilyPackRef } from '@internal/framework-components/components';
import { sqlAttributeSpecs } from '@internal/sql-contract-psl/attribute-specs';
import { sqlFamilyEntityTypes, sqlFamilyPslBlockDescriptors } from '../core/authoring-entity-types';
import { sqlFamilyAuthoringFieldPresets } from '../core/authoring-field-presets';
import { sqlFamilyAuthoringTypes } from '../core/authoring-type-constructors';
import {
  sqlFamilyGeneratorDescriptors,
  sqlFamilyGeneratorFunctions,
} from '../core/generator-functions';

export {
  idGeneratorFunctionBindings,
  sqlIntegerArgumentGeneratorFunctions,
} from '../core/generator-functions';

const sqlFamilyPack = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
  authoring: {
    field: sqlFamilyAuthoringFieldPresets,
    type: sqlFamilyAuthoringTypes,
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

export default sqlFamilyPack;
