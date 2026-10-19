import type { JsonValue } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import { codecDescriptors } from '../src/core/codecs';

/** A stored value of each data type. */
const storedValues: Readonly<Record<string, JsonValue>> = {
  'sqlite/character': 'a',
  'sqlite/character-varying': 'low',
  'sqlite/text': 'low',
  'sqlite/integer': '1',
  'sqlite/real': 1.5,
  'sqlite/blob': '68656C6C6F',
  'sqlite/datetime': '2024-01-01T00:00:00.000Z',
  'sqlite/json': '"x"',
};

describe('every registered codec renders the literal of the value it reads from a stored value, or nothing', () => {
  it('renders, for a stored value of its data type, the literal of the value a query reads', () => {
    const rendered = Object.fromEntries(
      codecDescriptors.map((descriptor) => [
        descriptor.codecId,
        descriptor.renderValueLiteral?.(storedValues[descriptor.dataType] ?? null, 'output'),
      ]),
    );

    expect(rendered).toEqual({
      'sql/char@1': '"a"',
      'sql/varchar@1': '"low"',
      'sql/int@1': '1',
      'sql/float@1': '1.5',
      'sqlite/text@1': '"low"',
      'sqlite/integer@1': '1',
      'sqlite/real@1': '1.5',
      'sqlite/blob@1': undefined,
      'sqlite/datetime@1': undefined,
      'sqlite/json@1': '"x"',
      'sqlite/bigint@1': '1n',
      'sqlite/bigintnumber@1': '1',
    });
  });

  it.each([
    ['sql/float@1', 'Infinity'],
    ['sqlite/real@1', '-Infinity'],
    ['sqlite/integer@1', 1],
    ['sqlite/bigint@1', '1.5'],
    ['sqlite/json@1', '{"a":1}'],
  ])('%s renders nothing for the stored value %j, which has no literal type', (codecId, value) => {
    const descriptor = codecDescriptors.find((candidate) => candidate.codecId === codecId);
    expect(descriptor?.renderValueLiteral?.(value, 'output')).toBeUndefined();
  });
});
