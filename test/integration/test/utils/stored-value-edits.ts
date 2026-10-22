import { expect } from 'vitest';

/** One call of `name` in `source` from its start, written on one line with double quotes and no trailing commas. */
function oneLineCalls(source: string, name: string): string {
  let out = '';
  let rest = source;
  for (;;) {
    const start = rest.indexOf(`this.${name}({`);
    if (start === -1) return out + rest;
    let depth = 0;
    let end = start;
    for (let i = start; i < rest.length; i += 1) {
      if (rest[i] === '(') depth += 1;
      if (rest[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    const call = rest
      .slice(start, end)
      .replace(/'/g, '"')
      .replace(/,\s*}/g, ' }')
      .replace(/\s+/g, ' ')
      .replace(/\{ /g, '{ ')
      .replace(/\( /g, '(');
    out += rest.slice(0, start) + call;
    rest = rest.slice(end);
  }
}

/** Makes each `replace <call> with <call>` edit the advice prints, as printed, in the formatted `source`. */
export function followEdits(source: string, advice: string): string {
  const edits = [
    ...advice.matchAll(
      /replace (this\.removeStoredValue\(\{.*?\}\)) with (this\.replaceStoredValue\(\{.*?\}\)(?:, this\.replaceStoredValue\(\{.*?\}\))*)/g,
    ),
  ];
  expect(edits.length, 'the advice prints an edit').toBeGreaterThan(0);
  let edited = oneLineCalls(source, 'removeStoredValue');
  for (const [, remove = '', replaceWith = ''] of edits) {
    expect(edited, 'the file holds the call the advice names').toContain(remove);
    edited = edited.replace(remove, replaceWith);
  }
  return edited;
}
