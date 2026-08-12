/**
 * Demo DX integration tests.
 *
 * Verifies that contract visualization renders directly from the runtime contract
 * value (SPI deserializeContract output) with no type/runtime shape divergence.
 *
 * Spec: agent-os/specs/2026-02-15-runtime-dx-ir-shaped-contract-mappings-on-executioncontext/spec.md
 */

import { domainModelsAtDefaultNamespace } from '@prisma/orm-postgres/contract/types';
import { PostgresContractSerializer } from '@prisma/orm-postgres/target/runtime';
import { blindCast } from '@prisma/orm-postgres/utils/casts';
import { describe, expect, it } from 'vitest';
import type { Contract } from '../src/prisma/contract.d';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };

// Models resolve per-namespace from the domain plane (no flat top-level Models export).
type Models = Contract['domain']['namespaces']['public']['models'];

describe('demo contract visualization DX', () => {
  it('validated contract has runtime shape needed for visualization', () => {
    const contract = new PostgresContractSerializer().deserializeContract<Contract>(contractJson);

    expect(contract.target).toBeDefined();
    expect(typeof contract.target).toBe('string');
    expect(contract.storage.storageHash).toBeDefined();
    expect(contract.domain.namespaces).toBeDefined();
    expect(typeof contract.domain.namespaces).toBe('object');
    expect(contract.storage).toBeDefined();
    expect(contract.storage.namespaces).toBeDefined();
    expect(contract.capabilities).toBeDefined();
    expect(typeof contract.capabilities).toBe('object');
    expect(contract.extensions).toBeDefined();
    expect(typeof contract.extensions).toBe('object');
  });

  it('validated contract exposes model storage field mappings', () => {
    const contract = new PostgresContractSerializer().deserializeContract<Contract>(contractJson);

    const models = domainModelsAtDefaultNamespace(contract.domain) as Models;
    expect(models.User.storage.table).toBe('user');
    expect(models.User.storage.fields.email.column).toBe('email');
    expect(models.Post.storage.fields.userId.column).toBe('userId');
  });

  it('validated contract omits _generated at runtime', () => {
    const contractWithGenerated = {
      ...contractJson,
      _generated: { emittedAt: '2026-02-15T12:00:00Z' },
    };
    const contract = new PostgresContractSerializer().deserializeContract<Contract>(
      contractWithGenerated,
    );

    expect(contract).not.toHaveProperty('_generated');
    expect(Object.hasOwn(contract as object, '_generated')).toBe(false);
  });

  it('validated contract is traversable for render use-case', () => {
    const contract = new PostgresContractSerializer().deserializeContract<Contract>(contractJson);

    for (const [, model] of Object.entries(domainModelsAtDefaultNamespace(contract.domain))) {
      const m = blindCast<
        Record<string, unknown>,
        'contract model entries are plain records in render traversal'
      >(model);
      expect(m['storage']).toBeDefined();
      expect(m['fields']).toBeDefined();
      expect(m['relations']).toBeDefined();
      expect(typeof m['relations']).toBe('object');
    }

    for (const [, ns] of Object.entries(contract.storage.namespaces)) {
      for (const [, table] of Object.entries(ns.entries.table)) {
        expect(table.columns).toBeDefined();
      }
    }
  });
});
