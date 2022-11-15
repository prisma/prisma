// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/4004
testMatrix.setupTestSuite(() => {
  async function seed(): Promise<{ student1Id: string; student2Id: string }> {
    const student1 = await prisma.student.create({
      data: {
        name: 'student1',
      },
    })

    const student2 = await prisma.student.create({
      data: {
        name: 'student2',
      },
    })

    const class1 = await prisma.class.create({
      data: {
        name: 'class1',
      },
    })

    const class2 = await prisma.class.create({
      data: {
        name: 'class2',
      },
    })

    await prisma.studentClass.create({
      data: {
        student: {
          connect: {
            id: student1.id,
          },
        },
        class: {
          connect: {
            id: class1.id,
          },
        },
      },
    })

    await prisma.studentClass.create({
      data: {
        student: {
          connect: {
            id: student2.id,
          },
        },
        class: {
          connect: {
            id: class2.id,
          },
        },
      },
    })

    return { student1Id: student1.id, student2Id: student2.id }
  }

  test('should not throw error when updating fields on a many to many join table', async () => {
    const { student1Id } = await seed()

    await prisma.studentClass.updateMany({
      // Testing we can update fields on the join tabel
      data: {
        studentId: student1Id,
      },
    })

    // Read all the join tables
    const studentClasses = await prisma.studentClass.findMany({
      select: {
        student: true,
        class: true,
      },
    })

    // Ensure that the update happened
    studentClasses.forEach((studentClass) => {
      expect(studentClass.student.id).toEqual(student1Id)
    })
  })
})
