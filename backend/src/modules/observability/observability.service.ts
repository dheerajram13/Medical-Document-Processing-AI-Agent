import { Injectable } from '@nestjs/common';

type MetricLabels = Record<string, string>;

type CounterSample = {
  labels: MetricLabels;
  value: number;
};

type HistogramSample = {
  labels: MetricLabels;
  buckets: number[];
  count: number;
  sum: number;
};

type PipelineResult = 'success' | 'failed';

type ProcessingTiming = Record<string, number>;

const HTTP_DURATION_BUCKETS_MS = [25, 50, 100, 250, 500, 1000, 2000, 5000, 10000];
const PIPELINE_DURATION_BUCKETS_MS = [50, 100, 250, 500, 1000, 2000, 5000, 10000, 20000, 60000];

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

@Injectable()
export class ObservabilityService {
  private readonly metricsEnabled = parseBooleanFlag(
    process.env.METRICS_ENABLED,
    true,
  );

  private readonly httpRequestsTotal = new Map<string, CounterSample>();
  private readonly httpRequestDurationMs = new Map<string, HistogramSample>();
  private readonly pipelineRunsTotal = new Map<string, CounterSample>();
  private readonly pipelineStageDurationMs = new Map<string, HistogramSample>();
  private pipelineAiFallbackTotal = 0;

  isMetricsEnabled(): boolean {
    return this.metricsEnabled;
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    if (!this.metricsEnabled) {
      return;
    }

    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: String(statusCode),
      status_class: statusClass,
    };

