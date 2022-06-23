type MetricsOptionsCommon = {
  globalLabels?: Record<string, string>
}

export type MetricsOptionsJson = { format: 'json' } & MetricsOptionsCommon
export type MetricsOptionsPrometheus = { format: 'prometheus' } & MetricsOptionsCommon

export type EngineMetricsOptions = MetricsOptionsJson | MetricsOptionsPrometheus

export type Metrics = {
  counters: Metric<number>[]
  gauges: Metric<number>[]
  histograms: Metric<MetricHistogram>[]
}

export type Metric<T> = {
  key: string
  value: T
  labels: Record<string, string>
  description: string
}

export type MetricHistogramBucket = [maxValue: number, count: number]

export type MetricHistogram = {
  buckets: MetricHistogramBucket[]
  sum: number
  count: number
}
