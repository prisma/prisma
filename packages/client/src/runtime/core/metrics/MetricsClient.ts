import { Client } from '../../getPrismaClient'
import type { Metric, MetricHistogram, MetricHistogramBucket, Metrics } from '../engines'

export type MetricsOptions = {
  /**
   * Labels to add to every metrics in key-value format
   */
  globalLabels?: Record<string, string>
}

export class MetricsClient {
  private client: Client

  constructor(client: Client) {
    this.client = client
  }

  /**
   * Returns all metrics gathered up to this point in prometheus format.
   * Result of this call can be exposed directly to prometheus scraping endpoint
   *
   * @param options
   * @returns
   */
  prometheus(options?: MetricsOptions): Promise<string> {
    return this.client._engine.metrics({ format: 'prometheus', ...options })
  }

  /**
   * Returns all metrics gathered up to this point in prometheus format.
   *
   * @param options
   * @returns
   */
  json(options?: MetricsOptions): Promise<Metrics> {
    return this.client._engine.metrics({ format: 'json', ...options })
  }
}

export type { Metric, MetricHistogram, MetricHistogramBucket, Metrics }
