import type { ContractSourceContext } from '@internal/config/config-types';
import { collectScalarTypeConstructors } from '@internal/framework-components/authoring';
import type { InterpretPslDocumentToMongoContractInput } from './interpreter';

export type MongoContextInput = Pick<
  InterpretPslDocumentToMongoContractInput,
  | 'target'
  | 'scalarTypeCodecIds'
  | 'defaultFunctionRegistry'
  | 'generatorFunctions'
  | 'dataTypes'
  | 'codecLookup'
  | 'authoringContributions'
  | 'reportWarning'
>;

/** A MongoDB target pack with nothing in it but its identity, for tests that interpret a schema without the real stack. */
export const mongoTestStack = {
  target: {
    kind: 'target',
    id: 'mongo',
    familyId: 'mongo',
    targetId: 'mongo',
    version: '0.0.1',
    defaultNamespaceId: '__unbound__',
  },
} as const satisfies Pick<MongoContextInput, 'target'>;

export function mongoContextInput(
  context: ContractSourceContext,
  stack: Pick<MongoContextInput, 'target'> = mongoTestStack,
): MongoContextInput {
  return {
    ...stack,
    scalarTypeCodecIds: new Map(
      [...collectScalarTypeConstructors(context.authoringContributions.type)].map(
        ([name, output]) => [name, output.codecId],
      ),
    ),
    defaultFunctionRegistry: context.controlMutationDefaults.defaultFunctionRegistry,
    generatorFunctions: context.generatorFunctions,
    dataTypes: context.dataTypes,
    codecLookup: context.codecLookup,
    authoringContributions: context.authoringContributions,
    ...(context.reportWarning ? { reportWarning: context.reportWarning } : {}),
  };
}
