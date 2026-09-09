import type {
  Contract,
  ContractModelBase,
  ContractReferenceRelation,
  ContractRelation,
  CrossReference,
} from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import {
  type ModelFieldTypeResolvers,
  resolveModelFieldType,
  serializeObjectKey,
  serializeValue,
} from './domain-type-generation';
import { emitterError } from './emitter-errors';

type ModelRef = {
  readonly namespaceId: string;
  readonly modelName: string;
  readonly model: ContractModelBase;
};

type NamespaceModels = {
  readonly namespaceId: string;
  readonly models: readonly ModelRef[];
};

type RelationLine = {
  readonly line: string;
  readonly hasJoin: boolean;
};

type MemberLines = {
  readonly fields: string[];
  readonly relationsByName: Map<string, RelationLine>;
};

const TYPESCRIPT_IDENTIFIER = /^[$A-Z_a-z][$\w]*$/;

function memberNameOf(namespaceId: string, modelName: string): string {
  const segment = namespaceId === UNBOUND_NAMESPACE_ID ? 'unbound' : namespaceId;
  return `${segment}_${modelName}`;
}

function claimMemberName(claims: Map<string, string>, memberName: string, source: string): void {
  if (!TYPESCRIPT_IDENTIFIER.test(memberName)) {
    throw emitterError(
      'CONTRACT.MODEL_TYPE_NAME_INVALID',
      `Emitted model type name "${memberName}" (from ${source}) is not a TypeScript identifier`,
      {
        why: 'Every entry in the emitted Models namespace is declared as `export type <name>`, so the name must be a TypeScript identifier.',
        fix: 'Rename the namespace or model so that <namespace>_<Model> contains only letters, digits, `$`, and `_`, and does not start with a digit.',
        meta: { memberName, source },
      },
    );
  }
  const existing = claims.get(memberName);
  if (existing !== undefined) {
    throw emitterError(
      'CONTRACT.MODEL_TYPE_NAME_COLLISION',
      `Emitted model type name "${memberName}" is produced by both ${existing} and ${source}`,
      {
        why: 'Every entry in the emitted Models namespace needs a distinct name, formed as <namespace>_<Model>.',
        fix: 'Rename one of the models or namespaces so the two names differ.',
        meta: { memberName, sources: [existing, source] },
      },
    );
  }
  claims.set(memberName, source);
}

function isPolymorphicBase(model: ContractModelBase): boolean {
  return model.discriminator !== undefined && model.variants !== undefined;
}

function findModel(
  namespaces: readonly NamespaceModels[],
  ref: CrossReference,
): ModelRef | undefined {
  return namespaces
    .find((ns) => ns.namespaceId === ref.namespace)
    ?.models.find((m) => m.modelName === ref.model);
}

function requireRelationTarget(
  namespaces: readonly NamespaceModels[],
  owner: ModelRef,
  relationName: string,
  ref: CrossReference,
): ModelRef {
  const target = findModel(namespaces, ref);
  if (target !== undefined) return target;
  const ownerSource = `${owner.namespaceId}.${owner.modelName}`;
  throw emitterError(
    'CONTRACT.MODEL_RELATION_TARGET_MISSING',
    `Relation "${relationName}" on ${ownerSource} targets ${ref.namespace}.${ref.model}, which is not in the contract`,
    {
      why: 'A same-space relation must point at a model the contract declares; only cross-space relations may reference models outside it.',
      fix: 'Declare the target model in the contract, or mark the relation as cross-space by giving its target a `space`.',
      meta: {
        owner: ownerSource,
        relationName,
        target: { namespaceId: ref.namespace, modelName: ref.model },
      },
    },
  );
}

function fieldLines(
  ref: ModelRef,
  resolvers: ModelFieldTypeResolvers,
  discriminatorType: { readonly field: string; readonly type: string } | undefined,
): string[] {
  return Object.entries(ref.model.fields).map(([fieldName, field]) => {
    const type =
      discriminatorType !== undefined && fieldName === discriminatorType.field
        ? discriminatorType.type
        : resolveModelFieldType(ref.modelName, fieldName, field, ref.model, resolvers).output;
    return `${serializeObjectKey(fieldName)}: ${type};`;
  });
}

function hasJoin(relation: ContractRelation): relation is ContractReferenceRelation {
  return 'on' in relation && relation.on !== undefined;
}

function relationLine(
  owner: ModelRef,
  relationName: string,
  relation: ContractRelation,
  namespaces: readonly NamespaceModels[],
): RelationLine | undefined {
  if (relation.to.space !== undefined) return undefined;
  const target = requireRelationTarget(namespaces, owner, relationName, relation.to);
  const targetMember = memberNameOf(
    target.namespaceId,
    isPolymorphicBase(target.model) ? `Any${target.modelName}` : target.modelName,
  );
  const key = serializeObjectKey(relationName);
  if (!hasJoin(relation)) {
    const embedded = relation.cardinality === '1:N' ? `${targetMember}[]` : targetMember;
    return { line: `${key}: ${embedded};`, hasJoin: false };
  }
  if (relation.cardinality === '1:N' || relation.cardinality === 'N:M') {
    return { line: `${key}: ${targetMember}[];`, hasJoin: true };
  }
  return {
    line: `${key}: ${relation.nullable ? `${targetMember} | null` : targetMember};`,
    hasJoin: true,
  };
}

