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

  it('treats -- as a comment before a control character, as MySQL does, and not before a non-ASCII space', () => {
    expect(formatMysqlQuery("SELECT 1 --\x01 '\n, ?1", ['a'])).toBe("SELECT 1 --\x01 '\n, 'a'");
    expect(formatMysqlQuery('SELECT 1 --\x7f ?1\n', [])).toBe('SELECT 1 --\x7f ?1\n');
    expect(formatMysqlQuery('SELECT 1 --\u00a0?1', ['a'])).toBe("SELECT 1 --\u00a0'a'");
  });

  it('refuses an executable /*! comment, whose content MySQL runs as SQL', () => {
    expect(() => formatMysqlQuery("SELECT 1 /*! , 'a*/ */ WHERE ?1", ['a'])).toThrow(
      expect.objectContaining({ code: 'RUNTIME.AST_INVALID' }),
    );
  });

  it('refuses a numbered placeholder with a leading zero', () => {
    expect(() => formatMysqlQuery('SELECT ?01', ['a'])).toThrow(
      expect.objectContaining({ code: 'RUNTIME.PARAM_PLACEHOLDER_MISMATCH' }),
    );
  });

  it('writes each value with mysql2 escaping, and NULL for null', () => {
    expect(
      formatMysqlQuery('SELECT ?, ?, ?, ?, ?', [null, 'a\\b', 1.5, true, Buffer.from([1, 255])]),
    ).toBe("SELECT NULL, 'a\\\\b', 1.5, true, X'01ff'");
  });

  it('refuses a statement whose placeholders and values differ in number', () => {
    expect(() => formatMysqlQuery("SELECT '?' WHERE a = ?", [1, 2])).toThrow(
      expect.objectContaining({
        code: 'RUNTIME.PARAM_PLACEHOLDER_MISMATCH',
        meta: { placeholders: ['?'], params: 2 },
      }),
    );
    expect(() => formatMysqlQuery('SELECT ?, ?', [1])).toThrow(
      expect.objectContaining({ code: 'RUNTIME.PARAM_PLACEHOLDER_MISMATCH' }),
    );
  });

  it('fills a numbered placeholder with the value it names, as often as it is written', () => {
    expect(formatMysqlQuery("SELECT ?2, '?1', ?1, ?2", ['a', 'b'])).toBe(
      "SELECT 'b', '?1', 'a', 'b'",
    );
  });

  it('refuses a bare placeholder beside numbered ones, a number no value has, and a value no placeholder takes', () => {
    for (const [sql, values] of [
      ['SELECT ?1, ?', [1, 2]],
      ['SELECT ?3', [1, 2, 3, 4]],
      ['SELECT ?0', [1]],
      ['SELECT ?1', [1, 2]],
    ] as const) {
      expect(() => formatMysqlQuery(sql, values)).toThrow(
        expect.objectContaining({ code: 'RUNTIME.PARAM_PLACEHOLDER_MISMATCH' }),
      );
    }
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
