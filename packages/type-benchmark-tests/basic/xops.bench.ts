/* eslint-disable @typescript-eslint/no-floating-promises */
// (more convenient benches since we only care about types)

import { bench } from '@ark/attest'

// @ts-ignore
import type { PrismaClient } from './generated/client'

declare const prisma: PrismaClient

// comment out these benchmarks to check initial cost for each operation
bench.baseline(() => {
  prisma.user.findFirst({
    where: { id: 'baseline_0_op1' },
    select: { name: true },
  })
  prisma.link.findMany({
    where: { userId: 'baseline_0_op2' },
    select: { shortUrl: true },
  })
  prisma.user.create({
    data: { email: 'baseline_0_op3@example.com', name: 'Baseline 0 Op 3' },
  })
  prisma.link.update({
    where: { id: 'baseline_0_op4' },
    data: { shortUrl: 'updated-baseline-0-op4' },
    select: { shortUrl: true },
  })
  prisma.user.findUnique({
    where: { email: 'baseline_0_op5@example.com' },
    select: { name: true },
  })

  const xprisma1 = getXprisma1()
  xprisma1.user.findFirst({
    where: { id: 'baseline_1_op1' },
    select: { name: true },
  })
  xprisma1.link.findMany({
    where: { userId: 'baseline_1_op2' },
    select: { shortUrl: true },
  })
  xprisma1.user.create({
    data: { email: 'baseline_1_op3@example.com', name: 'Baseline 1 Op 3' },
  })
  xprisma1.link.update({
    where: { id: 'baseline_1_op4' },
    data: { shortUrl: 'updated-baseline-1-op4' },
    select: { shortUrl: true },
  })
  xprisma1.user.findUnique({
    where: { email: 'baseline_1_op5@example.com' },
    select: { name: true },
  })

  const xprisma5 = getXprisma5()
  xprisma5.user.findFirst({
    where: { id: 'baseline_5_op1' },
    select: { name: true },
  })
  xprisma5.link.findMany({
    where: { userId: 'baseline_5_op2' },
    select: { shortUrl: true },
  })
  xprisma5.user.create({
    data: { email: 'baseline_5_op3@example.com', name: 'Baseline 5 Op 3' },
  })
  xprisma5.link.update({
    where: { id: 'baseline_5_op4' },
    data: { shortUrl: 'updated-baseline-5-op4' },
    select: { shortUrl: true },
  })
  xprisma5.user.findUnique({
    where: { email: 'baseline_5_op5@example.com' },
    select: { name: true },
  })

  const xprisma10 = getXprisma10()
  xprisma10.user.findFirst({
    where: { id: 'baseline_10_op1' },
    select: { name: true },
  })
  xprisma10.link.findMany({
    where: { userId: 'baseline_10_op2' },
    select: { shortUrl: true },
  })
  xprisma10.user.create({
    data: { email: 'baseline_10_op3@example.com', name: 'Baseline 10 Op 3' },
  })
  xprisma10.link.update({
    where: { id: 'baseline_10_op4' },
    data: { shortUrl: 'updated-baseline-10-op4' },
    select: { shortUrl: true },
  })
  xprisma10.user.findUnique({
    where: { email: 'baseline_10_op5@example.com' },
    select: { name: true },
  })
})

const getXprisma1 = () =>
  prisma.$extends({
    result: {
      user: {
        xone: {
          needs: {
            name: true,
          },
          compute(user) {
            return { one: user.name }
          },
        },
      },
      link: {
        xone: {
          needs: {
            shortUrl: true,
          },
          compute(link) {
            return { one: link.shortUrl }
          },
        },
      },
    },
  })