function collectRelationLines(
  ref: ModelRef,
  namespaces: readonly NamespaceModels[],
): Map<string, RelationLine> {
  const lines = new Map<string, RelationLine>();
  for (const [relationName, relation] of Object.entries(ref.model.relations)) {
    const rendered = relationLine(ref, relationName, relation, namespaces);
    if (rendered !== undefined) lines.set(relationName, rendered);
  }
  return lines;
}

function discriminatorUnion(base: ContractModelBase): string {
  const values = Object.values(base.variants ?? {}).map((v) => serializeValue(v.value));
  return values.length > 0 ? values.join(' | ') : 'never';
}

function memberLines(
  ref: ModelRef,
  namespaces: readonly NamespaceModels[],
  resolvers: ModelFieldTypeResolvers,
): MemberLines {
  const base = ref.model.base !== undefined ? findModel(namespaces, ref.model.base) : undefined;
  if (base !== undefined && isPolymorphicBase(base.model)) {
    const discriminatorField = base.model.discriminator?.field ?? '';
    const variantValue = base.model.variants?.[ref.modelName]?.value;
    const discriminatorType = {
      field: discriminatorField,
      type:
        variantValue !== undefined ? serializeValue(variantValue) : discriminatorUnion(base.model),
    };
    const relationsByName = new Map([
      ...collectRelationLines(base, namespaces),
      ...collectRelationLines(ref, namespaces),
    ]);
    return {
      fields: [
        ...fieldLines(base, resolvers, discriminatorType),
        ...fieldLines(ref, resolvers, undefined),
      ],
      relationsByName,
    };
  }
  const discriminatorType = isPolymorphicBase(ref.model)
    ? { field: ref.model.discriminator?.field ?? '', type: discriminatorUnion(ref.model) }
    : undefined;
  return {
    fields: fieldLines(ref, resolvers, discriminatorType),
    relationsByName: collectRelationLines(ref, namespaces),
  };
}

function renderMember(memberName: string, lines: MemberLines, hasOwner: boolean): string {
  const entries = [...lines.relationsByName];
  const joinlessLines = entries.filter(([, r]) => !r.hasJoin).map(([, r]) => r.line);
  const joinedLines = entries.filter(([, r]) => r.hasJoin).map(([, r]) => r.line);
  const relationNames = entries.filter(([, r]) => r.hasJoin).map(([name]) => name);
  const phantom =
    relationNames.length > 0
      ? relationNames.map((name) => serializeValue(name)).join(' | ')
      : 'never';
  const body = [
    ...lines.fields,
    ...joinlessLines,
    ...joinedLines,
    ...(hasOwner ? [] : [`readonly [RelationKeys]?: ${phantom};`]),
  ]
    .map((line) => `    ${line}`)
    .join('\n');
  return `  export type ${memberName} = {\n${body}\n  };`;
}

function namespaceModelsOf(contract: Contract): NamespaceModels[] {
  return Object.entries(contract.domain.namespaces).map(([namespaceId, ns]) => ({
    namespaceId,
    models: Object.entries(ns.models).map(([modelName, model]) => ({
      namespaceId,
      modelName,
      model,
    })),
  }));
}

export function generateModelTypesBlock(
  contract: Contract,
  resolvers: ModelFieldTypeResolvers,
): string {
  const namespaces = namespaceModelsOf(contract);
  const claims = new Map<string, string>();
  for (const ns of namespaces) {
    for (const ref of ns.models) {
      claimMemberName(
        claims,
        memberNameOf(ns.namespaceId, ref.modelName),
        `${ns.namespaceId}.${ref.modelName}`,
      );
    }
  }
  for (const ns of namespaces) {
    for (const ref of ns.models) {
      if (!isPolymorphicBase(ref.model)) continue;
      claimMemberName(
        claims,
        memberNameOf(ns.namespaceId, `Any${ref.modelName}`),
        `${ns.namespaceId}.Any<${ref.modelName}>`,
      );
    }
  }

  const members: string[] = [];
  const constantEntries: string[] = [];
  for (const ns of namespaces) {
    const keys: string[] = [];
    for (const ref of ns.models) {
      const memberName = memberNameOf(ns.namespaceId, ref.modelName);
      members.push(
        renderMember(
          memberName,
          memberLines(ref, namespaces, resolvers),
          ref.model.owner !== undefined,
        ),
      );
      keys.push(`    ${serializeObjectKey(ref.modelName)}: Models.${memberName};`);
    }
    for (const ref of ns.models) {
      if (!isPolymorphicBase(ref.model)) continue;
      const unionName = memberNameOf(ns.namespaceId, `Any${ref.modelName}`);
      const variantMembers = Object.keys(ref.model.variants ?? {}).map((variantName) =>
        memberNameOf(ns.namespaceId, variantName),
      );
      members.push(
        `  export type ${unionName} = ${variantMembers.length > 0 ? variantMembers.join(' | ') : 'never'};`,
      );
      keys.push(`    ${serializeObjectKey(`Any${ref.modelName}`)}: Models.${unionName};`);
    }
    const nsKey = serializeObjectKey(ns.namespaceId);
    constantEntries.push(
      keys.length > 0 ? `  ${nsKey}: {\n${keys.join('\n')}\n  };` : `  ${nsKey}: {};`,
    );
  }

  const namespaceBlock =
    members.length > 0
      ? `export namespace Models {\n${members.join('\n')}\n}`
      : 'export namespace Models {}';
  const constantBlock = `export declare const models: {\n${constantEntries.join('\n')}\n};`;
  return `${namespaceBlock}\n\n${constantBlock}`;
}
