import type { IRNode } from './ir-node';

/**
 * Framework-level alphabet for entries in a storage `types` slot.
 *
 * The slot is polymorphic at the framework level: a family or target can
 * persist either a JSON-clean codec-triple object literal (carrying
 * `kind: 'codec-instance'`) or a class-instance IR node with a narrower
 * kind discriminator (e.g. `'<kind>'`). Hydration walkers,
 * verifiers, and planners dispatch on the `kind` literal to recover the
 * precise variant.
 *
 * The `kind` field is required at this layer (in contrast with
 * `IRNode.kind` which is optional) because the slot's downstream
 * consumers dispatch on it — without a guaranteed discriminator the
 * polymorphic walk cannot pick the right reader. Concrete variants
 * narrow `kind` to their literal and add their own field set;
 * downstream consumers use `kind`-discriminator helpers to recover
 * the precise shape.
 */
export interface StorageType extends IRNode {
  readonly kind: string;
}
