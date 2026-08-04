import { structuredError } from '@internal/utils/structured-error';
import type { MongoContract, MongoModelDefinition } from './contract-types';

function formatCrossRef(crossRef: { readonly namespace: string; readonly model: string }): string {
  return `${crossRef.namespace}.${crossRef.model}`;
}

function storageDeclaresCollection(
  storage: MongoContract['storage'],
  collectionName: string,
): boolean {
  for (const ns of Object.values(storage.namespaces)) {
    if (Object.hasOwn(ns.entries['collection'] ?? {}, collectionName)) {
      return true;
    }
  }
  return false;
}

export function validateMongoStorage(contract: MongoContract): void {
  const errors: string[] = [];

  for (const [namespaceId, namespace] of Object.entries(contract.domain.namespaces)) {
    const models = namespace.models as Record<string, MongoModelDefinition>;
    for (const [modelName, model] of Object.entries(models)) {
      const qualifiedName = `${namespaceId}:${modelName}`;
      if (
        model.storage.collection &&
        !storageDeclaresCollection(contract.storage, model.storage.collection)
      ) {
        errors.push(
          `Model "${qualifiedName}" references collection "${model.storage.collection}" which is not declared under any namespace's collections map`,
        );
      }

      if (model.base) {
        const baseModel = models[model.base.model];
        if (baseModel) {
          const variantCollection = model.storage.collection;
          const baseCollection = baseModel.storage.collection;
          if (variantCollection !== baseCollection) {
            errors.push(
              `Mongo does not support multi-table inheritance; variant "${qualifiedName}" must share its base's collection ("${baseCollection ?? '(none)'}"), but has "${variantCollection ?? '(none)'}"`,
            );
          }
        }
      }

      for (const [relName, relation] of Object.entries(model.relations ?? {})) {
        const targetModel = models[relation.to.model];
        const targetLabel = formatCrossRef(relation.to);

        if (targetModel?.owner) {
          if (targetModel.owner !== modelName) {
            errors.push(
              `Embed relation "${relName}" targets "${targetLabel}" which is owned by "${targetModel.owner}", not "${qualifiedName}"`,
            );
          }
          if (targetModel.storage.collection) {
            errors.push(
              `Embed relation "${relName}" targets "${targetLabel}" which must not have a collection`,
            );
          }
        } else if ('on' in relation && relation.on) {
          for (const localField of relation.on.localFields) {
            if (!(localField in model.fields)) {
              errors.push(
                `Reference relation "${relName}": localField "${localField}" is not a field on model "${qualifiedName}"`,
              );
            }
          }

          if (targetModel) {
            for (const targetField of relation.on.targetFields) {
              if (!(targetField in targetModel.fields)) {
                errors.push(
                  `Reference relation "${relName}": targetField "${targetField}" is not a field on model "${targetLabel}"`,
                );
              }
            }
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw structuredError(
      'CONTRACT.VALIDATION_FAILED',
      `Contract storage validation failed:\n- ${errors.join('\n- ')}`,
    );
  }
}
