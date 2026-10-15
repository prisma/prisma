import { dirname } from 'pathe';

export function contractInputDirectory(input: string): {
  readonly directory: string;
  readonly patternSuffix: string | undefined;
} {
  const boundary = input.search(/[*?\\()[\]{}]/);
  if (boundary < 0) return { directory: dirname(input), patternSuffix: undefined };
  const prefix = input.slice(0, boundary);
  return {
    directory: prefix.includes('/') ? dirname(`${prefix}_`) : '',
    patternSuffix: input.slice(boundary),
  };
}
