import { bench } from '@ark/attest'

import type { PrismaClient } from './generated/index.js'

declare const prisma: PrismaClient

const getXprisma1 = () =>
  prisma.$extends({
    result: {
      user: {
        xone: {
          needs: {},
          compute() {
            return 1
          },
        },
      },
      link: {
        xone: {
          needs: {},
          compute() {
            return 1
          },
        },
      },
    },
  })

const getXprisma2 = () =>
  getXprisma1().$extends({
    result: {
      user: {
        xtwo: {
          needs: {},
          compute() {
            return 2
          },
        },
      },
      link: {
        xtwo: {
          needs: {},
          compute() {
            return 2
          },
        },
      },
    },
  })

const getXprisma5 = () =>
  getXprisma2()
    .$extends({
      result: {
        user: {
          xthree: {
            needs: {},
            compute() {
              return 3
            },
          },
        },
        link: {
          xthree: {
            needs: {},
            compute() {
              return 3
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xfour: {
            needs: {},
            compute() {
              return 4
            },
          },
        },
        link: {
          xfour: {
            needs: {},
            compute() {
              return 4
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xfive: {
            needs: {},
            compute() {
              return 5
            },
          },
        },
        link: {
          xfive: {
            needs: {},
            compute() {
              return 5
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
            needs: {},
            compute() {
              return 6
            },
          },
        },
        link: {
          xsix: {
            needs: {},
            compute() {
              return 6
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xseven: {
            needs: {},
            compute() {
              return 7
            },
          },
        },
        link: {
          xseven: {
            needs: {},
            compute() {
              return 7
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xeight: {
            needs: {},
            compute() {
              return 8
            },
          },
        },
        link: {
          xeight: {
            needs: {},
            compute() {
              return 8
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xnine: {
            needs: {},
            compute() {
              return 9
            },
          },
        },
        link: {
          xnine: {
            needs: {},
            compute() {
              return 9
            },
          },
        },
      },
    })
    .$extends({
      result: {
        user: {
          xten: {
            needs: {},
            compute() {
              return 10
            },
          },
        },
        link: {
          xten: {
            needs: {},
            compute() {
              return 10
            },
          },
        },
      },
    })

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
}).types([10330, 'instantiations'])

bench('client extensions(2)- 5 ops', () => {
  const xprisma2 = getXprisma2()
  xprisma2.user.findFirst({
    where: { id: 'op1_findFirst_user' },
    select: { xone: true, xtwo: true },
  })
  xprisma2.link.findMany({
    where: { userId: 'op2_findMany_link' },
    select: { xone: true, xtwo: true },
  })
  xprisma2.user.create({
    data: { email: 'op3_create_user@example.com', name: 'Op 3 User' },
  })
  xprisma2.link.update({
    where: { id: 'op4_update_link' },
    data: { shortUrl: 'updated-op4' },
  })
  xprisma2.user.findUnique({
    where: { email: 'op5_findUnique_user@example.com' },
    select: { xone: true, xtwo: true },
  })
}).types([10906, 'instantiations'])

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
}).types([12634, 'instantiations'])

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
}).types([15678, 'instantiations'])