    this.incrementCounter(this.httpRequestsTotal, labels, 1);
    this.observeHistogram(
      this.httpRequestDurationMs,
      labels,
      HTTP_DURATION_BUCKETS_MS,
      durationMs,
    );
  }

  recordDocumentPipeline(
    timing: ProcessingTiming,
    totalMs: number,
    result: PipelineResult,
    aiExtractionFailed: boolean,
  ): void {
    if (!this.metricsEnabled) {
      return;
    }

    const stageEntries: Array<[string, number]> = [
      ['upload', timing.uploadMs],
      ['create', timing.createRecordMs],
      ['ocr', timing.ocrMs],
      ['ai', timing.aiMs],
      ['save', timing.saveMs],
      ['status', timing.statusMs],
      ['total', totalMs],
    ];

    for (const [stage, value] of stageEntries) {
      if (!Number.isFinite(value) || value < 0) {
        continue;
      }
      this.observeHistogram(
        this.pipelineStageDurationMs,
        { stage },
        PIPELINE_DURATION_BUCKETS_MS,
        value,
      );
    }

    this.incrementCounter(this.pipelineRunsTotal, { result }, 1);

    if (aiExtractionFailed) {
      this.pipelineAiFallbackTotal += 1;
    }
  }

  renderPrometheusMetrics(): string {
    if (!this.metricsEnabled) {
      return '# Metrics disabled\n';
    }

    const lines: string[] = [];

    lines.push('# HELP mdpa_http_requests_total Total HTTP requests processed.');
    lines.push('# TYPE mdpa_http_requests_total counter');
    lines.push(...this.renderCounter('mdpa_http_requests_total', this.httpRequestsTotal));

    lines.push('# HELP mdpa_http_request_duration_ms HTTP request duration in milliseconds.');
    lines.push('# TYPE mdpa_http_request_duration_ms histogram');
    lines.push(
      ...this.renderHistogram(
        'mdpa_http_request_duration_ms',
        this.httpRequestDurationMs,
        HTTP_DURATION_BUCKETS_MS,
      ),
    );

    lines.push('# HELP mdpa_pipeline_runs_total Document processing pipeline runs by result.');
    lines.push('# TYPE mdpa_pipeline_runs_total counter');
    lines.push(...this.renderCounter('mdpa_pipeline_runs_total', this.pipelineRunsTotal));

    lines.push('# HELP mdpa_pipeline_stage_duration_ms Document pipeline stage duration in milliseconds.');
    lines.push('# TYPE mdpa_pipeline_stage_duration_ms histogram');
    lines.push(
      ...this.renderHistogram(
        'mdpa_pipeline_stage_duration_ms',
        this.pipelineStageDurationMs,
        PIPELINE_DURATION_BUCKETS_MS,
      ),
    );

    lines.push('# HELP mdpa_pipeline_ai_fallback_total Number of runs where AI extraction failed and fallback/manual path was used.');
    lines.push('# TYPE mdpa_pipeline_ai_fallback_total counter');
    lines.push(`mdpa_pipeline_ai_fallback_total ${this.pipelineAiFallbackTotal}`);

    lines.push('# HELP mdpa_process_uptime_seconds Process uptime in seconds.');
    lines.push('# TYPE mdpa_process_uptime_seconds gauge');
    lines.push(`mdpa_process_uptime_seconds ${process.uptime().toFixed(3)}`);

    const memoryUsage = process.memoryUsage();
    lines.push('# HELP mdpa_process_memory_bytes Node.js process memory usage in bytes.');
    lines.push('# TYPE mdpa_process_memory_bytes gauge');
    lines.push(
      this.formatMetricLine('mdpa_process_memory_bytes', memoryUsage.rss, {
        type: 'rss',
      }),
    );
    lines.push(
      this.formatMetricLine('mdpa_process_memory_bytes', memoryUsage.heapTotal, {
        type: 'heap_total',
      }),
    );
    lines.push(
      this.formatMetricLine('mdpa_process_memory_bytes', memoryUsage.heapUsed, {
        type: 'heap_used',
      }),
    );
    lines.push(
      this.formatMetricLine('mdpa_process_memory_bytes', memoryUsage.external, {
        type: 'external',
      }),
    );

    return `${lines.join('\n')}\n`;
  }

  private incrementCounter(
    metric: Map<string, CounterSample>,
    labels: MetricLabels,
    delta: number,
  ): void {
    const key = this.labelsToKey(labels);
    const current = metric.get(key);
    if (!current) {
      metric.set(key, {
        labels: { ...labels },
        value: delta,
      });
      return;
    }
    current.value += delta;
  }

  private observeHistogram(
    metric: Map<string, HistogramSample>,
    labels: MetricLabels,
    bucketUpperBounds: readonly number[],
    rawValue: number,
  ): void {
    const value = Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : 0;
    const key = this.labelsToKey(labels);
    let sample = metric.get(key);
    if (!sample) {
      sample = {
        labels: { ...labels },
        buckets: new Array(bucketUpperBounds.length).fill(0),
        count: 0,
        sum: 0,
      };
      metric.set(key, sample);
    }

    for (let index = 0; index < bucketUpperBounds.length; index += 1) {
      if (value <= bucketUpperBounds[index]) {
        sample.buckets[index] += 1;
      }
    }

    sample.count += 1;
    sample.sum += value;
  }

  private renderCounter(
    name: string,
    metric: Map<string, CounterSample>,
  ): string[] {
    const lines: string[] = [];
    for (const sample of metric.values()) {
      lines.push(this.formatMetricLine(name, sample.value, sample.labels));
    }
    if (lines.length === 0) {
      lines.push(this.formatMetricLine(name, 0));
    }
    return lines;
  }

  private renderHistogram(
    name: string,
    metric: Map<string, HistogramSample>,
    bucketUpperBounds: readonly number[],
  ): string[] {
    const lines: string[] = [];
    for (const sample of metric.values()) {
      for (let index = 0; index < bucketUpperBounds.length; index += 1) {
        lines.push(
          this.formatMetricLine(`${name}_bucket`, sample.buckets[index], {
            ...sample.labels,
            le: String(bucketUpperBounds[index]),
          }),
        );
      }
      lines.push(
        this.formatMetricLine(`${name}_bucket`, sample.count, {
          ...sample.labels,
          le: '+Inf',
        }),
      );
      lines.push(
        this.formatMetricLine(
          `${name}_sum`,
          Number(sample.sum.toFixed(3)),
          sample.labels,
        ),
      );
      lines.push(
        this.formatMetricLine(`${name}_count`, sample.count, sample.labels),
      );
    }

    if (lines.length === 0) {
      lines.push(this.formatMetricLine(`${name}_bucket`, 0, { le: '+Inf' }));
      lines.push(this.formatMetricLine(`${name}_sum`, 0));
      lines.push(this.formatMetricLine(`${name}_count`, 0));
    }

    return lines;
  }

  private labelsToKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, value]) => `${key}=${value}`)
      .join('|');
  }

  private formatMetricLine(
    metricName: string,
    value: number,
    labels?: MetricLabels,
  ): string {
    const metricValue = Number.isFinite(value) ? value : 0;
    if (!labels || Object.keys(labels).length === 0) {
      return `${metricName} ${metricValue}`;
    }

    const renderedLabels = Object.entries(labels)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(
        ([key, labelValue]) =>
          `${key}="${this.escapeLabelValue(String(labelValue))}"`,
      )
      .join(',');

    return `${metricName}{${renderedLabels}} ${metricValue}`;
  }

  private escapeLabelValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/"/g, '\\"');
  }
}
