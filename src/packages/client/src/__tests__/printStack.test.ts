import { printStack } from '../runtime/utils/printStack'
import stripAnsi from 'strip-ansi'
const { getStack } = require('./fixtures/stack')

test('basic printStack', () => {
  const callsite = getStack()

  let stack = stripAnsi(
    printStack({
      callsite,
      originalMethod: 'test-method',
      showColors: false,
      onUs: false,
      renderPathRelative: true,
      printFullStack: true,
    }).stack,
  )

  expect(stack).toMatchInlineSnapshot(`
    "
    Invalid \`client.user.findMany()\` invocation in
    src/__tests__/fixtures/stack.js:14:30

      10 const client = new PrismaClient()
      11 
      12 const templateString = \`hello\`
      13 const templateString2 = \`\${123}\${256}\`
    → 14 const result = client.user.findMany("
  `)
})
