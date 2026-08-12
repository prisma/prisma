import type { Contract } from '@internal/contract/types';
import {
  mergeCapabilityMatrices,
  type TargetBoundComponentDescriptor,
} from '@internal/framework-components/components';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  const next: Record<string, unknown> = {};
  for (const [key, child] of entries) {
    next[key] = sortDeep(child);
  }
  return next;
}

function sortDeepTyped<T>(value: T): T {
  return sortDeep(value) as T;
}

function extractExtensionPackMeta(
  component: TargetBoundComponentDescriptor<string, string>,
): Record<string, unknown> {
  const { kind, id, version, capabilities, types } = component;
  const base: Record<string, unknown> = {
    kind,
    id,
    familyId: component.familyId,
    targetId: component.targetId,
    version,
  };
  if (capabilities) {
    base['capabilities'] = capabilities;
  }
  if (types) {
    if (types.codecTypes) {
      const {
        controlPlaneHooks: _,
        codecDescriptors: _cd,
        ...cleanedCodecTypes
      } = types.codecTypes;
      base['types'] = { ...types, codecTypes: cleanedCodecTypes };
    } else {
      base['types'] = types;
    }
  }
  return base;
}

/**
 * Enriches a raw contract with framework-derived metadata: capabilities from all component descriptors and extension pack metadata from extension descriptors. Produces deterministically sorted output.
 */
export function enrichContract(
  ir: Contract,
  components: ReadonlyArray<TargetBoundComponentDescriptor<string, string>>,
): Contract {
  const mergedCapabilities = mergeCapabilityMatrices(ir.capabilities, components);

  const extensionsMeta: Record<string, unknown> = {};
  for (const component of components) {
    if (component.kind === 'extension') {
      extensionsMeta[component.id] = extractExtensionPackMeta(component);
    }
  }

  const extensions =
    Object.keys(extensionsMeta).length > 0
      ? { ...ir.extensions, ...extensionsMeta }
      : ir.extensions;

  return {
    ...ir,
    capabilities: sortDeepTyped(mergedCapabilities),
    extensions: sortDeepTyped(extensions),
  };
}
