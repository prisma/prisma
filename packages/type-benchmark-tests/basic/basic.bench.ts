/* eslint-disable @typescript-eslint/no-floating-promises */
// (more convenient benches since we only care about types)

import { bench } from '@ark/attest'

// @ts-ignore
import type { PrismaClient } from './generated/client'

declare const prisma: PrismaClient

bench.baseline(() => {
  prisma.user.findUnique({
    where: { id: 'baseline_id' },
  })
})

bench('findUnique - Link', () => {
  prisma.link.findUnique({
    where: { id: 'some_link_id' },
  })
}).types([745, 'instantiations'])

bench('findFirst - Link', () => {
  prisma.link.findFirst({
    where: { url: { contains: 'example.com' } },
  })
}).types([708, 'instantiations'])

bench('findMany - Link', () => {
  prisma.link.findMany({
    take: 10,
  })
}).types([674, 'instantiations'])

bench('findUnique - User select scalar', () => {
  prisma.user.findUnique({
    where: { email: 'some_email@example.com' },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })
}).types([231, 'instantiations'])

bench('findMany - Link select scalar', () => {
  prisma.link.findMany({
    where: { userId: 'some_user_id' },
    select: {
      url: true,
      shortUrl: true,
    },
  })
}).types([532, 'instantiations'])

bench('findUnique - User include Links (1-M)', () => {
  prisma.user.findUnique({
    where: { id: 'some_user_id' },
    include: {
      links: true,
    },
  })
}).types([603, 'instantiations'])

bench('findUnique - Link include User (M-1)', () => {
  prisma.link.findUnique({
    where: { id: 'some_link_id' },
    include: {
      user: true,
    },
  })
}).types([1050, 'instantiations'])

bench('findUnique - User include Links with select', () => {
  prisma.user.findUnique({
    where: { id: 'some_user_id' },
    include: {
      links: {
        select: {
          url: true,
          createdAt: true,
        },
        where: { url: { startsWith: 'https://' } },
      },
    },
  })
}).types([690, 'instantiations'])

bench('findUnique - User select scalar and include Links', () => {
  prisma.user.findUnique({
    where: { id: 'some_user_id' },
    select: {
      email: true,
      links: {
        select: {
          shortUrl: true,
        },
      },
    },
  })
}).types([285, 'instantiations'])

bench('create - User simple', () => {
  prisma.user.create({
    data: {
      email: 'new_user@example.com',
      name: 'New User',
    },
  })
}).types([441, 'instantiations'])

bench('create - Link simple', () => {
  prisma.link.create({
    data: {
      url: 'https://example.com/new-link',
      shortUrl: 'new-lnk',
    },
  })
}).types([759, 'instantiations'])

bench('create - User with nested Links (1-M)', () => {
  prisma.user.create({
    data: {
      email: 'another_user@example.com',
      links: {
        create: [
          { url: 'https://link1.com', shortUrl: 'lnk1' },
          { url: 'https://link2.com', shortUrl: 'lnk2' },
        ],
      },
    },
  })
}).types([521, 'instantiations'])

bench('create - Link connecting to existing User', () => {
  prisma.link.create({
    data: {
      url: 'https://connected-link.com',
      shortUrl: 'conn-lnk',
      user: {
        connect: { id: 'some_user_id' },
      },
    },
  })
}).types([765, 'instantiations'])

bench('update - User simple', () => {
  prisma.user.update({
    where: { id: 'some_user_id' },
    data: {
      name: 'Updated Name',
    },
  })
}).types([483, 'instantiations'])

bench('update - User nested connect/disconnect Links', () => {
  prisma.user.update({
    where: { id: 'some_user_id' },
    data: {
      links: {
        connect: [{ id: 'link_to_connect' }],
        disconnect: [{ id: 'link_to_disconnect' }],
      },
    },
  })
}).types([643, 'instantiations'])

bench('update - User nested updateMany Links (1-M)', () => {
  prisma.user.update({
    where: { id: 'some_user_id' },
    data: {
      links: {
        updateMany: {
          where: { url: { contains: 'old-pattern' } },
          data: { shortUrl: 'updated-short' },
        },
      },
    },
  })
}).types([577, 'instantiations'])

bench('update - User nested upsert Link', () => {
  prisma.user.update({
    where: { id: 'some_user_id' },
    data: {
      links: {
        upsert: [
          {
            where: { id: 'maybe_existing_link_id' },
            create: { url: 'https://new-upsert.com', shortUrl: 'ups-new' },
            update: { shortUrl: 'ups-upd' },
          },
        ],
      },
    },
  })
}).types([746, 'instantiations'])

