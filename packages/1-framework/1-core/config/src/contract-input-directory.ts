import globParent from 'glob-parent';

export function contractInputDirectory(input: string): string {
  return globParent(input, { flipBackslashes: false });
}
