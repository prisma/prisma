import { withActiveLogger } from './log/context.ts'
import { thresholdLogFilter } from './log/filter.ts'
import { createLogFormatter } from './log/format.ts'
import { Logger } from './log/logger.ts'
import { ConsoleSink, FilteringSink } from './log/sink.ts'
import { parseOptions } from './options.ts'
import { startServer } from './server/server.ts'

const options = parseOptions(Deno.args, Deno.env)

const logger = new Logger(
  new FilteringSink(new ConsoleSink(createLogFormatter(options.logFormat)), thresholdLogFilter(options.logLevel)),
)

await withActiveLogger(logger, async () => {
  await startServer(options)
})
