import { describe, expect, it } from 'vitest';
import { checkSqlExpressionText } from '../src/sql-expression-text';

describe('checkSqlExpressionText', () => {
  it('accepts one expression, with quoted literals and identifiers that hold anything', () => {
    expect(
      [
        'CAST("age" AS INTEGER)',
        `trim("age")::integer`,
        `';'`,
        `'-- not a comment'`,
        `'it''s /* fine */'`,
        `"odd;name"`,
        `"a""b" || 'x'`,
        `extract(year FROM "created")`,
        `(SELECT max(id) FROM "Other")`,
        `CASE WHEN "age" = '' THEN 0 ELSE CAST("age" AS INTEGER) END`,
        '`back;tick`',
        '[bracket;name]',
      ].map(checkSqlExpressionText),
    ).toEqual(Array(12).fill(undefined));
  });

  it('refuses a semicolon, a comment, dollar quoting, an unclosed quote and unbalanced parentheses', () => {
    expect(
      [
        '0; DROP TABLE x',
        '"age" -- trailing',
        '"age" /* note */',
        '$$x$$',
        '$tag$x$tag$',
        `'unclosed`,
        '"unclosed',
        'CAST("age" AS INTEGER',
        'age)',
      ].map((text) => checkSqlExpressionText(text) !== undefined),
    ).toEqual(Array(9).fill(true));
  });

  it('refuses a keyword that would reshape the statement around it, outside parentheses', () => {
    expect(
      [
        '"age" FROM "User"',
        '1 UNION SELECT 2',
        '"age" WHERE 1 = 1',
        '1 ORDER BY 1',
        '1 GROUP BY 1',
        '1 LIMIT 1',
        '1 INTERSECT SELECT 1',
        '1 EXCEPT SELECT 1',
        '1 HAVING 1',
        '1 RETURNING 1',
      ].map(checkSqlExpressionText),
    ).toEqual([
      'the keyword FROM outside parentheses',
      'the keyword UNION outside parentheses',
      'the keyword WHERE outside parentheses',
      'the keyword ORDER outside parentheses',
      'the keyword GROUP outside parentheses',
      'the keyword LIMIT outside parentheses',
      'the keyword INTERSECT outside parentheses',
      'the keyword EXCEPT outside parentheses',
      'the keyword HAVING outside parentheses',
      'the keyword RETURNING outside parentheses',
    ]);
  });

  it('names what it refuses', () => {
    expect([
      checkSqlExpressionText('0; DROP TABLE x'),
      checkSqlExpressionText('"age" -- trailing'),
      checkSqlExpressionText(`'unclosed`),
      checkSqlExpressionText('age)'),
    ]).toEqual([
      'a semicolon outside a quoted literal',
      'a SQL comment',
      'a quote that is not closed',
      'parentheses that do not match',
    ]);
  });
});
