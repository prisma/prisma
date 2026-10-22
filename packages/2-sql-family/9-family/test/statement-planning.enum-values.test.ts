import { asNamespaceId } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import { planStatements } from '../src/core/migrations/statement-planning';
import { ALL_CLASSES, contractOf, fakeTarget, rejection } from './statement-fixtures';

describe('an enum value rename', () => {
  it('is refused until enum value statements are planned', () => {
    const app = asNamespaceId('app');
    const contract = contractOf({ User: { table: 'User', fields: { status: 'status' } } });

    expect(
      rejection(
        planStatements({
          statements: [
            {
              kind: 'rename',
              entity: 'enumValue',
              from: { namespaceId: app, enum: 'Status', member: 'ARCHIVED' },
              to: { namespaceId: app, enum: 'Status', member: 'RETIRED' },
            },
          ],
          fromContract: contract,
          contract,
          policy: ALL_CLASSES,
          target: fakeTarget(['app.User']),
        }),
      ),
    ).toMatchObject({
      kind: 'statementRefused',
      summary:
        'Cannot rename enum value "Status.ARCHIVED" to "Status.RETIRED": enum value statements are not planned yet',
    });
  });
});
