import { sqlTargetTypeConstructors } from '@internal/family-sql/pack';
import type { AuthoringTypeNamespace } from '@internal/framework-components/authoring';

/** The type constructors whose arguments are sizes, which take values of `mysql/int`. */
export const mysqlAuthoringTypes = {
  .../* @__PURE__ */ sqlTargetTypeConstructors({ sizeType: 'mysql/int' }),
} as const satisfies AuthoringTypeNamespace;
