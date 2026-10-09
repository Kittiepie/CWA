/**
 * Upper bounds (ms) of the latency buckets. Workers only ship bucket counts
 * to the orchestrator, so millions of samples merge cheaply; the price is that
 * percentiles come back as "at most N ms" rather than an exact figure.
 */
const BOUNDS = [
  1,
  2,
  3,
  5,
  7,
  10,
  15,
  20,
  30,
  50,
  75,
  100,
  150,
  200,
  300,
  500,
  750,
  1_000,
  1_500,
  2_000,
  3_000,
  5_000,
  10_000,
  Number.POSITIVE_INFINITY,
];

export interface HistogramData {
  counts: number[];
  count: number;
  sum: number;
  max: number;
}

export function emptyHistogram(): HistogramData {
  return { counts: BOUNDS.map(() => 0), count: 0, sum: 0, max: 0 };
}

export class Histogram {
  private readonly data = emptyHistogram();

  record(ms: number): void {
    if (!Number.isFinite(ms)) return;
    // Sender and receiver share this machine's clock, but a clock adjustment
    // mid-run could still yield a hair below zero.
    const value = Math.max(0, ms);
    let bucket = 0;
    while (value > BOUNDS[bucket]) bucket++;
    this.data.counts[bucket]++;
    this.data.count++;
    this.data.sum += value;
    if (value > this.data.max) this.data.max = value;
  }

  toJSON(): HistogramData {
    return { ...this.data, counts: [...this.data.counts] };
  }
}

export function mergeHistograms(parts: HistogramData[]): HistogramData {
  const merged = emptyHistogram();
  for (const part of parts) {
    part.counts.forEach((count, i) => (merged.counts[i] += count));
    merged.count += part.count;
    merged.sum += part.sum;
    merged.max = Math.max(merged.max, part.max);
  }
  return merged;
}

/** Upper bound (ms) of the bucket holding the p-th sample; NaN when empty. */
export function percentile(histogram: HistogramData, p: number): number {
  if (histogram.count === 0) return Number.NaN;
  const target = Math.ceil(histogram.count * p);
  let seen = 0;
  for (let i = 0; i < BOUNDS.length; i++) {
    seen += histogram.counts[i];
    if (seen >= target) return Math.min(BOUNDS[i], histogram.max);
  }
  return histogram.max;
}
