import { contractError } from './contract-errors';

/**
 * Reserved sentinel domain namespace id for the late-bound application-domain
 * slot — the namespace a model lands in when it is authored without an explicit
 * namespace. This is target-agnostic: targets that allow un-namespaced
 * authoring (e.g. Mongo, SQLite) declare this id as their default on the target
 * descriptor; the framework names the sentinel, never a target. Mirrors
 * storage's `UNBOUND_NAMESPACE_ID` on the domain plane.
 */
export const UNBOUND_DOMAIN_NAMESPACE_ID = '__unbound__' as const;

/**
 * Resolve the single domain namespace of a single-namespace contract.
 *
 * Bare-name access (`db.User`) reads "the contract's one namespace". Every
 * contract in scope today declares exactly one domain namespace, so this is
 * exact — there is nothing to infer. A contract that declares more than one
 * namespace is ambiguous for a bare name, so rather than silently pick one this
 * throws; cross-namespace selection is made explicit (TML-2550).
 */
export function soleDomainNamespaceId(domain: {
  readonly namespaces: Readonly<Record<string, unknown>>;
}): string {
  const [soleNamespaceId, ...rest] = Object.keys(domain.namespaces);
  if (soleNamespaceId === undefined) {
    throw contractError('CONTRACT.NAMESPACE_INVALID', 'domain has no namespaces', {
      meta: { reason: 'no-domain-namespaces' },
    });
  }
  if (rest.length > 0) {
    const all = [soleNamespaceId, ...rest];
    throw contractError(
      'CONTRACT.NAMESPACE_INVALID',
      `bare-name resolution requires exactly one domain namespace, found ${all.length} (${all.join(', ')}); select a namespace explicitly`,
      { meta: { reason: 'multiple-domain-namespaces', namespaceIds: all } },
    );
  }
  return soleNamespaceId;
}
