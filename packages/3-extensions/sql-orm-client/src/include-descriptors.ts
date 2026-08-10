import type { StripRowType } from './collection-internal-types';
import type { CollectionState, IncludeCombine, IncludeCombineBranch, IncludeScalar } from './types';

interface CollectionStateCarrier {
  readonly state: CollectionState;
}

export function createIncludeScalar<Result>(
  fn: IncludeScalar<Result>['fn'],
  state: CollectionState,
  column?: string,
): IncludeScalar<Result> {
  return {
    kind: 'includeScalar',
    fn,
    state,
    ...(column !== undefined ? { column } : {}),
  } satisfies StripRowType<IncludeScalar<Result>> as IncludeScalar<Result>;
}

export function createIncludeCombine<ResultShape extends Record<string, unknown>>(
  branches: Record<string, IncludeCombineBranch>,
): IncludeCombine<ResultShape> {
  return {
    kind: 'includeCombine',
    branches,
  } satisfies StripRowType<IncludeCombine<ResultShape>> as IncludeCombine<ResultShape>;
}

export function isIncludeScalar(value: unknown): value is IncludeScalar<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    kind?: unknown;
    fn?: unknown;
    state?: unknown;
  };

  // The operation vocabulary is open: any string names a potentially
  // contributed operation, so validity is shape-only.
  return (
    candidate.kind === 'includeScalar' &&
    typeof candidate.fn === 'string' &&
    isCollectionState(candidate.state)
  );
}

export function isIncludeCombine(value: unknown): value is IncludeCombine<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    kind?: unknown;
    branches?: unknown;
  };

  if (candidate.kind !== 'includeCombine') {
    return false;
  }

  if (typeof candidate.branches !== 'object' || candidate.branches === null) {
    return false;
  }

  return true;
}

export function isCollectionStateCarrier(value: unknown): value is CollectionStateCarrier {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { state?: unknown };
  return isCollectionState(candidate.state);
}

function isCollectionState(value: unknown): value is CollectionState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    filters?: unknown;
    includes?: unknown;
  };

  return Array.isArray(candidate.filters) && Array.isArray(candidate.includes);
}
