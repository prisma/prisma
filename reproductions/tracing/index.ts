import { context, trace } from '@opentelemetry/api'
import { debug } from 'console'

import { otelSetup } from './otelSetup'
import { Prisma, PrismaClient } from '.prisma/client'

otelSetup()

// set things up for tracing our "app"
const tracer = trace.getTracer('myApp')
const span = tracer.startSpan('mySpan')
const ctx = trace.setSpan(context.active(), span)

void context.with(ctx, async () => {
  await main()

  span.end()
})

async function main() {
  const prisma = new PrismaClient()

  const email = Date.now() + '@gmail.com'

  await prisma.user.create({
    data: {
      name: 'Alice',
      email: email,
      posts: {
        create: { title: 'Hello World' },
      },
      profile: {
        create: { bio: 'I like turtles' },
      },
    },
  })

  await prisma.user.findFirst()
  await prisma.user.findMany()

  await prisma.$transaction([
    prisma.user.findUnique({
      where: { email },
    }),
    prisma.user.findMany({}),
  ])

  await prisma.$transaction(async (tx) => {
    await tx.user.findFirst()
    await tx.user.findFirst()
  })

  await prisma.$disconnect()
}
