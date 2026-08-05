import { describe, expect, it } from 'vitest';
import { postgresRenderCheckExpressions } from '../src/core/check-expressions';

const base = { tableName: 'User', columnName: 'role', many: false, memberValues: undefined };

describe('postgresRenderCheckExpressions', () => {
  it('renders a scalar domain enum as an IN membership predicate', () => {
    expect(postgresRenderCheckExpressions({ ...base, memberValues: ['user', 'admin'] })).toEqual([
      { prefix: 'User_role_check', expression: `"role" IN ('user', 'admin')` },
    ]);
  });

  it('renders an array domain enum as an <@ containment predicate', () => {
    expect(
      postgresRenderCheckExpressions({
        ...base,
        columnName: 'roles',
        many: true,
        memberValues: ['user', 'admin'],
      }),
    ).toEqual([
      {
        prefix: 'User_roles_check',
        expression: `"roles" <@ ARRAY['user', 'admin']::text[]`,
      },
      {
        prefix: 'User_roles_elem_not_null',
        expression: `array_position("roles", NULL) IS NULL`,
      },
    ]);
  });

  it('renders element-non-null only for a list column with no member set', () => {
    expect(postgresRenderCheckExpressions({ ...base, columnName: 'tags', many: true })).toEqual([
      {
        prefix: 'User_tags_elem_not_null',
        expression: `array_position("tags", NULL) IS NULL`,
      },
    ]);
  });

  it('renders nothing for a plain scalar column', () => {
    expect(postgresRenderCheckExpressions(base)).toEqual([]);
  });

  it('quotes identifiers and escapes literal quotes', () => {
    expect(
      postgresRenderCheckExpressions({
        tableName: 'Order',
        columnName: 'sta"tus',
        many: false,
        memberValues: ["o'brien"],
      }),
    ).toEqual([{ prefix: 'Order_sta"tus_check', expression: `"sta""tus" IN ('o''brien')` }]);
  });
});
