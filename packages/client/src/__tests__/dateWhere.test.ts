import { getDMMF } from '@prisma/internals'

import { DMMFClass, makeDocument, transformDocument } from '../runtime'

const datamodel = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Payslip {
  id          String    @id @default(uuid())
  status      String
  publishedAt DateTime?
  updatedAt   DateTime?
  employeeId  String
  employee    Employee  @relation(fields: [employeeId], references: [id])
  paymentDate DateTime

  @@unique([employeeId, paymentDate], name: "uniqKeyByEmployeeIdAndPaymentDate")
}

model Employee {
  id      String    @id @default(cuid())
  name    String
  Payslip Payslip[]
}
`

describe('date where filter', () => {
  let dmmf
  beforeAll(async () => {
    dmmf = new DMMFClass(await getDMMF({ datamodel }))
  })

  test('generate correct query', () => {
    const select = {
      where: {
        AND: [
          { employeeId: { in: [''] } },
          { status: 'uploaded' },
          { paymentDate: new Date('2010-11-13T10:36:43.261Z') },
          { publishedAt: null },
        ],
      },
      data: {
        status: 'published',
        publishedAt: new Date('2020-11-13T10:36:43.261Z'),
        // tests RFC 3339
        updatedAt: '2021-01-13T12:40:47+01:00',
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'mutation',
      rootField: 'updateManyPayslip',
    })
    document.validate(select, false)
    expect(String(document)).toMatchInlineSnapshot(`
      mutation {
        updateManyPayslip(
          where: {
            AND: [
              {
                employeeId: {
                  in: [""]
                }
              },
              {
                status: "uploaded"
              },
              {
                paymentDate: "2010-11-13T10:36:43.261Z"
              },
              {
                publishedAt: null
              }
            ]
          }
          data: {
            status: "published"
            publishedAt: "2020-11-13T10:36:43.261Z"
            updatedAt: "2021-01-13T12:40:47+01:00"
          }
        ) {
          count
        }
      }
    `)
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      mutation {
        updateManyPayslip(
          where: {
            AND: [
              {
                employeeId: {
                  in: [""]
                }
              },
              {
                status: "uploaded"
              },
              {
                paymentDate: "2010-11-13T10:36:43.261Z"
              },
              {
                publishedAt: null
              }
            ]
          }
          data: {
            status: "published"
            publishedAt: "2020-11-13T10:36:43.261Z"
            updatedAt: "2021-01-13T12:40:47+01:00"
          }
        ) {
          count
        }
      }
    `)
  })
})
