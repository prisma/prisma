import { context, trace } from '@opentelemetry/api'

import { otelSetup } from './otelSetup'
import { PrismaClient } from '.prisma/client'

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
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  prisma.$on('query', (e) => {
    console.log(e)
  })

  await prisma.one.create({
    data: {
      next: {
        create: {
          next: {
            create: {
              next: {
                create: {
                  next: {
                    create: {
                      next: {
                        create: {
                          next: {
                            create: {
                              next: {
                                create: {
                                  next: {
                                    create: {
                                      next: {
                                        create: {
                                          value: 'hello',
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  await prisma.one.findFirst({
    include: {
      next: {
        include: {
          next: {
            include: {
              next: {
                include: {
                  next: {
                    include: {
                      next: {
                        include: {
                          next: {
                            include: {
                              next: {
                                include: {
                                  next: {
                                    include: {
                                      next: true,
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  await prisma.$disconnect()
}
