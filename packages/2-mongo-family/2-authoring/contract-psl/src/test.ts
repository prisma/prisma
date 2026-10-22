import type { ContractSourceContext } from '@internal/config/config-types';
import type { InterpretPslDocumentToMongoContractInput } from './interpreter';

export type MongoContextInput = Pick<
  InterpretPslDocumentToMongoContractInput,
  | 'defaultFunctionRegistry'
  | 'generatorFunctions'
  | 'dataTypes'
  | 'codecLookup'
  | 'authoringContributions'
  | 'reportWarning'
>;

export function mongoContextInput(context: ContractSourceContext): MongoContextInput {
  return {
    defaultFunctionRegistry: context.controlMutationDefaults.defaultFunctionRegistry,
    generatorFunctions: context.generatorFunctions,
    dataTypes: context.dataTypes,
    codecLookup: context.codecLookup,
    authoringContributions: context.authoringContributions,
    ...(context.reportWarning ? { reportWarning: context.reportWarning } : {}),
  };
}
