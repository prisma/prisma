import { UNBOUND_DOMAIN_NAMESPACE_ID } from '@internal/contract/default-namespace';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import {
  defaultMongoDomainNamespaceId,
  defaultMongoStorageNamespaceId,
} from '../src/default-namespace';

describe('mongo default namespace identifiers', () => {
  it('uses the unbound sentinel for storage and domain', () => {
    expect(defaultMongoStorageNamespaceId).toBe(UNBOUND_NAMESPACE_ID);
    expect(defaultMongoDomainNamespaceId).toBe(UNBOUND_DOMAIN_NAMESPACE_ID);
  });
});
