import { checkContractComponentRequirements } from '../shared/framework-components';
import { runtimeError } from '../shared/runtime-error';
import type {
  RuntimeAdapterDescriptor,
  RuntimeExtensionDescriptor,
  RuntimeFamilyDescriptor,
  RuntimeTargetDescriptor,
} from './execution-descriptors';

export function assertRuntimeContractRequirementsSatisfied<
  TFamilyId extends string,
  TTargetId extends string,
>({
  contract,
  family,
  target,
  adapter,
  extensions,
}: {
  readonly contract: { readonly target: string; readonly extensions?: Record<string, unknown> };
  readonly family: RuntimeFamilyDescriptor<TFamilyId>;
  readonly target: RuntimeTargetDescriptor<TFamilyId, TTargetId>;
  readonly adapter: RuntimeAdapterDescriptor<TFamilyId, TTargetId>;
  readonly extensions: readonly RuntimeExtensionDescriptor<TFamilyId, TTargetId>[];
}): void {
  const providedComponentIds = new Set<string>([family.id, target.id, adapter.id]);
  for (const extension of extensions) {
    providedComponentIds.add(extension.id);
  }

  const result = checkContractComponentRequirements({
    contract,
    expectedTargetId: target.targetId,
    providedComponentIds,
  });

  if (result.targetMismatch) {
    throw runtimeError(
      'CONTRACT.TARGET_MISMATCH',
      `Contract target '${result.targetMismatch.actual}' does not match runtime target descriptor '${result.targetMismatch.expected}'.`,
    );
  }

  for (const packId of result.missingExtensionPackIds) {
    throw runtimeError(
      'RUNTIME.MISSING_EXTENSION_PACK',
      `Contract requires extension pack '${packId}', but runtime descriptors do not provide a matching component.`,
    );
  }
}
