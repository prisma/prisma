import type { Tone } from '@prisma/cli-engine';
import stringWidth from 'string-width';
import { describe, expect, it } from 'vitest';
import {
  TONE_ORDER,
  toneDrawing,
  toned,
  toneSpans,
} from '../../../src/utils/formatters/tone-markup';

/**
 * Every tone the engine defines. The record is checked by the compiler, so a
 * tone added to the union has to be added here, and the test below then holds
 * the marker table against it.
 */
const EVERY_ENGINE_TONE: Record<Tone, true> = {
  ok: true,
  warn: true,
  error: true,
  info: true,
  heading: true,
  identifier: true,
  ref: true,
  placeholder: true,
  link: true,
  emphasis: true,
  muted: true,
  structure: true,
  highlight: true,
  'color-1': true,
  'color-2': true,
  'color-3': true,
  'color-4': true,
  'color-5': true,
  'color-6': true,
};

describe('the tone marker table', () => {
  it('carries every tone the engine defines', () => {
    expect([...TONE_ORDER].sort()).toEqual(Object.keys(EVERY_ENGINE_TONE).sort());
  });

  it('gives every tone a mark that survives a round trip', () => {
    for (const tone of TONE_ORDER) {
      expect(toneSpans(toned(tone, 'x'))).toEqual([{ text: 'x', tone }]);
    }
  });
});

describe('a marked string', () => {
  it('measures as the text alone, so marking cannot shift a column', () => {
    expect(stringWidth(toned('identifier', 'abcdef'))).toBe(6);
  });

  it('splits into a span per run, unmarked text included', () => {
    expect(toneSpans(`${toned('structure', '│')}  ${toned('ref', '@db')} tail`)).toEqual([
      { text: '│', tone: 'structure' },
      { text: '  ' },
      { text: '@db', tone: 'ref' },
      { text: ' tail' },
    ]);
  });

  it('gives a nested mark to the text it wraps, and the outer one to the rest', () => {
    const nested = toned('muted', `a${toned('emphasis', 'b')}c`);

    expect(toneSpans(nested)).toEqual([
      { text: 'a', tone: 'muted' },
      { text: 'b', tone: 'emphasis' },
      { text: 'c', tone: 'muted' },
    ]);
  });

  it('merges neighbouring runs that carry the same tone', () => {
    expect(toneSpans(toned('ref', 'a') + toned('ref', 'b'))).toEqual([{ text: 'ab', tone: 'ref' }]);
  });

  it('drops an escape sequence it does not recognise rather than passing it on', () => {
    expect(toneSpans('\u001B[31mred\u001B[39m')).toEqual([{ text: 'red' }]);
  });
});

describe('a marked block as drawing lines', () => {
  it('gives one entry per line and leaves an unmarked line a plain string', () => {
    expect(toneDrawing(`${toned('heading', 'app:')}\nplain`)).toEqual([
      [{ text: 'app:', tone: 'heading' }],
      'plain',
    ]);
  });

  it('carries no escape sequence into any line', () => {
    const lines = toneDrawing(`${toned('color-3', 'x')}\n${toned('highlight', 'y')}`);

    for (const line of lines) {
      const text = typeof line === 'string' ? line : line.map((span) => span.text).join('');
      expect(text).not.toContain('\u001B');
    }
  });
});
