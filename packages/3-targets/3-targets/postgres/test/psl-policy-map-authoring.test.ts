/**
 * PSL `@@map` on policy blocks lowers an EXACT-named policy: `name` is the
 * map value verbatim, no `prefix`, no content hash, and no wire-prefix
 * length cap (an exact name is a verbatim physical name, same stance as
 * index `map:`). The block-head identifier stays the source-level logical
 * key — head-keyed duplicate checking is byte-unchanged — and every `@@map`
 * policy pushes a D9 warning into the same per-build batch as indexes (one
 * flush covering both).
 */

import { assembleAuthoringContributions } from '@prisma-next/framework-components/control';
import { buildSymbolTable } from '@prisma-next/psl-parser';
import { parse } from '@prisma-next/psl-parser/syntax';
import { interpretPslDocumentToSqlContract } from '@prisma-next/sql-contract-psl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  postgresAuthoringEntityTypes,
  postgresAuthoringModelAttributes,
  postgresAuthoringPslBlockDescriptors,
} from '../src/core/authoring';
import { PostgresRlsPolicy } from '../src/core/postgres-rls-policy';
import type { PostgresSchema } from '../src/core/postgres-schema';
import { postgresCreateNamespace } from '../src/core/postgres-schema';

const assembled = assembleAuthoringContributions([
  {
    authoring: {
      entityTypes: postgresAuthoringEntityTypes,
      pslBlockDescriptors: postgresAuthoringPslBlockDescriptors,
      modelAttributes: postgresAuthoringModelAttributes,
    },
  },
]);

const postgresTarget = {
  kind: 'target' as const,
  familyId: 'sql' as const,
  targetId: 'postgres' as const,
  id: 'postgres',
  version: '0.0.1',
  capabilities: {},
  defaultNamespaceId: 'public',
};

const scalarColumnDescriptors = new Map<string, { codecId: string; nativeType: string }>([
  ['String', { codecId: 'pg/text@1', nativeType: 'text' }],
  ['Int', { codecId: 'pg/int4@1', nativeType: 'int4' }],
]);

function interpret(source: string) {
  const { document, sourceFile } = parse(source);
  const { table: symbolTable, diagnostics } = buildSymbolTable({
    document,
    sourceFile,
    pslBlockDescriptors: assembled.pslBlockDescriptors,
  });
  expect(diagnostics).toEqual([]);
  return interpretPslDocumentToSqlContract({
    symbolTable,
    sourceFile,
    sourceId: 'schema.prisma',
    target: postgresTarget,
    scalarColumnDescriptors,
    authoringContributions: assembled,
    composedExtensionContracts: new Map(),
    createNamespace: postgresCreateNamespace,
    capabilities: { sql: { scalarList: true } },
  });
}

function policyDoc(policyBlocks: string, modelAttributes = ''): string {
  return `
namespace public {
  model profile {
    id       Int @id
    owner_id Int
    email    String

    @@rls
${modelAttributes}
  }

${policyBlocks}
}
`;
}

function publicNamespace(result: ReturnType<typeof interpret>): PostgresSchema {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('interpretation failed');
  return result.value.storage.namespaces['public'] as PostgresSchema;
}

