import type { Client } from '../../getPrismaClient'
import type { Metric, MetricHistogram, MetricHistogramBucket, Metrics } from '../engines'
import { PrismaClientValidationError } from '../errors/PrismaClientValidationError'

export type MetricsOptions = {
  /**
   * Labels to add to every metrics in key-value format
   */
  globalLabels?: Record<string, string>
}

function checkPreviewFeatureFlag(client: Client) {
  if (!client._hasPreviewFlag('metrics')) {
    throw new PrismaClientValidationError('`metrics` preview feature must be enabled in order to access metrics API', {
      clientVersion: client._clientVersion,
    })
  }
}

export class MetricsClient {
  private _client: Client

  constructor(client: Client) {
    this._client = client
  }

  /**
   * Returns all metrics gathered up to this point in prometheus format.
   * Result of this call can be exposed directly to prometheus scraping endpoint
   *
   * @param options
   * @returns
   */
  prometheus(options?: MetricsOptions): Promise<string> {
    checkPreviewFeatureFlag(this._client)

    return this._client._engine.metrics({ format: 'prometheus', ...options })
  }

  /**
   * Returns all metrics gathered up to this point in prometheus format.
   *
   * @param options
   * @returns
   */
  json(options?: MetricsOptions): Promise<Metrics> {
    checkPreviewFeatureFlag(this._client)

    return this._client._engine.metrics({ format: 'json', ...options })
  }
}

export type { Metric, MetricHistogram, MetricHistogramBucket, Metrics }
