import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import {
  describeRemovedFieldPreset,
  removedPresetWithPhases,
  removedPresetWrittenAs,
} from '../src/removed-field-presets';
import type { ResolvedTypeConstructorCall } from '../src/resolve';
import { PslSources } from '../src/source-file';
import { buildSymbolTable } from '../src/symbol-table';

function callOf(type: string): ResolvedTypeConstructorCall {
  const { document, sources } = parse(`model M {\n  f ${type}\n}\n`, 'schema.prisma');
  const { symbolTable } = buildSymbolTable({
    documents: [document],
    sources: new PslSources([[document.syntax, sources.sourceFileFor(document.syntax)]]),
    defaultNamespaceId: 'public',
  });
  const call = symbolTable.defaultNamespace.models['M']?.fields['f']?.typeConstructor;
  if (call === undefined) throw new Error(`${type} is not a call`);
  return call;
}

const stamp = { kind: 'typeConstructor', output: { codecId: 'test/stamp@1' } } as const;
const presets = {
  'ns.stamp': removedPresetWithPhases('Stamp', 'test/stamp@1', true),
  plain: removedPresetWrittenAs('Stamp @id', 'test/stamp@1'),
};

describe('describeRemovedFieldPreset', () => {
  it('names the call and its rewrite', () => {
    expect(
      describeRemovedFieldPreset(presets, callOf('ns.stamp(3, onUpdate: now)'), { Stamp: stamp }),
    ).toBe(
      'ns.stamp(3, onUpdate: now) was a field preset, and Prisma 8 removed field presets. Write Stamp(3) @onUpdate(now()).',
    );
    expect(describeRemovedFieldPreset(presets, callOf('plain()'), { Stamp: stamp })).toBe(
      'plain() was a field preset, and Prisma 8 removed field presets. Write Stamp @id.',
    );
  });

  it('falls back to the phases sentence when the arguments do not bind', () => {
    expect(
      describeRemovedFieldPreset(presets, callOf('ns.stamp(onUpdate: later)'), { Stamp: stamp }),
    ).toBe(
      'ns.stamp(onUpdate: later) was a field preset, and Prisma 8 removed field presets. Write Stamp(...) with @onCreate(now()) and @onUpdate(now()) for the phases the preset set.',
    );
  });

  it.each([
    ['the stack has no type the rewrite writes', 'plain()', {}],
    [
      'the rewrite type stores another codec',
      'plain()',
      { Stamp: { kind: 'typeConstructor', output: { codecId: 'test/other@1' } } },
    ],
    ['the call names no removed preset', 'other()', { Stamp: stamp }],
    ['the call names an inherited property', 'constructor()', { Stamp: stamp }],
  ] as const)('names nothing when %s', (_, type, types) => {
    expect(describeRemovedFieldPreset(presets, callOf(type), types)).toBeUndefined();
  });
});
