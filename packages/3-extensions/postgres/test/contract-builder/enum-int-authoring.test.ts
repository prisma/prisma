import { describe, expect, it } from 'vitest';
import { defineContract, enumType, member } from '../../src/exports/contract-builder';

const pgInt = { codecId: 'pg/int4@1' as const, nativeType: 'int4' };
const pgText = { codecId: 'pg/text@1' as const, nativeType: 'text' };

/**
 * Numeric enums have no CHECK rendering, and the Postgres pack renders a
 * membership predicate for every column on the `enumType()` handle path — so
 * an int-backed enum fails when the contract is built, not later when it is
 * migrated. This is the runtime counterpart to `enum-int-read-surface.test-d.ts`,
 * which is type-checked rather than executed and so never reaches the guard.
 */
describe('int-backed enum authoring against the real Postgres pack', () => {
  it('throws CONTRACT.ENUM_INVALID when a column uses an int-backed enum', () => {
    const Level = enumType('Level', pgInt, member('Low', 1), member('High', 10));
    expect(() =>
      defineContract({ enums: { Level } }, ({ field, model }) => ({
        models: {
          Event: model('Event', {
            fields: { id: field.id.uuidv4String(), level: field.namedType(Level) },
          }),
        },
      })),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.ENUM_INVALID',
        message: expect.stringContaining('numeric-enum CHECK constraints are not yet supported'),
      }),
    );
  });

  it('accepts a text-backed enum on the same shape', () => {
    const Role = enumType('Role', pgText, member('User', 'user'), member('Admin', 'admin'));
    expect(() =>
      defineContract({ enums: { Role } }, ({ field, model }) => ({
        models: {
          Event: model('Event', {
            fields: { id: field.id.uuidv4String(), role: field.namedType(Role) },
          }),
        },
      })),
    ).not.toThrow();
  });
});
