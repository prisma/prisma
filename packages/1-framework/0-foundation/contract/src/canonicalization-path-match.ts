import type { PreserveEmptyPredicate } from './canonicalization';

export type PathSegment = string | '*' | readonly string[];

export type PathPattern = readonly PathSegment[];

export function matchesPathPattern(path: readonly string[], pattern: PathPattern): boolean {
  if (path.length !== pattern.length) {
    return false;
  }

  for (let i = 0; i < pattern.length; i++) {
    const segment = pattern[i];
    const value = path[i];
    if (segment === undefined || value === undefined) {
      return false;
    }

    if (segment === '*') {
      continue;
    }

    if (typeof segment === 'string') {
      if (value !== segment) {
        return false;
      }
      continue;
    }

    if (Array.isArray(segment)) {
      if (!segment.includes(value)) {
        return false;
      }
    }
  }

  return true;
}

export function createPreserveEmptyPredicate(
  patterns: readonly PathPattern[],
): PreserveEmptyPredicate {
  return (path) => patterns.some((pattern) => matchesPathPattern(path, pattern));
}
