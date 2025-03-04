import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

// Add files to this list only if there is no other option.
// Almost always this should be third-party libraries.
// In case of first-party code, prefer to move it into correct location
const allowList = new Set(['sql-template-tag', '@prisma/generator-helper', 'decimal.js'])

export default ESLintUtils.RuleCreator.withoutDocs({
  defaultOptions: [],
  meta: {
    messages: {
      notAllowedImport: 'Files in ./types/exported are allowed to import only from other files in ./types/exported',
    },
    schema: [],
    type: 'problem',
  },

  create(context) {
    const checkImport = (
      // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
      node: TSESTree.ImportDeclaration | TSESTree.ExportAllDeclaration | TSESTree.ExportNamedDeclaration,
    ) => {
      if (!node.source) {
        return
      }
      if (!node.source.value.startsWith('./') && !allowList.has(node.source.value)) {
        context.report({
          messageId: 'notAllowedImport',
          node: node.source,
        })
      }
    }
    return {
      ImportDeclaration: checkImport,
      ExportAllDeclaration: checkImport,
      ExportNamedDeclaration: checkImport,
    }
  },
})
