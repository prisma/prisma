import { describe, expect, it } from 'vitest';
import { placeholderNumber, tokenizeMysqlSql } from '../src/core/sql-lexer';

const placeholders = (sql: string) =>
  tokenizeMysqlSql(sql)
    .filter((token) => token.kind === 'placeholder')
    .map((token) => token.text);

describe('tokenizeMysqlSql', () => {
  it('finds placeholders outside quoted text, backtick identifiers and comments', () => {
    expect(
      placeholders(
        'SELECT ?1, \'a?\\\'?\', "b?""?", `c?``?`, ?2 /* ? */ # ?\n-- ?\n--\x01 ?\n--\x7f?\n?3 -- ?4',
      ),
    ).toEqual(['?1', '?2', '?3', '?4']);
  });

  it('keeps the text around placeholders, so joining the tokens gives the statement back', () => {
    const sql = "SELECT 'x', ?1 FROM t WHERE a = ?";
    expect(
      tokenizeMysqlSql(sql)
        .map((token) => token.text)
        .join(''),
    ).toBe(sql);
  });

  it('refuses an executable /*! comment, but not an optimizer hint', () => {
    expect(() => tokenizeMysqlSql('SELECT /*!80000 1 */')).toThrow(
      expect.objectContaining({ code: 'RUNTIME.AST_INVALID' }),
    );
    expect(placeholders('SELECT /*+ SET_VAR(a = 1) */ ?1')).toEqual(['?1']);
  });
});

describe('placeholderNumber', () => {
  it('reads ?N, and nothing for a bare ? or a leading zero', () => {
    expect(['?1', '?12', '?', '?01', '?0'].map(placeholderNumber)).toEqual([
      1,
      12,
      undefined,
      undefined,
      undefined,
    ]);
  });
});
