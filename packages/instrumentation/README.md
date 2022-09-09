# @prisma/instrumentation

[![npm version](https://img.shields.io/npm/v/@prisma/instrumentation.svg?style=flat)](https://www.npmjs.com/package/@prisma/instrumentation) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/prisma/prisma/blob/main/CONTRIBUTING.md) [![GitHub license](https://img.shields.io/badge/license-Apache%202-blue)](https://github.com/prisma/prisma/blob/main/LICENSE) [![Slack](https://img.shields.io/badge/chat-on%20slack-blue.svg)](https://slack.prisma.io/)

[OTEL - OpenTelemetry](https://opentelemetry.io/) compliant instrumentation for Prisma Client.

⚠️ **Warning**: This package is provided as part of the `tracing` Preview Feature
Its release cycle does not follow SemVer, which means we might release breaking changes (change APIs, remove functionality) without any prior warning.

## Installing

```
$ npm install @prisma/instrumentation
```

## Usage

```ts
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { PrismaInstrumentation } from '@prisma/instrumentation'

registerInstrumentations({
  instrumentations: [new PrismaInstrumentation()],
})
```

Don't forget to set `previewFeatures`:

```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["tracing"]
}
```

## Jaeger

Exporting traces to [Jaeger Tracing](https://jaegertracing.io).

```ts
import { context } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'

import { PrismaClient } from '.prisma/client'

const contextManager = new AsyncHooksContextManager().enable()

context.setGlobalContextManager(contextManager)

const otlpTraceExporter = new OTLPTraceExporter()

const provider = new BasicTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'test-tracing-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
})

provider.addSpanProcessor(new SimpleSpanProcessor(otlpTraceExporter))
provider.register()

registerInstrumentations({
  instrumentations: [new PrismaInstrumentation()],
})

async function main() {
  const prisma = new PrismaClient()

  const email = `user.${Date.now()}@prisma.io`

  await prisma.user.create({
    data: {
      email: email,
    },
  })
}

main()
```
