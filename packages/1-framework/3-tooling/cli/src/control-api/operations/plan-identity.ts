import { createHash } from 'node:crypto';
import { canonicalizeJson } from '@internal/framework-components/utils';

/**
 * Content identity of a `db update` plan: what it does (the ordered display
 * operations) and where it lands (the destination storage hash). A
 * `DESTRUCTIVE_CHANGES` refusal names the refused plan by this hash, and the
 * apply that carries the consent back recomputes it to prove it is still
 * applying the plan that was consented to.
 */
export function computePlanHash(plan: {
  readonly operations: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly operationClass: string;
  }>;
  readonly destination: { readonly storageHash: string };
}): string {
  const canonical = canonicalizeJson({
    operations: plan.operations,
    destination: { storageHash: plan.destination.storageHash },
  });
  return createHash('sha256').update(canonical).digest('hex');
}
