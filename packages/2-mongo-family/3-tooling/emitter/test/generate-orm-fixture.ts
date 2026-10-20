import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Contract, coreHash, crossRef, profileHash } from '@internal/contract/types';
import { generateContractDts } from '@internal/emitter';
import { blindCast } from '@internal/utils/casts';
import ormContractJson from '../../../1-foundation/mongo-contract/test/fixtures/orm-contract.json';
import storedNamesContractJson from '../../../5-query-builders/orm/test/fixtures/stored-names-contract.json';
import { mongoEmission } from '../src/index';

const codecImports = [
  {
    package: '@internal/target-mongo/codec-types',
    named: 'CodecTypes',
    alias: 'MongoCodecTypes',
  },
];

function fixtureContract(
  json: typeof ormContractJson | typeof storedNamesContractJson,
  hash: string,
) {
  return {
    ...json,
    target: 'mongo',
    profileHash: profileHash(`${hash}-profile`),
    roots: Object.fromEntries(
      Object.entries(json.roots).map(([key, ref]) => [key, crossRef(ref.model, ref.namespace)]),
    ),
    domain: blindCast<
      Contract['domain'],
      'the fixture JSON is a real emitted fixture; its cross-references carry plain-string namespace ids because JSON has no branded NamespaceId, same as any contract deserialized from disk'
    >(json.domain),
    storage: {
      ...json.storage,
      storageHash: coreHash(`${hash}-storage`),
    },
    capabilities: {},
    extensions: {},
    meta: {},
  } as Contract;
}

const fixturesDir = resolve(
  import.meta.dirname,
  '../../../1-foundation/mongo-contract/test/fixtures',
);

const outputs = [
  {
    output: generateContractDts(
      fixtureContract(ormContractJson, 'orm'),
      mongoEmission,
      codecImports,
      {
        storageHash: 'orm-storage',
        profileHash: 'orm-profile',
      },
    ),
    targets: [
      resolve(fixturesDir, 'orm-contract.d.ts'),
      resolve(import.meta.dirname, '../../../9-family/test/fixtures/orm-contract.d.ts'),
    ],
  },
  {
    output: generateContractDts(
      fixtureContract(storedNamesContractJson, 'stored-names'),
      mongoEmission,
      codecImports,
      { storageHash: 'stored-names-storage', profileHash: 'stored-names-profile' },
    ),
    targets: [
      resolve(
        import.meta.dirname,
        '../../../5-query-builders/orm/test/fixtures/stored-names-contract.d.ts',
      ),
    ],
  },
];

for (const { output, targets } of outputs) {
  for (const target of targets) {
    writeFileSync(target, output);
    console.log(`Generated ${target}`);
  }
}
