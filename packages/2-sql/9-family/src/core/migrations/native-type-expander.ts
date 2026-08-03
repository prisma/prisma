import type { TargetBoundComponentDescriptor } from '@internal/framework-components/components';
import { extractCodecControlHooks } from '../assembly';

/**
 * Builds the codec-hook-composed `expandNativeType` callback the contract→IR
 * derivation uses to expand parameterized native types (e.g. `character` +
 * `{ length: 36 }` → `character(36)`). Returns `undefined` when no framework
 * components are supplied, so callers can omit the option entirely.
 */
export function buildNativeTypeExpander(
  frameworkComponents?: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>>,
) {
  if (!frameworkComponents) {
    return undefined;
  }
  const codecHooks = extractCodecControlHooks(frameworkComponents);
  return (input: {
    readonly nativeType: string;
    readonly codecId?: string;
    readonly typeParams?: Record<string, unknown>;
  }) => {
    if (!input.typeParams) return input.nativeType;
    if (!input.codecId) return input.nativeType;
    const hooks = codecHooks.get(input.codecId);
    if (!hooks?.expandNativeType) return input.nativeType;
    return hooks.expandNativeType(input);
  };
}
