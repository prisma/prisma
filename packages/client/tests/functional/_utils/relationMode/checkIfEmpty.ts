// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

export async function checkIfEmpty(...models: unknown[]) {
  const checkEmptyArr = await prisma.$transaction(models.map((model) => prisma[model].findMany()))
  checkEmptyArr.forEach((checkEmpty) => {
    expect(checkEmpty).toHaveLength(0)
  })
}
