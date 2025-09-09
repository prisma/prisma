import { thresholdLogFilter } from './filter'
import { createLogFormatter, LogFormat } from './format'
import { LogLevel } from './log-level'
import { Logger } from './logger'
import { ConsoleSink, FilteringSink } from './sink'

/**
 * Creates a logger that keeps log events with a level greater than or equal
 * to {@link logLevel} and outputs them to console using format {@link logFormat}.
 */
export function createConsoleLogger(logFormat: LogFormat, logLevel: LogLevel): Logger {
  return new Logger(new FilteringSink(new ConsoleSink(createLogFormatter(logFormat)), thresholdLogFilter(logLevel)))
}
