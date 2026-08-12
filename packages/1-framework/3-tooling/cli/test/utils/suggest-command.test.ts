import { describe, expect, it } from 'vitest';
import { suggestCommands } from '../../src/utils/suggest-command';

describe('suggestCommands', () => {
  const topLevel = ['contract', 'db', 'migration', 'help'];
  const contractSubs = ['emit', 'infer'];
  const dbSubs = ['verify', 'init', 'update', 'schema', 'sign'];

  it('returns empty array when no candidates', () => {
    expect(suggestCommands('foo', [])).toEqual([]);
  });

  it('suggests "contract" for "contrct"', () => {
    expect(suggestCommands('contrct', topLevel)).toEqual(['contract']);
  });

  it('suggests "contract" for "contrat"', () => {
    expect(suggestCommands('contrat', topLevel)).toEqual(['contract']);
  });

  it('suggests "migration" for "migraton"', () => {
    expect(suggestCommands('migraton', topLevel)).toEqual(['migration']);
  });

  it('suggests "db" for "bd"', () => {
    expect(suggestCommands('bd', topLevel)).toEqual(['db']);
  });

  it('suggests "verify" for "verifu"', () => {
    expect(suggestCommands('verifu', dbSubs)).toEqual(['verify']);
  });

  it('suggests "sign" for "sin"', () => {
    expect(suggestCommands('sin', dbSubs)).toEqual(['sign']);
  });

  it('suggests "schema" for "schem"', () => {
    expect(suggestCommands('schem', dbSubs)).toEqual(['schema']);
  });

  it('suggests "infer" for "infr"', () => {
    expect(suggestCommands('infr', contractSubs)).toEqual(['infer']);
  });

  it('returns empty for completely unrelated input', () => {
    expect(suggestCommands('zzzzzzzzz', topLevel)).toEqual([]);
  });

  it('returns empty for very distant match', () => {
    expect(suggestCommands('xylophone', topLevel)).toEqual([]);
  });

  it('returns at most 3 suggestions on ties', () => {
    // All single-char candidates have distance 1 from "a"
    const candidates = ['b', 'c', 'd', 'e'];
    const result = suggestCommands('a', candidates);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('returns multiple suggestions when tied', () => {
    // "stat" is distance 2 from both "status" and "start" (if they existed)
    const candidates = ['status', 'show', 'verify', 'apply'];
    const result = suggestCommands('statu', candidates);
    expect(result).toContain('status');
  });

  it('handles exact match (distance 0)', () => {
    expect(suggestCommands('verify', dbSubs)).toEqual(['verify']);
  });
});