describe('@@map lowers an exact-named policy', () => {
  const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
  afterEach(() => {
    emitWarning.mockClear();
  });

  it('name is the map value verbatim, prefix absent, no hash, keyed by the head', () => {
    const result = interpret(
      policyDoc(`
  policy_select p_read {
    target = profile
    roles  = [app_user]
    using  = "owner_id = current_setting('app.uid')::int"
    @@map("Tenant members can read")
  }
`),
    );
    const ns = publicNamespace(result);
    expect(Object.keys(ns.policy)).toEqual(['p_read']);
    const policy = ns.policy['p_read'];
    expect(policy).toBeInstanceOf(PostgresRlsPolicy);
    expect(policy?.name).toBe('Tenant members can read');
    expect(policy?.prefix).toBeUndefined();
    expect(Object.hasOwn(policy ?? {}, 'prefix')).toBe(false);
    expect(policy?.using).toBe("owner_id = current_setting('app.uid')::int");
  });

  it('a map value over the 54-character wire-prefix cap lowers fine (exact names are uncapped)', () => {
    const longName = 'x'.repeat(60);
    const result = interpret(
      policyDoc(`
  policy_select p_read {
    target = profile
    roles  = [app_user]
    using  = "owner_id = 1"
    @@map("${longName}")
  }
`),
    );
    const ns = publicNamespace(result);
    expect(ns.policy['p_read']?.name).toBe(longName);
  });

  it('two blocks with distinct heads sharing one map value both lower without a duplicate diagnostic', () => {
    const result = interpret(
      policyDoc(`
  policy_select p_read {
    target = profile
    roles  = [app_user]
    using  = "owner_id = 1"
    @@map("shared physical name")
  }

  policy_update p_write {
    target = profile
    roles  = [app_user]
    using  = "owner_id = 1"
    @@map("shared physical name")
  }
`),
    );
    const ns = publicNamespace(result);
    expect(Object.keys(ns.policy).sort()).toEqual(['p_read', 'p_write']);
  });

  it('two reopened spellings sharing one head stay a duplicate-entity diagnostic (head-keyed)', () => {
    const result = interpret(`
namespace public {
  model profile {
    id       Int @id
    owner_id Int
    email    String

    @@rls
  }

  policy_select p_read {
    target = profile
    roles  = [app_user]
    using  = "owner_id = 1"
    @@map("first physical name")
  }
}

policy_select p_read {
  target = profile
  roles  = [app_user]
  using  = "owner_id = 1"
  @@map("second physical name")
}
`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'PSL_DUPLICATE_EXTENSION_ENTITY',
        message: expect.stringContaining('p_read'),
      }),
    );
  });

  it('an argument-less @@map() is PSL_POLICY_INVALID_MAP and the policy is skipped', () => {
    const result = interpret(
      policyDoc(`
  policy_select p_read {
    target = profile
    roles  = [app_user]
    using  = "owner_id = 1"
    @@map()
  }
`),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'PSL_POLICY_INVALID_MAP',
        message:
          '`policy_select` policy "p_read" @@map attribute must have a quoted policy-name argument',
        span: expect.anything(),
      }),
    );
  });

  it('without @@map the managed lowering is unchanged — head prefix, wire name', () => {
    const result = interpret(
      policyDoc(`
  policy_select p_read {
    target = profile
    roles  = [app_user]
    using  = "owner_id = 1"
  }
`),
    );
    const ns = publicNamespace(result);
    const policy = ns.policy['p_read'];
    expect(policy?.prefix).toBe('p_read');
    expect(policy?.name).toMatch(/^p_read_[0-9a-f]{8}$/);
    expect(
      emitWarning.mock.calls.filter(
        ([, options]) =>
          (options as { code?: string } | undefined)?.code === 'PN_EXACT_NAME_BODY_COMPARISON',
      ),
    ).toEqual([]);
  });
});

describe('D9 warning for @@map policies — shared per-build batch with indexes', () => {
  const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
  afterEach(() => {
    emitWarning.mockClear();
  });

  function d9Calls() {
    return emitWarning.mock.calls.filter(
      ([, options]) =>
        (options as { code?: string } | undefined)?.code === 'PN_EXACT_NAME_BODY_COMPARISON',
    );
  }

  it('an @@map policy warns once, naming the policy subject and exact name', () => {
    interpret(
      policyDoc(`
  policy_select p_read {
    target = profile
    roles  = [app_user]
    using  = "owner_id = 1"
    @@map("Tenant members can read")
  }
`),
    );
    const calls = d9Calls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toContain('policy "Tenant members can read" uses map: with a SQL body.');
  });

  it('over-threshold mixed index + policy warnings collapse into ONE summary flush', () => {
    const indexAttributes = [1, 2, 3, 4]
      .map((n) => `    @@index([email], where: "(owner_id = ${n})", map: "adopted_idx_${n}")`)
      .join('\n');
    interpret(
      policyDoc(
        `
  policy_select p_read {
    target = profile
    roles  = [app_user]
    using  = "owner_id = 1"
    @@map("adopted select policy")
  }

  policy_update p_write {
    target = profile
    roles  = [app_user]
    using  = "owner_id = 1"
    @@map("adopted update policy")
  }
`,
        indexAttributes,
      ),
    );
    const calls = d9Calls();
    expect(calls).toHaveLength(1);
    const message = String(calls[0]?.[0]);
    expect(message).toContain('6 objects use map: with a SQL body.');
    expect(message).toContain('index "adopted_idx_1"');
    expect(message).toContain('policy "adopted select policy"');
    expect(message).toContain('policy "adopted update policy"');
  });
});
