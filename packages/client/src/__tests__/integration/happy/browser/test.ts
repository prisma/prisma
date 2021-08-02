import { generateTestClient } from '../../../../utils/getTestClient'

test('browser-build', async () => {
  await generateTestClient()

  const { Decimal } = require('./node_modules/@prisma/client/index-browser.js')
  const decimal = new Decimal(0.11)
  expect(decimal.toString()).toEqual('0.11')
})
