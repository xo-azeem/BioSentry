import { sensorValue } from './sensors';
import type { MotionEvent, Reading, SensorId } from './types';

export const RANGES = [
  { key: '1m', label: '1 min', n: 30, step: 2 },
  { key: '5m', label: '5 min', n: 60, step: 5 },
  { key: '15m', label: '15 min', n: 60, step: 15 },
  { key: '1h', label: '1 hour', n: 60, step: 60 },
] as const;
export type RangeKey = (typeof RANGES)[number]['key'];

/**
 * Averages readings into `n` evenly spaced buckets ending at `end` (step in seconds),
 * the same sampling the design uses for its charts. Empty buckets are `null` (no data → gap).
 */
export function bucketize(history: Reading[], id: Exclude<SensorId, 'motion'>, n: number, stepSec: number, end: number): (number | null)[] {
  const step = stepSec * 1000;
  const start = end - (n - 1) * step - step / 2;
  const sums = new Array(n).fill(0);
  const counts = new Array(n).fill(0);
  for (const r of history) {
    if (r.t < start || r.t > end + step / 2 || !r[id].ok) continue;
    const i = Math.min(n - 1, Math.max(0, Math.floor((r.t - start) / step)));
    sums[i] += sensorValue(id, r);
    counts[i] += 1;
  }
  return sums.map((s, i) => (counts[i] ? s / counts[i] : null));
}

/** Design `spark()`: auto-scaled 100×28 sparkline (line + area). */
export function sparkPaths(data: (number | null)[]): { line: string; area: string } {
  const pts = data.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return { line: '', area: '' };
  const vals = pts.map((p) => p[1]);
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const rg = Math.max(mx - mn, (mx || 1) * 0.25);
  const n = data.length;
  const xy = pts.map(([i, v]) => [((i / (n - 1)) * 100).toFixed(1), (3 + (1 - (v - mn) / rg) * 22).toFixed(1)]);
  const line = 'M' + xy.map((p) => p.join(' ')).join(' L');
  return { line, area: `${line} L${xy[xy.length - 1][0]} 28 L${xy[0][0]} 28 Z` };
}

/** Design `motionShape()`: on/off step path for events inside a window of `windowSec`. */
export function motionShape(events: MotionEvent[], windowSec: number, W: number, top: number, base: number, now: number) {
  const w = windowSec * 1000;
  const evs = events
    .filter((e) => (e.end ?? now) >= now - w && e.start <= now)
    .map((e) => {
      const x = Math.max(0, (1 - (now - e.start) / w) * W);
      const endX = Math.min(W, (1 - (now - (e.end ?? now)) / w) * W);
      return [x, Math.min(W - x, Math.max(W * 0.012, endX - x))] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  let step = `M0 ${base}`;
  let fill = '';
  evs.forEach(([x, wd]) => {
    step += ` H${x.toFixed(1)} V${top} H${(x + wd).toFixed(1)} V${base}`;
    fill += `M${x.toFixed(1)} ${base} V${top} H${(x + wd).toFixed(1)} V${base} Z `;
  });
  step += ` H${W}`;
  return { step, fill: fill || 'M0 0', count: evs.length };
}
