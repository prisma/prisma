import type { Engine, Metric, MetricHistogram, MetricHistogramBucket, Metrics } from '@prisma/engine-core'

export type MetricsOptions = {
  /**
   * Labels to add to every metrics in key-value format
   */
  globalLabels?: Record<string, string>
}

export class MetricsClient {
  private _engine: Engine

  constructor(engine: Engine) {
    this._engine = engine
  }

  /**
   * Returns all metrics gathered up to this point in prometheus format.
   * Result of this call can be exposed directly to prometheus scraping endpoint
   *
   * @param options
   * @returns
   */
  prometheus(options?: MetricsOptions): Promise<string> {
    return this._engine.metrics({ format: 'prometheus', ...options })
  }

  /**
   * Returns all metrics gathered up to this point in prometheus format.
   *
   * @param options
   * @returns
   */
  json(options?: MetricsOptions): Promise<Metrics> {
    return this._engine.metrics({ format: 'json', ...options })
  }
}

export type { Metric, MetricHistogram, MetricHistogramBucket, Metrics }
