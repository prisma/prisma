import {
  type ApplicationDomain,
  type ContractModelBase,
  type ContractValueObject,
  UNBOUND_DOMAIN_NAMESPACE_ID,
} from '@internal/contract/types';

export function applicationDomainOf(params: {
  readonly models?: Record<string, ContractModelBase>;
  readonly valueObjects?: Record<string, ContractValueObject>;
  readonly namespaceId?: string;
}): ApplicationDomain {
  const namespaceId = params.namespaceId ?? UNBOUND_DOMAIN_NAMESPACE_ID;
  const models = params.models ?? {};
  return {
    namespaces: {
      [namespaceId]: {
        models,
        ...(params.valueObjects !== undefined ? { valueObjects: params.valueObjects } : {}),
      },
    },
  };
}
