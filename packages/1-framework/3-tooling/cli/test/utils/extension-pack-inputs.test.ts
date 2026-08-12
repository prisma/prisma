import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import type { MigrationOps } from '@internal/migration-tools/package';
import { describe, expect, it } from 'vitest';
import type {
  DescriptorMigrationPackage,
  ExtensionPackInput,
} from '../../src/utils/extension-pack-inputs';
import {
  toDeclaredExtensions,
  toDeclaredExtensionsFromRaw,
  toExtensionInputs,
} from '../../src/utils/extension-pack-inputs';

const contractJsonA = { kind: 'sql-contract', tables: { a: {} } } as const;
const contractJsonB = { kind: 'sql-contract', tables: { b: {} } } as const;

const packWithoutSpace = {
  id: 'ext-no-space',
  targetId: 'postgres',
} as const;

// The pack helpers under test do not introspect the package contents — they
// only pass references through. Use empty-cast stubs for the typed slots.
const STUB_METADATA = {} as MigrationMetadata;
const STUB_OPS = {} as MigrationOps;
const migrationPkg: DescriptorMigrationPackage = {
  dirName: '0000000001-init',
  metadata: STUB_METADATA,
  ops: STUB_OPS,
};

const packWithSpace = {
  id: 'ext-with-space',
  targetId: 'postgres',
  contractSpace: {
    contractJson: contractJsonA,
    headRef: { hash: 'c1', invariants: ['inv-1'] },
    migrations: [migrationPkg],
  },
} as const;

const packWithSpaceNoMigrationsField = {
  id: 'ext-no-migrations',
  targetId: 'postgres',
  contractSpace: {
    contractJson: contractJsonB,
    headRef: { hash: 'c2', invariants: [] },
  },
} as const;

describe('toExtensionInputs', () => {
  it('passes packs without contractSpace through with id + targetId only', () => {
    const out = toExtensionInputs([packWithoutSpace]);
    expect(out).toEqual([{ id: 'ext-no-space', targetId: 'postgres' }]);
  });

  it('projects contractSpace and preserves the migrations array', () => {
    const out = toExtensionInputs([packWithSpace]);
    expect(out).toEqual([
      {
        id: 'ext-with-space',
        targetId: 'postgres',
        contractSpace: {
          contractJson: contractJsonA,
          headRef: { hash: 'c1', invariants: ['inv-1'] },
          migrations: [migrationPkg],
        },
      },
    ]);
  });

  it('defaults missing migrations to []', () => {
    const out = toExtensionInputs([packWithSpaceNoMigrationsField]);
    expect(out[0]?.contractSpace?.migrations).toEqual([]);
  });

  it('preserves contractJson reference identity (loader maps keyed on this)', () => {
    const out = toExtensionInputs([packWithSpace]);
    expect(out[0]?.contractSpace?.contractJson).toBe(contractJsonA);
  });
});

describe('toDeclaredExtensions', () => {
  it('filters out packs without a contractSpace declaration', () => {
    const inputs: ExtensionPackInput[] = [{ id: 'plain', targetId: 'postgres' }];
    expect(toDeclaredExtensions(inputs)).toEqual([]);
  });

  it('emits entries with id + targetId only for contract-space-bearing packs', () => {
    const inputs: ExtensionPackInput[] = [
      {
        id: 'ext-with-space',
        targetId: 'postgres',
        contractSpace: {
          contractJson: contractJsonA,
          headRef: { hash: 'c1', invariants: [] },
          migrations: [],
        },
      },
    ];
    expect(toDeclaredExtensions(inputs)).toEqual([{ id: 'ext-with-space', targetId: 'postgres' }]);
  });
});

describe('toDeclaredExtensionsFromRaw', () => {
  it('skips packs whose contractSpace own-property value is explicitly undefined', () => {
    const raw = { id: 'ext-undefined-space', targetId: 'postgres', contractSpace: undefined };
    expect(toDeclaredExtensionsFromRaw([raw])).toEqual([]);
  });

  it('skips packs with no own contractSpace property', () => {
    expect(toDeclaredExtensionsFromRaw([packWithoutSpace])).toEqual([]);
  });

  it('skips non-object entries (null and primitives)', () => {
    expect(toDeclaredExtensionsFromRaw([null, 0, 'x'])).toEqual([]);
  });

  it('emits entries for data-property contractSpace declarations', () => {
    expect(toDeclaredExtensionsFromRaw([packWithSpace])).toEqual([
      { id: 'ext-with-space', targetId: 'postgres' },
    ]);
  });

  it('includes packs whose contractSpace is a getter without invoking it', () => {
    let invoked = false;
    const pack = Object.defineProperty(
      { id: 'ext-getter', targetId: 'postgres' },
      'contractSpace',
      {
        get() {
          invoked = true;
          throw new Error('contractSpace getter must not be invoked');
        },
        enumerable: true,
        configurable: true,
      },
    );
    expect(toDeclaredExtensionsFromRaw([pack])).toEqual([
      { id: 'ext-getter', targetId: 'postgres' },
    ]);
    expect(invoked).toBe(false);
  });
});
