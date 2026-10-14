import { dirname } from 'pathe';

export function contractInputDirectory(input: string): {
  readonly directory: string;
  readonly hasPatternBoundary: boolean;
} {
  const segments = input.split('/');
  const boundary = segments.findIndex((segment) => /[*?\\()[\]{}]/.test(segment));
  if (boundary < 0) return { directory: dirname(input), hasPatternBoundary: false };
  return {
    directory: segments.slice(0, boundary).join('/') || (input.startsWith('/') ? '/' : ''),
    hasPatternBoundary: true,
  };
}
