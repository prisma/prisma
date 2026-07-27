import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  assertWireNamePrefixLength,
  computeIndexContentHash,
  formatWireName,
  normalizeSqlBody,
  parseWireName,
  WIRE_NAME_PREFIX_MAX_LENGTH,
} from '../src/exports/naming';

describe('formatWireName', () => {
  it('joins prefix and hash with an underscore', () => {
    expect(formatWireName('p_read', 'ab12cd34')).toBe('p_read_ab12cd34');
  });

  it('parse ∘ format round-trips (one module owns the format)', () => {
    for (const [prefix, hash] of [
      ['p_read', 'ab12cd34'],
      ['read_own_profiles', 'deadbeef'],
      ['users_email_idx', '01234567'],
    ] as const) {
      expect(parseWireName(formatWireName(prefix, hash))).toEqual({
        kind: 'managed',
        prefix,
        hash,
      });
    }
  });
});

describe('parseWireName', () => {
  it('splits a wire name into prefix and hash', () => {
    expect(parseWireName('p_read_ab12cd34')).toEqual({
      kind: 'managed',
      prefix: 'p_read',
      hash: 'ab12cd34',
    });
  });

  it('keeps underscores inside the prefix (only the final segment is the hash)', () => {
    expect(parseWireName('read_own_profiles_deadbeef')).toEqual({
      kind: 'managed',
      prefix: 'read_own_profiles',
      hash: 'deadbeef',
    });
  });

  it('returns undefined for a name without a hash suffix', () => {
    expect(parseWireName('handwritten_index')).toBeUndefined();
  });

  it('returns undefined when the suffix is not exactly 8 hex characters', () => {
    expect(parseWireName('p_read_abc')).toBeUndefined();
    expect(parseWireName('p_read_ab12cd345')).toBeUndefined();
    expect(parseWireName('p_read_ab12cdZZ')).toBeUndefined();
  });

  it('returns undefined for uppercase hex (wire hashes are lowercase)', () => {
    expect(parseWireName('p_read_AB12CD34')).toBeUndefined();
  });

  it('returns undefined for a bare hash with no prefix', () => {
    expect(parseWireName('_ab12cd34')).toBeUndefined();
    expect(parseWireName('ab12cd34')).toBeUndefined();
  });
});

describe('normalizeSqlBody', () => {
  describe('whitespace collapse', () => {
    it('collapses multiple spaces to one', () => {
      expect(normalizeSqlBody('a  =  b')).toBe('a = b');
    });

    it('collapses tabs to a space', () => {
      expect(normalizeSqlBody('a\t=\tb')).toBe('a = b');
    });

    it('collapses newlines to a space', () => {
      expect(normalizeSqlBody('a\n=\nb')).toBe('a = b');
    });

    it('collapses mixed whitespace variants', () => {
      expect(normalizeSqlBody('a \t\n =\n\t b')).toBe('a = b');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeSqlBody('  a = b  ')).toBe('a = b');
    });
  });

  describe('minimal normalization preserves the authored form', () => {
    // Normalization stabilizes only whitespace. Case, parens, comments, and
    // casts are kept verbatim — collapsing them would risk hashing two
    // distinct bodies onto one wire name.
    it('preserves keyword case', () => {
      expect(normalizeSqlBody('user_id IS NULL')).toBe('user_id IS NULL');
    });

    it('preserves enclosing parens', () => {
      expect(normalizeSqlBody('(a = b)')).toBe('(a = b)');
    });

    it('preserves SQL comments verbatim (after whitespace collapse)', () => {
      expect(normalizeSqlBody('a = b -- comment')).toBe('a = b -- comment');
    });

    it('preserves casts and their aliases', () => {
      expect(normalizeSqlBody('x::integer')).toBe('x::integer');
    });
  });

  describe('determinism across whitespace-equivalent forms', () => {
    it('whitespace variants are equivalent', () => {
      const a = normalizeSqlBody('user_id  =  auth.uid()');
      const b = normalizeSqlBody('user_id = auth.uid()');
      expect(a).toBe(b);
    });
  });
});

