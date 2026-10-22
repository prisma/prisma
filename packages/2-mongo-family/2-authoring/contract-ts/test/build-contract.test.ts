import { assembleDataTypeSupport } from '@internal/framework-components/authoring';
import { extractCodecLookup } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import type { MongoContract } from '@internal/mongo-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMongoContractFromDefinition } from '../src/build-contract';
import { defineContract, field, index, model } from '../src/contract-builder';
import type { ContractDefinition, ModelNode } from '../src/contract-definition';
import { mongoFamilyPack, mongoTargetPack } from './mongo-test-packs';

const codecLookup = extractCodecLookup([mongoFamilyPack, mongoTargetPack]);
const { support: dataTypes } = assembleDataTypeSupport(
  [mongoFamilyPack, mongoTargetPack],
  (codecId) => codecLookup.descriptorFor(codecId)?.dataType,
);
const objectIdType = field.objectId().__type;
const stringType = field.string().__type;

const taskModels: readonly ModelNode[] = [
  {
    modelName: 'Task',
    collection: 'tasks',
    indexes: [{ fields: { title: 1 } }],
    fields: [
      { fieldName: '_id', type: objectIdType, nullable: false, many: false },
      { fieldName: 'type', type: stringType, nullable: false, many: false },
      { fieldName: 'title', storedName: 't', type: stringType, nullable: false, many: false },
    ],
    discriminator: { field: 'type' },
  },
  {
    modelName: 'Bug',
    collection: 'tasks',
    indexes: [{ fields: { severity: 1 } }],
    fields: [{ fieldName: 'severity', type: stringType, nullable: false, many: false }],
    base: { model: 'Task', value: { kind: 'string', text: 'bug' } },
  },
];

function definitionOf(overrides: Partial<ContractDefinition>): ContractDefinition {
  return {
    family: mongoFamilyPack,
    target: mongoTargetPack,
    models: taskModels,
    collectionValidators: true,
    warnings: undefined,
    ...overrides,
  };
}

function hasValidator(contract: MongoContract, collection: string): boolean {
  const collections = contract.storage.namespaces[UNBOUND_NAMESPACE_ID]?.entries['collection'];
  return 'validator' in (collections?.[collection] ?? {});
}

describe('buildMongoContractFromDefinition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the contract defineContract builds from the same models', () => {
    const Task = model('Task', {
      collection: 'tasks',
      fields: {
        _id: field.objectId(),
        type: field.string(),
        title: field.string().mongo({ field: 't' }),
      },
      indexes: [index({ title: 1 })],
      discriminator: { field: 'type', variants: { Bug: { value: 'bug' } } },
    });
    const Bug = model('Bug', {
      collection: 'tasks',
      base: Task,
      fields: { severity: field.string() },
      indexes: [index({ severity: 1 })],
    });

    expect(buildMongoContractFromDefinition(definitionOf({}), codecLookup, dataTypes)).toEqual(
      defineContract({ family: mongoFamilyPack, target: mongoTargetPack, models: { Task, Bug } }),
    );
  });

  it('gives collections no validator when the definition says so', () => {
    const withValidators = buildMongoContractFromDefinition(
      definitionOf({}),
      codecLookup,
      dataTypes,
    );
    const withoutValidators = buildMongoContractFromDefinition(
      definitionOf({ collectionValidators: false }),
      codecLookup,
      dataTypes,
    );

    expect({
      with: hasValidator(withValidators, 'tasks'),
      without: hasValidator(withoutValidators, 'tasks'),
    }).toEqual({ with: true, without: false });
  });

  it('reports the warnings the definition carries', () => {
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

    buildMongoContractFromDefinition(
      definitionOf({
        warnings: [
          {
            code: 'TEST_WARNING',
            message: 'a warning from the source',
            item: 'source',
            summary: 'warnings from the source',
          },
        ],
      }),
      codecLookup,
      dataTypes,
    );

    expect(emitWarning.mock.calls).toEqual([
      ['a warning from the source', { code: 'TEST_WARNING' }],
    ]);
  });
});
