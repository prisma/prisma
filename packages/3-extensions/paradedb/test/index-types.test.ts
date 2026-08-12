import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { paradedbPackMeta } from '../src/core/descriptor-meta';
import { paradedbIndexTypes } from '../src/types/index-types';

describe('ParadeDB extension', () => {
  describe('paradedbPackMeta', () => {
    it('declares correct extension identity', () => {
      expect(paradedbPackMeta.kind).toBe('extension');
      expect(paradedbPackMeta.id).toBe('paradedb');
      expect(paradedbPackMeta.familyId).toBe('sql');
      expect(paradedbPackMeta.targetId).toBe('postgres');
    });

    it('declares bm25 capability', () => {
      expect(paradedbPackMeta.capabilities).toEqual({
        postgres: { 'paradedb/bm25': true },
      });
    });

    it('exposes the bm25 entry in indexTypes', () => {
      expect(paradedbPackMeta.indexTypes.entries).toHaveLength(1);
      expect(paradedbPackMeta.indexTypes.entries[0]?.type).toBe('bm25');
    });
  });

  describe('paradedbIndexTypes', () => {
    it('declares a single bm25 entry', () => {
      expect(paradedbIndexTypes.entries.map((e) => e.type)).toEqual(['bm25']);
    });

    it('validates bm25 options with a key_field string', () => {
      const entry = paradedbIndexTypes.entries[0];
      if (!entry) throw new Error('expected bm25 entry');
      const result = entry.options({ key_field: 'id' });
      expect(result instanceof type.errors).toBe(false);
    });

    it('rejects bm25 options without key_field', () => {
      const entry = paradedbIndexTypes.entries[0];
      if (!entry) throw new Error('expected bm25 entry');
      const result = entry.options({});
      expect(result instanceof type.errors).toBe(true);
    });

    it('rejects bm25 options with extra unknown keys', () => {
      const entry = paradedbIndexTypes.entries[0];
      if (!entry) throw new Error('expected bm25 entry');
      const result = entry.options({ key_field: 'id', extra: 'nope' });
      expect(result instanceof type.errors).toBe(true);
    });

    it('rejects bm25 options where key_field is not a string', () => {
      const entry = paradedbIndexTypes.entries[0];
      if (!entry) throw new Error('expected bm25 entry');
      const result = entry.options({ key_field: 42 });
      expect(result instanceof type.errors).toBe(true);
    });
  });
});