describe('computeIndexContentHash', () => {
  const base = { columns: ['email'], unique: false } as const;

  it('returns 8 lowercase hex characters', () => {
    expect(computeIndexContentHash(base)).toMatch(/^[0-9a-f]{8}$/);
  });

  describe('tuple encoding stability', () => {
    it('matches the expected SHA-256 first-8-hex for a known input', () => {
      const hash = computeIndexContentHash({
        expression: 'lower(email)',
        where: 'deleted_at  IS  NULL',
        unique: true,
        type: 'btree',
        options: { fillfactor: 70 },
      });
      const tuple = JSON.stringify([
        'lower(email)',
        'deleted_at IS NULL',
        [],
        true,
        'btree',
        [['fillfactor', '70']],
      ]);
      const expected = createHash('sha256').update(tuple).digest('hex').slice(0, 8);
      expect(hash).toBe(expected);
    });
  });

  describe('column order is semantic', () => {
    it('swapping two columns changes the hash', () => {
      const ab = computeIndexContentHash({ columns: ['a', 'b'], unique: false });
      const ba = computeIndexContentHash({ columns: ['b', 'a'], unique: false });
      expect(ab).not.toBe(ba);
    });
  });

  describe('options coercion and ordering', () => {
    it('String()-coerces values: a typed 70 hashes equal to an introspected "70"', () => {
      const typed = computeIndexContentHash({ ...base, options: { fillfactor: 70 } });
      const stringly = computeIndexContentHash({ ...base, options: { fillfactor: '70' } });
      expect(typed).toBe(stringly);
    });

    it("canonicalizes boolean values to the catalog reprint form ('on'/'off')", () => {
      const typedTrue = computeIndexContentHash({ ...base, options: { deduplicate_items: true } });
      const reprintOn = computeIndexContentHash({
        ...base,
        options: { deduplicate_items: 'on' },
      });
      expect(typedTrue).toBe(reprintOn);

      const typedFalse = computeIndexContentHash({
        ...base,
        options: { deduplicate_items: false },
      });
      const reprintOff = computeIndexContentHash({
        ...base,
        options: { deduplicate_items: 'off' },
      });
      expect(typedFalse).toBe(reprintOff);
      // The catalog stores whatever spelling the DDL used, so the string
      // spellings canonicalize to the same form too.
      const stringlyFalse = computeIndexContentHash({
        ...base,
        options: { deduplicate_items: 'false' },
      });
      expect(typedFalse).toBe(stringlyFalse);
    });

    it('is insensitive to option key order', () => {
      const ab = computeIndexContentHash({ ...base, options: { a: '1', b: '2' } });
      const ba = computeIndexContentHash({ ...base, options: { b: '2', a: '1' } });
      expect(ab).toBe(ba);
    });

    it('different option values produce different hashes', () => {
      const seventy = computeIndexContentHash({ ...base, options: { fillfactor: 70 } });
      const eighty = computeIndexContentHash({ ...base, options: { fillfactor: 80 } });
      expect(seventy).not.toBe(eighty);
    });
  });

  describe('body whitespace normalization', () => {
    it('expression whitespace variants hash identically', () => {
      const a = computeIndexContentHash({ expression: 'lower(  email  )', unique: false });
      const b = computeIndexContentHash({ expression: 'lower( email )', unique: false });
      expect(a).toBe(b);
    });

    it('where whitespace variants hash identically', () => {
      const a = computeIndexContentHash({ ...base, where: 'deleted_at   IS NULL' });
      const b = computeIndexContentHash({ ...base, where: 'deleted_at IS NULL' });
      expect(a).toBe(b);
    });

    it('materially different expressions hash differently', () => {
      const a = computeIndexContentHash({ expression: 'lower(email)', unique: false });
      const b = computeIndexContentHash({ expression: 'upper(email)', unique: false });
      expect(a).not.toBe(b);
    });
  });

  describe('empty-vs-absent equivalences (the ?? defaults)', () => {
    it('absent expression hashes like an empty expression', () => {
      expect(computeIndexContentHash(base)).toBe(
        computeIndexContentHash({ ...base, expression: '' }),
      );
    });

    it('absent where hashes like an empty where', () => {
      expect(computeIndexContentHash(base)).toBe(computeIndexContentHash({ ...base, where: '' }));
    });

    it('absent columns hash like an empty column list', () => {
      expect(computeIndexContentHash({ unique: false })).toBe(
        computeIndexContentHash({ columns: [], unique: false }),
      );
    });

    it('absent type hashes like an empty type', () => {
      expect(computeIndexContentHash(base)).toBe(computeIndexContentHash({ ...base, type: '' }));
    });

    it('absent options hash like an empty options bag', () => {
      expect(computeIndexContentHash(base)).toBe(computeIndexContentHash({ ...base, options: {} }));
    });
  });

  describe('remaining tuple members participate', () => {
    it('unique flips the hash', () => {
      const plain = computeIndexContentHash(base);
      const unique = computeIndexContentHash({ ...base, unique: true });
      expect(plain).not.toBe(unique);
    });

    it('type changes the hash', () => {
      const btree = computeIndexContentHash({ ...base, type: 'btree' });
      const gin = computeIndexContentHash({ ...base, type: 'gin' });
      expect(btree).not.toBe(gin);
    });
  });
});

describe('assertWireNamePrefixLength', () => {
  it('rejects a prefix over the 54-character cap, naming the prefix and the cap', () => {
    const longPrefix = 'a'.repeat(WIRE_NAME_PREFIX_MAX_LENGTH + 1);
    expect(() => assertWireNamePrefixLength(longPrefix, 'index prefix')).toThrow(
      `index prefix "${longPrefix}" exceeds the 54-character maximum`,
    );
  });

  it('accepts a 54-character prefix (the cap is inclusive)', () => {
    const prefix = 'a'.repeat(WIRE_NAME_PREFIX_MAX_LENGTH);
    expect(() => assertWireNamePrefixLength(prefix, 'index prefix')).not.toThrow();
  });
});
