import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveSchemaInputs, type SchemaInputConfig } from '../src/schema-inputs';

function configWith(
  inputs: readonly string[] | undefined,
  format: string | null = 'psl',
): SchemaInputConfig {
  return {
    contract: {
      source: {
        ...(format ? { format } : {}),
        ...(inputs ? { inputs } : {}),
      },
    },
  };
}

describe('resolveSchemaInputs', () => {
  it('includes only the listed inputs by their file URI', () => {
    const set = resolveSchemaInputs(configWith(['/abs/schema.psl', '/abs/more.psl']));
    expect(set.includes(pathToFileURL('/abs/schema.psl').toString())).toBe(true);
    expect(set.includes(pathToFileURL('/abs/more.psl').toString())).toBe(true);
    expect(set.includes(pathToFileURL('/abs/other.psl').toString())).toBe(false);
  });

  it('treats every configured input as a schema, not just the first', () => {
    const set = resolveSchemaInputs(configWith(['/abs/a.psl', '/abs/b.psl', '/abs/c.psl']));
    expect(set.includes(pathToFileURL('/abs/c.psl').toString())).toBe(true);
  });

  it('excludes everything when inputs is absent', () => {
    const set = resolveSchemaInputs(configWith(undefined));
    expect(set.includes(pathToFileURL('/abs/schema.psl').toString())).toBe(false);
  });

  it('excludes everything when source format is typescript', () => {
    const set = resolveSchemaInputs(configWith(['/abs/schema.psl'], 'typescript'));
    expect(set.includes(pathToFileURL('/abs/schema.psl').toString())).toBe(false);
  });

  it('excludes everything when source format is absent', () => {
    const set = resolveSchemaInputs(configWith(['/abs/schema.psl'], null));
    expect(set.includes(pathToFileURL('/abs/schema.psl').toString())).toBe(false);
  });

  it('excludes everything when inputs is empty', () => {
    const set = resolveSchemaInputs(configWith([]));
    expect(set.includes(pathToFileURL('/abs/schema.psl').toString())).toBe(false);
  });

  it('is empty when there is no contract config', () => {
    const set = resolveSchemaInputs({});
    expect(set.includes(pathToFileURL('/abs/schema.psl').toString())).toBe(false);
  });

  it('lists the configured input URIs in config order', () => {
    const set = resolveSchemaInputs(configWith(['/abs/a.psl', '/abs/b.psl']));
    expect([...set.uris()]).toEqual([
      pathToFileURL('/abs/a.psl').toString(),
      pathToFileURL('/abs/b.psl').toString(),
    ]);
  });

  it('lists no URIs when there are no configured inputs', () => {
    expect([...resolveSchemaInputs({}).uris()]).toEqual([]);
  });
});
