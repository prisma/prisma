import type { Span, Text, Tone } from '@prisma/cli-engine';

/**
 * The drawing formatters compose one string per line, measuring column widths
 * with `string-width` as they go. To carry colour through that pipeline without
 * disturbing a single width, a tone is marked with an SGR escape sequence:
 * `string-width` and `strip-ansi` already treat those as zero-width, so every
 * existing width calculation keeps its answer.
 *
 * The marks are a transport, not output. {@link toneDrawing} turns a marked
 * string into the engine's spans, and it drops every escape sequence it sees —
 * so no escape sequence can reach the engine, which does the painting itself.
 */
const TONE_MARK_BASE = 900;

/** The escape character every SGR sequence opens with. */
const ESCAPE = String.fromCharCode(27);

/** Ends the innermost open mark. */
const TONE_MARK_END = `${ESCAPE}[${TONE_MARK_BASE}m`;

/**
 * Every tone, in the order their marks are numbered. Exported so a test can
 * hold it against a compiler-checked list of the engine's tones: a tone
 * missing from here would silently lose its colour.
 */
export const TONE_ORDER: readonly Tone[] = [
  'ok',
  'warn',
  'error',
  'info',
  'heading',
  'identifier',
  'ref',
  'placeholder',
  'link',
  'emphasis',
  'muted',
  'structure',
  'highlight',
  'color-1',
  'color-2',
  'color-3',
  'color-4',
  'color-5',
  'color-6',
];

const MARK_BY_TONE = new Map<Tone, number>(
  TONE_ORDER.map((tone, index) => [tone, TONE_MARK_BASE + index + 1]),
);

const TONE_BY_MARK = new Map<number, Tone>(
  TONE_ORDER.map((tone, index) => [TONE_MARK_BASE + index + 1, tone]),
);

/** Marks `text` as carrying `tone`. Marks nest; the innermost one wins. */
export function toned(tone: Tone, text: string): string {
  return `${ESCAPE}[${MARK_BY_TONE.get(tone)}m${text}${TONE_MARK_END}`;
}

/** The painter shape the formatters take, bound to one tone. */
export function tonePainter(tone: Tone): (text: string) => string {
  return (text) => toned(tone, text);
}

const SGR_SEQUENCE = new RegExp(`${ESCAPE}\\[(\\d+)m`, 'g');

function pushSpan(spans: Span[], text: string, tone: Tone | undefined): void {
  if (text.length === 0) {
    return;
  }
  const previous = spans.at(-1);
  if (previous !== undefined && previous.tone === tone) {
    spans[spans.length - 1] = {
      text: previous.text + text,
      ...(tone === undefined ? {} : { tone }),
    };
    return;
  }
  spans.push({ text, ...(tone === undefined ? {} : { tone }) });
}

/** One marked line as spans. Text carrying no mark becomes an untoned span. */
export function toneSpans(line: string): readonly Span[] {
  const spans: Span[] = [];
  const open: Tone[] = [];
  let cursor = 0;
  SGR_SEQUENCE.lastIndex = 0;
  for (let match = SGR_SEQUENCE.exec(line); match !== null; match = SGR_SEQUENCE.exec(line)) {
    pushSpan(spans, line.slice(cursor, match.index), open.at(-1));
    cursor = match.index + match[0].length;
    const code = Number(match[1]);
    if (code === TONE_MARK_BASE) {
      open.pop();
      continue;
    }
    const tone = TONE_BY_MARK.get(code);
    if (tone !== undefined) {
      open.push(tone);
    }
  }
  pushSpan(spans, line.slice(cursor), open.at(-1));
  return spans;
}

/**
 * A marked block as the lines of a `drawing` block. A line with no marks stays
 * a plain string, which is what the engine's `Text` wants for untoned text.
 */
export function toneDrawing(block: string): readonly Text[] {
  return block.split('\n').map((line) => {
    const spans = toneSpans(line);
    if (spans.length === 0) {
      return '';
    }
    const only = spans.length === 1 ? spans[0] : undefined;
    return only !== undefined && only.tone === undefined ? only.text : spans;
  });
}
