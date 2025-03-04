import { ESLintUtils } from '@typescript-eslint/utils'
import fs from 'node:fs'
import path from 'node:path'

export default ESLintUtils.RuleCreator.withoutDocs({
  defaultOptions: [],
  meta: {
    messages: {
      invalidExport: 'Only `export * from "./other-file" statements are allowed within types/exported/index.ts`',
      notAllowedExport: './types/exported/index.ts is allowed to export only from other files in ./types/exported',
      missingReExports: 'Missing re-exports from following sub-modules: {{ missingReExports }}',
    },
    schema: [],
    type: 'problem',
  },

  create(context) {
    return {
      Program(node) {
        const expectedExports = new Set(
          fs
            .readdirSync(path.dirname(context.filename))
            .filter((fileName) => fileName.endsWith('.ts'))
            .map((fileName) => `./${fileName.replace(/\.ts$/, '')}`),
        )
        expectedExports.delete('./index')
        for (const statement of node.body) {
          if (statement.type !== 'ExportAllDeclaration') {
            context.report({
              messageId: 'invalidExport',
              node: statement,
            })
            continue
          }

          const from = statement.source.value
          if (!from.startsWith('./')) {
            context.report({
              messageId: 'notAllowedExport',
              node: statement.source,
            })
            continue
          }

          expectedExports.delete(from)
        }

        if (expectedExports.size > 0) {
          context.report({
            messageId: 'missingReExports',
            data: {
              missingReExports: Array.from(expectedExports).join(', '),
            },
            node,
          })
        }
      },
    }
  },
})