bench('upsert - User simple', () => {
  prisma.user.upsert({
    where: { email: 'maybe_exists@example.com' },
    create: { email: 'maybe_exists@example.com', name: 'Created User' },
    update: { name: 'Updated Existing User' },
  })
}).types([599, 'instantiations'])

bench('delete - Link simple', () => {
  prisma.link.delete({
    where: { id: 'link_to_delete' },
  })
}).types([742, 'instantiations'])

bench('deleteMany - Link simple', () => {
  prisma.link.deleteMany({
    where: { url: { endsWith: '.org' } },
  })
}).types([156, 'instantiations'])

bench('aggregate - Link count', () => {
  prisma.link.aggregate({
    _count: {
      id: true,
    },
    where: { userId: 'some_user_id' },
  })
}).types([138, 'instantiations'])

bench('aggregate - User count', () => {
  prisma.user.aggregate({
    _count: { _all: true },
    where: { email: { contains: '@example.' } },
  })
}).types([155, 'instantiations'])

bench('groupBy - Link by userId', () => {
  prisma.link.groupBy({
    by: ['userId'],
    _count: {
      id: true,
    },
  })
}).types([1226, 'instantiations'])

bench('groupBy - User by date (truncation needed)', () => {
  prisma.user.groupBy({
    by: ['date'],
    _count: {
      id: true,
    },
    having: {
      id: {
        _count: {
          gt: 1,
        },
      },
    },
  })
}).types([1403, 'instantiations'])

bench('transaction scaling (0- user update only)', () => {
  prisma.user.update({
    where: { id: 'user_for_tx' },
    data: { name: 'Tx Updated Name' },
  })
}).types([483, 'instantiations'])

bench('transaction scaling(1)', () => {
  prisma.$transaction([
    prisma.user.update({
      where: { id: 'user_for_tx' },
      data: { name: 'Tx Updated Name' },
    }),
  ])
}).types([2094, 'instantiations'])

bench('transaction scaling(2)', () => {
  prisma.$transaction([
    prisma.user.update({
      where: { id: 'user_for_tx' },
      data: { name: 'Tx Updated Name' },
    }),
    prisma.link.create({
      data: {
        url: 'https://tx-link.com',
        shortUrl: 'tx-lnk',
        userId: 'user_for_tx',
      },
    }),
  ])
}).types([3799, 'instantiations'])

bench('transaction scaling(10)', () => {
  prisma.$transaction([
    prisma.user.create({
      data: { email: 'tx_unique_1@example.com', name: 'TX Unique 1' },
    }),
    prisma.link.create({
      data: {
        url: 'https://tx-unique-link1.com',
        shortUrl: 'txu-lnk1',
        userId: 'tx_unique_1_placeholder_id',
      },
    }),
    prisma.user.update({
      where: { email: 'tx_unique_1@example.com' },
      data: { name: 'TX Unique 1 Updated' },
    }),
    prisma.link.update({
      where: { id: 'tx_unique_link1_placeholder_id' },
      data: { shortUrl: 'txu-lnk1-upd' },
    }),
    prisma.user.upsert({
      where: { email: 'tx_unique_2@example.com' },
      create: { email: 'tx_unique_2@example.com', name: 'TX Unique 2 New' },
      update: { name: 'TX Unique 2 Existing' },
    }),
    prisma.link.upsert({
      where: { id: 'tx_unique_link2_placeholder_id' },
      create: {
        url: 'https://tx-unique-link2.com',
        shortUrl: 'txu-lnk2-new',
      },
      update: { shortUrl: 'txu-lnk2-upd' },
    }),
    prisma.user.delete({
      where: { email: 'user_to_delete@example.com' },
    }),
    prisma.link.delete({
      where: { id: 'link_to_delete_placeholder_id' },
    }),
    prisma.user.updateMany({
      where: { name: { contains: 'Legacy' } },
      data: { name: 'Updated Legacy User' },
    }),
    prisma.link.deleteMany({
      where: { url: { contains: 'temp-link' } },
    }),
  ])
}).types([8366, 'instantiations'])

bench('transaction - interactive User/Link', () => {
  prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: 'user_for_tx_2' } })
    if (!user) throw new Error('User not found')

    const link = await tx.link.create({
      data: {
        url: 'https://interactive-tx-link.com',
        shortUrl: 'i-tx-lnk',
        userId: user.id,
      },
    })
    return link
  })
}).types([1221, 'instantiations'])