const getXprisma5 = () =>
  getXprisma1()
    .$extends({
      result: {
        user: {
          xtwo: {
            needs: {
              xone: true,
            },
            compute(user) {
              return { two: user.xone }
            },
          },
        },
        link: {
          xtwo: {
            needs: {
              xone: true,
            },
            compute(link) {
              return { two: link.xone }
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xthree: {
            needs: { xtwo: true },
            compute(user) {
              return { three: user.xtwo }
            },
          },
        },
        link: {
          xthree: {
            needs: { xtwo: true },
            compute(link) {
              return { three: link.xtwo }
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xfour: {
            needs: { xthree: true },
            compute(user) {
              return { four: user.xthree }
            },
          },
        },
        link: {
          xfour: {
            needs: { xthree: true },
            compute(link) {
              return { four: link.xthree }
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xfive: {
            needs: { xfour: true },
            compute(user) {
              return { five: user.xfour }
            },
          },
        },
        link: {
          xfive: {
            needs: { xfour: true },
            compute(link) {
              return { five: link.xfour }
            },
          },
        },
      },
    })

const getXprisma10 = () =>
  getXprisma5()
    .$extends({
      result: {
        user: {
          xsix: {
            needs: { xfive: true },
            compute(user) {
              return { six: user.xfive }
            },
          },
        },
        link: {
          xsix: {
            needs: { xfive: true },
            compute(link) {
              return { six: link.xfive }
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xseven: {
            needs: { xsix: true },
            compute(user) {
              return { seven: user.xsix }
            },
          },
        },
        link: {
          xseven: {
            needs: { xsix: true },
            compute(link) {
              return { seven: link.xsix }
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xeight: {
            needs: { xseven: true },
            compute(user) {
              return { eight: user.xseven }
            },
          },
        },
        link: {
          xeight: {
            needs: { xseven: true },
            compute(link) {
              return { eight: link.xseven }
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xnine: {
            needs: { xeight: true },
            compute(user) {
              return { nine: user.xeight }
            },
          },
        },
        link: {
          xnine: {
            needs: { xeight: true },
            compute(link) {
              return { nine: link.xeight }
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xten: {
            needs: { xnine: true },
            compute(user) {
              return { ten: user.xnine }
            },
          },
        },
        link: {
          xten: {
            needs: { xnine: true },
            compute(link) {
              return { ten: link.xnine }
            },
          },
        },
      },
    })

bench('client extensions(0)- 1 op', () => {
  prisma.user.findFirst({
    where: { id: 'op1_findFirst_user' },
    select: { name: true },
  })
}).types([235, 'instantiations'])

bench('client extensions(1)- 1 op', () => {
  const xprisma1 = getXprisma1()
  xprisma1.user.findFirst({
    where: { id: 'op1_findFirst_user' },
    select: { xone: true },
  })
}).types([270, 'instantiations'])

bench('client extensions(5)- 1 op', () => {
  const xprisma5 = getXprisma5()
  xprisma5.user.findFirst({
    where: { id: 'op1_findFirst_user' },
    select: { xone: true, xtwo: true, xthree: true, xfour: true, xfive: true },
  })
}).types([638, 'instantiations'])

bench('client extensions(10)- 1 op', () => {
  const xprisma10 = getXprisma10()
  xprisma10.user.findFirst({
    where: { id: 'op1_findFirst_user' },
    select: {
      xone: true,
      xtwo: true,
      xthree: true,
      xfour: true,
      xfive: true,
      xsix: true,
      xseven: true,
      xeight: true,
      xnine: true,
      xten: true,
    },
  })
}).types([1098, 'instantiations'])

bench('client extensions(0)- 5 ops', () => {
  prisma.user.findFirst({
    where: { id: 'op1_findFirst_user' },
    select: { name: true },
  })
  prisma.link.findMany({
    where: { userId: 'op2_findMany_link' },
    select: { shortUrl: true },
  })
  prisma.user.create({
    data: { email: 'op3_create_user@example.com', name: 'Op 3 User' },
  })
  prisma.link.update({
    where: { id: 'op4_update_link' },
    data: { shortUrl: 'updated-op4' },
  })
  prisma.user.findUnique({
    where: { email: 'op5_findUnique_user@example.com' },
    select: { name: true },
  })
}).types([1146, 'instantiations'])

bench('client extensions(1)- 5 ops', () => {
  const xprisma1 = getXprisma1()
  xprisma1.user.findFirst({
    where: { id: 'op1_findFirst_user' },
    select: { xone: true },
  })
  xprisma1.link.findMany({
    where: { userId: 'op2_findMany_link' },
    select: { xone: true },
  })
  xprisma1.user.create({
    data: { email: 'op3_create_user@example.com', name: 'Op 3 User' },
  })
  xprisma1.link.update({
    where: { id: 'op4_update_link' },
    data: { shortUrl: 'updated-op4' },
  })
  xprisma1.user.findUnique({
    where: { email: 'op5_findUnique_user@example.com' },
    select: { xone: true },
  })
}).types([1203, 'instantiations'])

bench('client extensions(5)- 5 ops', () => {
  const xprisma5 = getXprisma5()
  xprisma5.user.findFirst({
    where: { id: 'op1_findFirst_user' },
    select: { xone: true, xtwo: true, xthree: true, xfour: true, xfive: true },
  })
  xprisma5.link.findMany({
    where: { userId: 'op2_findMany_link' },
    select: { xone: true, xtwo: true, xthree: true, xfour: true, xfive: true },
  })
  xprisma5.user.create({
    data: { email: 'op3_create_user@example.com', name: 'Op 3 User' },
  })
  xprisma5.link.update({
    where: { id: 'op4_update_link' },
    data: { shortUrl: 'updated-op4' },
  })
  xprisma5.user.findUnique({
    where: { email: 'op5_findUnique_user@example.com' },
    select: { xone: true, xtwo: true, xthree: true, xfour: true, xfive: true },
  })
}).types([2579, 'instantiations'])

bench('client extensions(10)- 5 ops', () => {
  const xprisma10 = getXprisma10()
  xprisma10.user.findFirst({
    where: { id: 'op1_findFirst_user' },
    select: {
      xone: true,
      xtwo: true,
      xthree: true,
      xfour: true,
      xfive: true,
      xsix: true,
      xseven: true,
      xeight: true,
      xnine: true,
      xten: true,
    },
  })
  xprisma10.link.findMany({
    where: { userId: 'op2_findMany_link' },
    select: {
      xone: true,
      xtwo: true,
      xthree: true,
      xfour: true,
      xfive: true,
      xsix: true,
      xseven: true,
      xeight: true,
      xnine: true,
      xten: true,
    },
  })
  xprisma10.user.create({
    data: { email: 'op3_create_user@example.com', name: 'Op 3 User' },
  })
  xprisma10.link.update({
    where: { id: 'op4_update_link' },
    data: { shortUrl: 'updated-op4' },
  })
  xprisma10.user.findUnique({
    where: { email: 'op5_findUnique_user@example.com' },
    select: {
      xone: true,
      xtwo: true,
      xthree: true,
      xfour: true,
      xfive: true,
      xsix: true,
      xseven: true,
      xeight: true,
      xnine: true,
      xten: true,
    },
  })
}).types([4299, 'instantiations'])
