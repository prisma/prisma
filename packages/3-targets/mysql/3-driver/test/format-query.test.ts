import { describe, expect, it } from 'vitest';
import { formatMysqlQuery } from '../src/core/format-query';

const injection = "' OR 1=1 OR '";

describe('formatMysqlQuery', () => {
  it('fills only the placeholders outside quoted text and comments', () => {
    expect(
      formatMysqlQuery(
        'SELECT \'why?\' AS `a?`, "b?" AS c /* d? */ FROM t -- e?\nWHERE x = ? # f?\nAND y = ?',
        [injection, 2],
      ),
    ).toBe(
      "SELECT 'why?' AS `a?`, \"b?\" AS c /* d? */ FROM t -- e?\nWHERE x = '\\' OR 1=1 OR \\'' # f?\nAND y = 2",
    );
  });

  it('keeps a quote escaped inside a literal from ending it', () => {
    expect(
      formatMysqlQuery("SELECT 'it''s ?', 'back\\'slash ?', `x``?` FROM t WHERE a = ?", [1]),
    ).toBe("SELECT 'it''s ?', 'back\\'slash ?', `x``?` FROM t WHERE a = 1");
  });

  it('treats -- as a comment only when whitespace follows, as MySQL does', () => {
    expect(formatMysqlQuery('SELECT 1--?', [2])).toBe('SELECT 1--2');
  });

  it('writes each value with mysql2 escaping, and NULL for null', () => {
    expect(
      formatMysqlQuery('SELECT ?, ?, ?, ?, ?', [null, 'a\\b', 1.5, true, Buffer.from([1, 255])]),
    ).toBe("SELECT NULL, 'a\\\\b', 1.5, true, X'01ff'");
  });

  it('refuses a statement whose placeholders and values differ in number', () => {
    expect(() => formatMysqlQuery("SELECT '?' WHERE a = ?", [1, 2])).toThrow(
      expect.objectContaining({
        code: 'RUNTIME.AST_INVALID',
        meta: expect.objectContaining({ placeholders: 1, values: 2 }),
      }),
    );
    expect(() => formatMysqlQuery('SELECT ?, ?', [1])).toThrow(
      expect.objectContaining({ code: 'RUNTIME.AST_INVALID' }),
    );
  });

  it('refuses a value the text protocol has no literal for', () => {
    for (const value of [{ a: 1 }, [1, 2], Number.NaN]) {
      expect(() => formatMysqlQuery('SELECT ?', [value])).toThrow(
        expect.objectContaining({ code: 'RUNTIME.AST_INVALID' }),
      );
    }
  });

  it('leaves a statement with no values unchanged', () => {
    expect(formatMysqlQuery("SELECT 'why?'", [])).toBe("SELECT 'why?'");
  });
});
