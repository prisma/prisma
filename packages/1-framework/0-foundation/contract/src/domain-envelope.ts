import type { ContractEnum, ContractModelBase, ContractValueObject } from './domain-types';

export { UNBOUND_DOMAIN_NAMESPACE_ID } from './default-namespace';

/**
 * One namespace's application-domain entities — models and optional value
 * objects keyed by entity name within that namespace coordinate.
 */
export interface ApplicationDomainNamespace {
  readonly models: Record<string, ContractModelBase>;
  readonly valueObjects?: Record<string, ContractValueObject>;
  readonly enum?: Record<string, ContractEnum>;
}

/**
 * Application-domain envelope: entity content keyed by namespace id.
 * Mirrors the storage plane's `namespaces` segment (ADR 221).
 */
export interface ApplicationDomain {
  readonly namespaces: Readonly<Record<string, ApplicationDomainNamespace>>;
}

export type ContractWithDomain = {
  readonly domain: ApplicationDomain;
};
