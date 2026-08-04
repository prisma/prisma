import { coreHash } from '@internal/contract/types';
import type { SchemaDiffIssue, SchemaVerifyOptions } from '@internal/framework-components/control';
import type { Namespace } from '@internal/framework-components/ir';
import { MongoStorage } from '@internal/mongo-contract';
import { describe, expect, it } from 'vitest';
import { MongoSchemaVerifierBase } from '../src/core/ir/mongo-schema-verifier-base';

class FakeNamespace implements Namespace {
  readonly kind = 'fake-namespace' as const;
  readonly entries = {};
  constructor(readonly id: string) {}
}

function makeFakeStorage(namespaces: Readonly<Record<string, Namespace>>): MongoStorage {
  return new MongoStorage({
    storageHash: coreHash('fake-hash'),
    namespaces,
  });
}

interface FakeContract {
  readonly storage: MongoStorage;
}

interface FakeSchema {
  readonly tag: string;
}

interface DispatchRecord {
  readonly namespaceId: string;
  readonly schemaTag: string;
}

class RecordingVerifier extends MongoSchemaVerifierBase<FakeContract, FakeSchema> {
  readonly dispatches: DispatchRecord[] = [];
  readonly targetExtensionCalls: Array<SchemaVerifyOptions<FakeContract, FakeSchema>> = [];

  constructor(
    private readonly issuesByNamespace: Readonly<Record<string, readonly SchemaDiffIssue[]>> = {},
    private readonly targetExtensionIssues: readonly SchemaDiffIssue[] = [],
  ) {
    super();
  }

  protected verifyNamespace(options: {
    readonly contract: FakeContract;
    readonly schema: FakeSchema;
    readonly namespaceId: string;
    readonly namespace: Namespace;
  }): readonly SchemaDiffIssue[] {
    this.dispatches.push({
      namespaceId: options.namespaceId,
      schemaTag: options.schema.tag,
    });
    return this.issuesByNamespace[options.namespaceId] ?? [];
  }

  protected verifyTargetExtensions(
    options: SchemaVerifyOptions<FakeContract, FakeSchema>,
  ): readonly SchemaDiffIssue[] {
    this.targetExtensionCalls.push(options);
    return this.targetExtensionIssues;
  }
}

function buildOptions(
  namespaceIds: readonly string[],
): SchemaVerifyOptions<FakeContract, FakeSchema> {
  const entries = namespaceIds.map((id) => [id, new FakeNamespace(id)] as const);
  return {
    contract: { storage: makeFakeStorage(Object.fromEntries(entries)) },
    schema: { tag: 'live-schema' },
  };
}

describe('MongoSchemaVerifierBase', () => {
  describe('verifyCommonMongoSchema (family-shared scaffolding)', () => {
    it('dispatches verifyNamespace for every namespace in storage', () => {
      const verifier = new RecordingVerifier();

      verifier.verifySchema(buildOptions(['__unbound__', 'auth']));

      expect(verifier.dispatches.map((d) => d.namespaceId)).toEqual(['__unbound__', 'auth']);
    });

    it('dispatches namespaces in sorted order so issue ordering is stable', () => {
      const verifier = new RecordingVerifier();

      verifier.verifySchema(buildOptions(['zeta', 'alpha', 'mu']));

      expect(verifier.dispatches.map((d) => d.namespaceId)).toEqual(['alpha', 'mu', 'zeta']);
    });

    it('forwards contract + schema to every namespace hook', () => {
      const verifier = new RecordingVerifier();

      verifier.verifySchema(buildOptions(['__unbound__']));

      expect(verifier.dispatches).toHaveLength(1);
      expect(verifier.dispatches[0]!.schemaTag).toBe('live-schema');
    });
  });

  describe('verifySchema (family-shared envelope)', () => {
    it('returns ok=true with no issues when namespaces yield no issues', () => {
      const verifier = new RecordingVerifier();

      const result = verifier.verifySchema(buildOptions(['__unbound__']));

      expect(result).toEqual({ ok: true, issues: [] });
    });

    it('accumulates per-namespace issues + target-extension issues', () => {
      const nsIssue: SchemaDiffIssue = {
        path: ['users'],
      };
      const targetIssue: SchemaDiffIssue = {
        path: ['audit_log'],
      };

      const verifier = new RecordingVerifier({ __unbound__: [nsIssue] }, [targetIssue]);

      const result = verifier.verifySchema(buildOptions(['__unbound__']));

      expect(result.ok).toBe(false);
      expect(result.issues).toEqual([nsIssue, targetIssue]);
    });

    it('calls verifyTargetExtensions exactly once after the namespace walk', () => {
      const verifier = new RecordingVerifier();

      verifier.verifySchema(buildOptions(['a', 'b', 'c']));

      expect(verifier.targetExtensionCalls).toHaveLength(1);
      expect(verifier.dispatches).toHaveLength(3);
    });
  });
});
