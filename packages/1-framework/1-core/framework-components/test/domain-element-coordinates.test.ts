import type { ApplicationDomain } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import { domainElementCoordinates } from '../src/ir/domain';

describe('domainElementCoordinates', () => {
  it('yields domain-plane coordinates for models and value objects', () => {
    const domain: Pick<ApplicationDomain, 'namespaces'> = {
      namespaces: {
        auth: {
          models: { User: { fields: {}, relations: {}, storage: {} } },
          valueObjects: { Email: { fields: {} } },
        },
        public: {
          models: { Post: { fields: {}, relations: {}, storage: {} } },
        },
      },
    };

    const coordinates = [...domainElementCoordinates(domain)];

    expect(coordinates).toEqual(
      expect.arrayContaining([
        { plane: 'domain', namespaceId: 'auth', entityKind: 'models', entityName: 'User' },
        { plane: 'domain', namespaceId: 'auth', entityKind: 'valueObjects', entityName: 'Email' },
        { plane: 'domain', namespaceId: 'public', entityKind: 'models', entityName: 'Post' },
      ]),
    );
    expect(coordinates).toHaveLength(3);
  });
});
