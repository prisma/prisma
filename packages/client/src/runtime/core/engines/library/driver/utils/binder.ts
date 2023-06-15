import { Closeable, Driver } from '../../types/Library'

export const binder = (driver: Driver & Closeable): Driver & Closeable => ({
  queryRaw: driver.queryRaw.bind(driver),
  executeRaw: driver.executeRaw.bind(driver),
  version: driver.version.bind(driver),
  isHealthy: driver.isHealthy.bind(driver),
  close: driver.close.bind(driver),
})
