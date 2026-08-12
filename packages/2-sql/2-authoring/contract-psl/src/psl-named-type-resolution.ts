import type { ContractSourceDiagnostic } from '@internal/config/config-types';
import type { AuthoringContributions } from '@internal/framework-components/authoring';
import type { NamedTypeSymbol } from '@internal/psl-parser';
import type { StorageTypeInstance } from '@internal/sql-contract/types';
import { formatDbAttributeMigrationMessage } from './psl-attribute-parsing';
import {
  type ColumnDescriptor,
  checkUncomposedNamespace,
  instantiatePslTypeConstructor,
  reportUncomposedNamespace,
  resolvePslTypeConstructorDescriptor,
  toNamedTypeFieldDescriptor,
} from './psl-column-resolution';

export interface ResolveNamedTypeDeclarationsInput {
  readonly declarations: readonly NamedTypeSymbol[];
  readonly sourceId: string;
  readonly enumTypeDescriptors: ReadonlyMap<string, ColumnDescriptor>;
  readonly scalarColumnDescriptors: ReadonlyMap<string, ColumnDescriptor>;
  readonly composedExtensions: ReadonlySet<string>;
  readonly familyId: string;
  readonly targetId: string;
  readonly authoringContributions: AuthoringContributions | undefined;
  readonly diagnostics: ContractSourceDiagnostic[];
}

function validateNamedTypeAttributes(input: {
  readonly declaration: NamedTypeSymbol;
  readonly sourceId: string;
  readonly diagnostics: ContractSourceDiagnostic[];
  readonly composedExtensions: ReadonlySet<string>;
  readonly authoringContributions: AuthoringContributions | undefined;
  readonly familyId: string;
  readonly targetId: string;
}): boolean {
  let hasUnsupportedNamedTypeAttribute = false;

  for (const attribute of input.declaration.attributes) {
    if (attribute.name.startsWith('db.')) {
      input.diagnostics.push({
        code: 'PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE',
        message: formatDbAttributeMigrationMessage(attribute),
        sourceId: input.sourceId,
        span: attribute.span,
      });
      hasUnsupportedNamedTypeAttribute = true;
      continue;
    }

    const uncomposedNamespace = checkUncomposedNamespace(attribute.name, input.composedExtensions, {
      familyId: input.familyId,
      targetId: input.targetId,
      authoringContributions: input.authoringContributions,
    });
    if (uncomposedNamespace) {
      reportUncomposedNamespace({
        subjectLabel: `Attribute "@${attribute.name}"`,
        namespace: uncomposedNamespace,
        sourceId: input.sourceId,
        span: attribute.span,
        diagnostics: input.diagnostics,
      });
      hasUnsupportedNamedTypeAttribute = true;
      continue;
    }

    input.diagnostics.push({
      code: 'PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE',
      message: `Named type "${input.declaration.name}" uses unsupported attribute "${attribute.name}"`,
      sourceId: input.sourceId,
      span: attribute.span,
    });
    hasUnsupportedNamedTypeAttribute = true;
  }

  return hasUnsupportedNamedTypeAttribute;
}

export function resolveNamedTypeDeclarations(input: ResolveNamedTypeDeclarationsInput): {
  readonly storageTypes: Record<string, StorageTypeInstance>;
  readonly namedTypeDescriptors: Map<string, ColumnDescriptor>;
} {
  const storageTypeEntries: [string, StorageTypeInstance][] = [];
  const namedTypeDescriptors = new Map<string, ColumnDescriptor>();

  for (const declaration of input.declarations) {
    if (declaration.isConstructor) {
      const typeConstructor = declaration.typeConstructor;
      if (typeConstructor === undefined) {
        input.diagnostics.push({
          code: 'PSL_UNSUPPORTED_NAMED_TYPE_BASE',
          message: `Named type "${declaration.name}" must declare a base type or constructor`,
          sourceId: input.sourceId,
          span: declaration.span,
        });
        continue;
      }

      const hasUnsupportedNamedTypeAttribute = validateNamedTypeAttributes({
        declaration,
        sourceId: input.sourceId,
        diagnostics: input.diagnostics,
        composedExtensions: input.composedExtensions,
        authoringContributions: input.authoringContributions,
        familyId: input.familyId,
        targetId: input.targetId,
      });
      if (hasUnsupportedNamedTypeAttribute) {
        continue;
      }

      const helperPath = typeConstructor.path.join('.');
      const descriptor = resolvePslTypeConstructorDescriptor({
        call: typeConstructor,
        authoringContributions: input.authoringContributions,
        composedExtensions: input.composedExtensions,
        familyId: input.familyId,
        targetId: input.targetId,
        diagnostics: input.diagnostics,
        sourceId: input.sourceId,
        unsupportedCode: 'PSL_UNSUPPORTED_NAMED_TYPE_CONSTRUCTOR',
        unsupportedMessage: `Named type "${declaration.name}" references unsupported constructor "${helperPath}"`,
      });
      if (!descriptor) {
        continue;
      }

      const storageType = instantiatePslTypeConstructor({
        call: typeConstructor,
        descriptor,
        diagnostics: input.diagnostics,
        sourceId: input.sourceId,
        entityLabel: `Named type "${declaration.name}"`,
      });
      if (!storageType) {
        continue;
      }

      namedTypeDescriptors.set(
        declaration.name,
        toNamedTypeFieldDescriptor(declaration.name, storageType),
      );
      storageTypeEntries.push([
        declaration.name,
        {
          kind: 'codec-instance',
          codecId: storageType.codecId,
          nativeType: storageType.nativeType,
          typeParams: storageType.typeParams ?? {},
        },
      ]);
      continue;
    }

    const baseType = declaration.baseType;
    if (baseType === undefined) {
      input.diagnostics.push({
        code: 'PSL_UNSUPPORTED_NAMED_TYPE_BASE',
        message: `Named type "${declaration.name}" must declare a base type or constructor`,
        sourceId: input.sourceId,
        span: declaration.span,
      });
      continue;
    }

    const baseDescriptor =
      input.enumTypeDescriptors.get(baseType) ?? input.scalarColumnDescriptors.get(baseType);
    if (!baseDescriptor) {
      input.diagnostics.push({
        code: 'PSL_UNSUPPORTED_NAMED_TYPE_BASE',
        message: `Named type "${declaration.name}" references unsupported base type "${baseType}"`,
        sourceId: input.sourceId,
        span: declaration.span,
      });
      continue;
    }

    const hasUnsupportedNamedTypeAttribute = validateNamedTypeAttributes({
      declaration,
      sourceId: input.sourceId,
      diagnostics: input.diagnostics,
      composedExtensions: input.composedExtensions,
      authoringContributions: input.authoringContributions,
      familyId: input.familyId,
      targetId: input.targetId,
    });
    if (hasUnsupportedNamedTypeAttribute) {
      continue;
    }

    const descriptor = toNamedTypeFieldDescriptor(declaration.name, baseDescriptor);
    namedTypeDescriptors.set(declaration.name, descriptor);
    storageTypeEntries.push([
      declaration.name,
      {
        kind: 'codec-instance',
        codecId: baseDescriptor.codecId,
        nativeType: baseDescriptor.nativeType,
        typeParams: baseDescriptor.typeParams ?? {},
      },
    ]);
  }

  return { storageTypes: Object.fromEntries(storageTypeEntries), namedTypeDescriptors };
}
