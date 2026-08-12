import { describe, expect, it } from 'vitest';
import type {
  RuntimeAdapterDescriptor,
  RuntimeExtensionDescriptor,
  RuntimeFamilyDescriptor,
  RuntimeTargetDescriptor,
} from '../src/execution/execution-descriptors';
import { assertRuntimeContractRequirementsSatisfied } from '../src/execution/execution-requirements';

describe('assertRuntimeContractRequirementsSatisfied', () => {
  const family: RuntimeFamilyDescriptor<'sql'> = {
    kind: 'family',
    id: 'sql',
    familyId: 'sql',
    version: '0.0.1',
    create: () => ({ familyId: 'sql' }),
  };

  const target: RuntimeTargetDescriptor<'sql', 'postgres'> = {
    kind: 'target',
    id: 'postgres',
    familyId: 'sql',
    targetId: 'postgres',
    version: '0.0.1',
    create: () => ({ familyId: 'sql', targetId: 'postgres' }),
  };

  const adapter: RuntimeAdapterDescriptor<'sql', 'postgres'> = {
    kind: 'adapter',
    id: 'postgres-adapter',
    familyId: 'sql',
    targetId: 'postgres',
    version: '0.0.1',
    create: () => ({ familyId: 'sql', targetId: 'postgres' }),
  };

  it('does nothing when requirements are satisfied', () => {
    const extensions: RuntimeExtensionDescriptor<'sql', 'postgres'>[] = [
      {
        kind: 'extension',
        id: 'pgvector',
        familyId: 'sql',
        targetId: 'postgres',
        version: '1.0.0',
        create: () => ({ familyId: 'sql', targetId: 'postgres', id: 'pgvector' }),
      },
    ];

    expect(() =>
      assertRuntimeContractRequirementsSatisfied({
        contract: { target: 'postgres', extensions: { pgvector: {} } },
        family,
        target,
        adapter,
        extensions,
      }),
    ).not.toThrow();
  });

  it('throws when contract target mismatches runtime target descriptor', () => {
    expect(() =>
      assertRuntimeContractRequirementsSatisfied({
        contract: { target: 'mysql' },
        family,
        target,
        adapter,
        extensions: [],
      }),
    ).toThrow(`Contract target 'mysql' does not match runtime target descriptor 'postgres'.`);
  });

  it('throws when required extension pack is missing', () => {
    expect(() =>
      assertRuntimeContractRequirementsSatisfied({
        contract: { target: 'postgres', extensions: { pgvector: {} } },
        family,
        target,
        adapter,
        extensions: [],
      }),
    ).toThrow(
      `Contract requires extension pack 'pgvector', but runtime descriptors do not provide a matching component.`,
    );
  });
});
