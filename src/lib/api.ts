import type { DeviceInfo, HistoryPayload, MotionEvent, Reading } from './types';

/** Accepts "192.168.1.50", "http://192.168.1.50:8080/" etc. and returns a clean host. */
export function cleanHost(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

/** A full IPv4 address (192.168.1.50) or a hostname with a dot (biosentry.local). */
export function isValidHost(input: string): boolean {
  const h = cleanHost(input);
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) return ipv4.slice(1).every((n) => Number(n) <= 255);
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(h) && !/^[\d.]+$/.test(h);
}

export function isValidPort(input: string | number): boolean {
  const n = Number(input);
  return Number.isInteger(n) && n > 0 && n < 65536;
}

export function baseUrl(host: string, port: number): string {
  const h = cleanHost(host);
  return port === 80 ? `http://${h}` : `http://${h}:${port}`;
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? n : fallback;
};
const finite = (v: unknown) => v !== null && v !== undefined && Number.isFinite(Number(v));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A sensor is valid unless the firmware says `ok:false` or its main value is missing. */
const okFlag = (o: any, key: string) => o?.ok !== false && finite(o?.[key]);

/**
 * Expected JSON from the ESP32 at GET /api/sensors (see firmware/BioSentry/BioSentry.ino):
 * {
 *   "device": "BioSentry-ESP32", "fw": "1.1.0", "board": "ESP32-D0WD-V3", "uptime": 1234, "rssi": -58, "ip": "192.168.1.50",
 *   "rain":   { "raw": 3100, "percent": 24.3, "raining": false, "ok": true },
 *   "tds":    { "raw": 812, "voltage": 0.65, "ppm": 245.3, "temp": 22.4, "ok": true },
 *   "gas":    { "raw": 900, "percent": 22.0, "alarm": false, "ok": true },
 *   "motion": { "detected": false, "count": 12, "lastSeconds": 34 }
 * }
 */
export function parseReading(json: any, now = Date.now()): { reading: Reading; device: DeviceInfo } {
  const lastSeconds = num(json?.motion?.lastSeconds, -1);
  const temp = json?.tds?.temp;
  return {
    reading: {
      t: now,
      rain: {
        percent: clamp(num(json?.rain?.percent), 0, 100),
        raining: Boolean(json?.rain?.raining),
        raw: num(json?.rain?.raw),
        ok: okFlag(json?.rain, 'percent'),
      },
      tds: {
        ppm: Math.max(0, num(json?.tds?.ppm)),
        temp: finite(temp) ? Number(temp) : null,
        voltage: num(json?.tds?.voltage),
        raw: num(json?.tds?.raw),
        ok: okFlag(json?.tds, 'ppm'),
      },
      gas: {
        percent: clamp(num(json?.gas?.percent), 0, 100),
        alarm: Boolean(json?.gas?.alarm),
        raw: num(json?.gas?.raw),
        ok: okFlag(json?.gas, 'percent'),
      },
      motion: {
        detected: Boolean(json?.motion?.detected),
        count: num(json?.motion?.count),
        lastMotionAt: lastSeconds >= 0 ? now - lastSeconds * 1000 : null,
      },
    },
    device: {
      name: String(json?.device ?? 'ESP32'),
      firmware: String(json?.fw ?? '?'),
      board: String(json?.board ?? 'ESP32'),
      uptimeSec: num(json?.uptime),
      rssi: finite(json?.rssi) ? Number(json.rssi) : null,
      ip: json?.ip ? String(json.ip) : null,
    },
  };
}

/**
 * GET /api/history — the last hour the ESP32 has buffered, so charts are full as soon as the app opens:
 * { "step": 5, "age": 2, "rain": [...], "tds": [...], "gas": [...], "motion": [0,1,...],
 *   "events": [[secondsAgo, durationSeconds | -1 while ongoing], ...] }
 * Arrays run oldest → newest; the newest sample was taken `age` seconds ago.
 */
export function parseHistory(json: any, now = Date.now()): HistoryPayload {
  const step = num(json?.step, 5) * 1000;
  const age = num(json?.age) * 1000;
  const rain: unknown[] = Array.isArray(json?.rain) ? json.rain : [];
  const tds: unknown[] = Array.isArray(json?.tds) ? json.tds : [];
  const gas: unknown[] = Array.isArray(json?.gas) ? json.gas : [];
  const motion: unknown[] = Array.isArray(json?.motion) ? json.motion : [];
  const n = Math.max(rain.length, tds.length, gas.length, motion.length);
  const readings: Reading[] = [];
  for (let i = 0; i < n; i++) {
    const t = now - age - (n - 1 - i) * step;
    const r = num(rain[i]);
    const g = num(gas[i]);
    readings.push({
      t,
      rain: { percent: clamp(r, 0, 100), raining: false, raw: Math.round(4095 - (r / 100) * 4095), ok: finite(rain[i]) },
      tds: { ppm: Math.max(0, num(tds[i])), temp: null, voltage: 0, raw: 0, ok: finite(tds[i]) },
      gas: { percent: clamp(g, 0, 100), alarm: false, raw: Math.round((g / 100) * 4095), ok: finite(gas[i]) },
      motion: { detected: num(motion[i]) > 0, count: 0, lastMotionAt: null },
    });
  }
  const events: MotionEvent[] = (Array.isArray(json?.events) ? json.events : [])
    .filter((e: unknown) => Array.isArray(e) && finite(e[0]))
    .map((e: any[]) => {
      const start = now - num(e[0]) * 1000;
      const dur = num(e[1], -1);
      return { start, end: dur < 0 ? null : start + dur * 1000 };
    })
    .sort((a: MotionEvent, b: MotionEvent) => a.start - b.start);
  return { readings, events };
}

async function getJson(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`ESP32 responded with HTTP ${res.status}`);
    return await res.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Timed out — no response');
    throw new Error(e?.message ?? 'Network error');
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchReading(host: string, port: number, timeoutMs: number) {
  const started = Date.now();
  const json = await getJson(`${baseUrl(host, port)}/api/sensors`, timeoutMs);
  return { ...parseReading(json), latencyMs: Date.now() - started };
}

export async function fetchHistory(host: string, port: number): Promise<HistoryPayload | null> {
  try {
    return parseHistory(await getJson(`${baseUrl(host, port)}/api/history`, 6000));
  } catch {
    return null; // older firmware without history — live data still works
  }
}
