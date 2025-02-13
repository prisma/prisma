import { ESLintUtils } from '@typescript-eslint/utils'

export default ESLintUtils.RuleCreator.withoutDocs({
  defaultOptions: [],
  meta: {
    messages: {
      mustBeExported: 'All types within ./types/exported directory must be exported',
    },
    schema: [],
    type: 'problem',
  },

  create(context) {
    return {
      TSTypeAliasDeclaration(node) {
        if (node.parent.type !== 'ExportNamedDeclaration') {
          context.report({
            messageId: 'mustBeExported',
            node: node.id,
          })
        }
      },
    }
  },
})
