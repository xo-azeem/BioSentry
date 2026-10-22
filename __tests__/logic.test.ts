import { evaluateAlerts } from '@/lib/alerts';
import { cleanHost, isValidHost, isValidPort, parseHistory, parseReading } from '@/lib/api';
import { buildBanner, buildCard } from '@/lib/cards';
import { createDemoSource } from '@/lib/demo';
import { agoStr, dayLabel, dbm, uptime } from '@/lib/format';
import { statusOf } from '@/lib/sensors';
import { bucketize, motionShape, sparkPaths } from '@/lib/series';
import { mix } from '@/lib/theme';
import { DEFAULT_SETTINGS } from '@/lib/store';
import type { Reading } from '@/lib/types';

const th = DEFAULT_SETTINGS.thresholds;
const NOW = new Date(2026, 9, 23, 14, 2, 30).getTime();

const esp = (o: Partial<Record<'rain' | 'tds' | 'gas' | 'motion', object>> = {}) => ({
  device: 'BioSentry-ESP32',
  fw: '1.1.0',
  board: 'ESP32-D0WD-V3',
  uptime: 274320,
  rssi: -58,
  ip: '192.168.1.50',
  rain: { raw: 3768, percent: 8, raining: false, ok: true, ...o.rain },
  tds: { raw: 812, voltage: 0.65, ppm: 214, temp: 22.4, ok: true, ...o.tds },
  gas: { raw: 737, percent: 18, alarm: false, ok: true, ...o.gas },
  motion: { detected: false, count: 7, lastSeconds: 1278, ...o.motion },
});
const reading = (o?: Parameters<typeof esp>[0], t = NOW): Reading => parseReading(esp(o), t).reading;

describe('address validation', () => {
  it('cleans pasted URLs', () => {
    expect(cleanHost(' http://192.168.1.50:80/api ')).toBe('192.168.1.50');
  });
  it('accepts full IPv4 addresses and dotted hostnames only', () => {
    expect(isValidHost('192.168.1.50')).toBe(true);
    expect(isValidHost('192.168.4.1')).toBe(true);
    expect(isValidHost('biosentry.local')).toBe(true);
    expect(isValidHost('192.168.1')).toBe(false); // the design's error example
    expect(isValidHost('192.168.1.300')).toBe(false);
    expect(isValidHost('')).toBe(false);
  });
  it('validates ports', () => {
    expect(isValidPort('80')).toBe(true);
    expect(isValidPort('0')).toBe(false);
    expect(isValidPort('70000')).toBe(false);
  });
});

describe('ESP32 JSON parsing', () => {
  it('parses a full reading and device info', () => {
    const { reading: r, device } = parseReading(esp({ motion: { lastSeconds: 10 } }), NOW);
    expect(r.tds).toEqual({ ppm: 214, temp: 22.4, voltage: 0.65, raw: 812, ok: true });
    expect(r.motion.lastMotionAt).toBe(NOW - 10_000);
    expect(device).toMatchObject({ firmware: '1.1.0', board: 'ESP32-D0WD-V3', rssi: -58 });
  });
  it('flags invalid sensors (ok:false, or missing value)', () => {
    expect(reading({ tds: { ok: false } }).tds.ok).toBe(false);
    expect(parseReading({ ...esp(), gas: { raw: 1 } }, NOW).reading.gas.ok).toBe(false);
    expect(reading().rain.ok).toBe(true);
  });
  it('survives garbage without throwing', () => {
    const { reading: r } = parseReading({ rain: 'x', tds: null }, NOW);
    expect(r.rain.percent).toBe(0);
    expect(r.tds.ok).toBe(false);
  });
  it('parses /api/history into timestamped readings and motion events', () => {
    const h = parseHistory({ step: 5, age: 2, rain: [1, 2, 3], tds: [200, null, 220], gas: [10, 11, 12], motion: [0, 1, 0], events: [[30, 6], [5, -1]] }, NOW);
    expect(h.readings.map((r) => r.t)).toEqual([NOW - 12_000, NOW - 7_000, NOW - 2_000]);
    expect(h.readings[1].tds.ok).toBe(false);
    expect(h.readings[1].motion.detected).toBe(true);
    expect(h.events).toEqual([
      { start: NOW - 30_000, end: NOW - 24_000 },
      { start: NOW - 5_000, end: null },
    ]);
  });
});

describe('status rules (design statusOf)', () => {
  it.each([
    ['rain', 19, 'Dry'],
    ['rain', 20, 'Damp'],
    ['rain', 60, 'Damp'],
    ['rain', 61, 'Raining'],
    ['tds', 299, 'Good'],
    ['tds', 300, 'Fair'],
    ['tds', 600, 'Fair'],
    ['tds', 601, 'Poor'],
    ['gas', 34, 'Normal'],
    ['gas', 35, 'Elevated'],
    ['gas', 60, 'Elevated'],
    ['gas', 72, 'DANGER'],
  ] as const)('%s %d → %s', (id, v, label) => {
    expect(statusOf(id, v, th).label).toBe(label);
  });
  it('motion is info when detected', () => {
    expect(statusOf('motion', 0, th, true)).toEqual({ label: 'Detected', tone: 'info', icon: 'sensors' });
  });
});

describe('alerts', () => {
  it('raises a danger alert with the design wording when gas crosses the danger line', () => {
    const out = evaluateAlerts(reading(), reading({ gas: { percent: 72, raw: 2948 } }), th);
    expect(out).toEqual([{ sev: 'danger', icon: 'detector_smoke', sensor: 'gas', title: 'Gas level reached 72% — Danger', sub: 'Gas / Smoke Sensor · ADC 2948' }]);
  });
  it('reports water quality fair, motion, and an invalid probe', () => {
    const out = evaluateAlerts(reading(), reading({ tds: { ppm: 312 }, motion: { detected: true } }), th);
    expect(out.map((a) => a.title)).toEqual(['Water quality fair — 312 ppm', 'Motion detected']);
    const bad = evaluateAlerts(reading(), reading({ tds: { ok: false } }), th);
    expect(bad[0]).toMatchObject({ sev: 'warning', icon: 'sensors_off', title: 'Biofilter Water Quality not reporting' });
  });
  it('rain started → rain stopped only once back to Dry', () => {
    const mem = { raining: false };
    expect(evaluateAlerts(reading(), reading({ rain: { percent: 64, raining: true } }), th, mem)[0].title).toBe('Rain started');
    expect(evaluateAlerts(reading({ rain: { percent: 64 } }), reading({ rain: { percent: 40 } }), th, mem)).toEqual([]);
    expect(evaluateAlerts(reading({ rain: { percent: 40 } }), reading({ rain: { percent: 10 } }), th, mem)[0]).toMatchObject({ title: 'Rain stopped', sub: 'Wetness back under 20%' });
  });
  it('stays quiet when nothing changes', () => {
    expect(evaluateAlerts(reading(), reading(), th)).toEqual([]);
  });
});

describe('chart sampling', () => {
  it('averages readings into evenly spaced buckets with gaps as null', () => {
    const hist = [0, 1, 2, 3, 10, 11].map((s, i) => reading({ gas: { percent: i * 10 } }, NOW - (11 - s) * 1000));
    const b = bucketize(hist, 'gas', 6, 2, NOW);
    expect(b).toHaveLength(6);
    expect(b.filter((v) => v === null).length).toBeGreaterThan(0);
    expect(b[5]).toBe(45); // the last two readings (40, 50) fall in the final bucket
  });
  it('builds a sparkline inside the 100×28 box', () => {
    const { line, area } = sparkPaths([1, 2, 3, null, 5]);
    expect(line.startsWith('M0.0 ')).toBe(true);
    expect(area.endsWith('Z')).toBe(true);
    const ys = [...line.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => +m[2]);
    ys.forEach((y) => {
      expect(y).toBeGreaterThanOrEqual(3);
      expect(y).toBeLessThanOrEqual(25);
    });
  });
  it('places motion events on the step timeline', () => {
    const ev = [{ start: NOW - 30 * 60_000, end: NOW - 30 * 60_000 + 6000 }, { start: NOW - 10_000, end: null }];
    const shape = motionShape(ev, 3600, 320, 24, 96, NOW);
    expect(shape.count).toBe(2);
    expect(shape.step).toMatch(/^M0 96 H160\.\d V24/);
    expect(motionShape(ev, 60, 320, 24, 96, NOW).count).toBe(1);
  });
});

describe('dashboard cards and banner', () => {
  const base = { history: [] as Reading[], events: [], th, now: NOW, offline: false, lastSuccessAt: NOW };
  it('normal state', () => {
    const latest = reading();
    const cards = (['rain', 'tds', 'gas', 'motion'] as const).map((id) => buildCard(id, { ...base, latest }));
    expect(cards.map((c) => [c.valueText, c.status])).toEqual([
      ['8', 'Dry'],
      ['214', 'Good'],
      ['18', 'Normal'],
      ['Clear', 'Clear'],
    ]);
    expect(cards[1].sub).toBe('Water 22.4 °C');
    expect(buildBanner(cards, latest, { offline: false, lastSuccessAt: NOW })).toMatchObject({ kind: 'normal', title: 'All systems normal', body: '4 of 4 sensors reporting · 14:02:30' });
  });
  it('gas danger + raining', () => {
    const latest = reading({ gas: { percent: 72 }, rain: { percent: 78, raining: true } });
    const cards = (['rain', 'tds', 'gas', 'motion'] as const).map((id) => buildCard(id, { ...base, latest }));
    expect(cards[2]).toMatchObject({ status: 'DANGER', tone: 'danger', valColor: 'danger', danger: true, sparkTone: 'danger' });
    expect(cards[0]).toMatchObject({ status: 'Raining', tone: 'warning', sub: 'Digital: Raining' });
    expect(buildBanner(cards, latest, { offline: false, lastSuccessAt: NOW })).toMatchObject({
      kind: 'danger',
      title: 'Gas level dangerous!',
      body: '72% at 14:02 — ventilate the area. Also raining (78%).',
      target: 'gas',
    });
  });
  it('offline shows last known values', () => {
    const latest = reading();
    const card = buildCard('tds', { ...base, latest, offline: true, lastSuccessAt: new Date(2026, 9, 23, 13, 58).getTime() });
    expect(card).toMatchObject({ status: 'Last known', statusIcon: 'cloud_off', valColor: 'text3', sub: 'Last data 13:58', iconTone: 'offline' });
  });
  it('invalid sensor drops the number', () => {
    const latest = reading({ tds: { ok: false } });
    const cards = (['rain', 'tds', 'gas', 'motion'] as const).map((id) => buildCard(id, { ...base, latest }));
    expect(cards[1]).toMatchObject({ valueText: '—', unit: '', status: 'Invalid reading', sub: 'Check probe wiring · GPIO 34' });
    expect(buildBanner(cards, latest, { offline: false, lastSuccessAt: NOW })).toMatchObject({
      kind: 'invalid',
      title: '1 sensor not reporting',
      body: 'Biofilter Water Quality returned an invalid reading.',
    });
  });
});

describe('demo source', () => {
  it('produces an hour of history and sane live values', () => {
    const src = createDemoSource(NOW);
    const h = src.history(NOW);
    expect(h.readings.length).toBe(720);
    const { reading: r } = src.read(NOW);
    expect(r.rain.percent).toBeGreaterThanOrEqual(0);
    expect(r.rain.percent).toBeLessThanOrEqual(100);
    expect(r.tds.ppm).toBeGreaterThan(100);
    expect(r.gas.percent).toBeLessThanOrEqual(100);
  });
});

describe('formatting', () => {
  it('matches the design strings', () => {
    expect(dbm(-58)).toBe('−58 dBm');
    expect(uptime(3 * 86400 + 4 * 3600 + 12 * 60)).toBe('3 d 4 h 12 m');
    expect(agoStr(NOW - 12_000, NOW)).toBe('12 s ago');
    expect(agoStr(NOW - 4 * 60_000, NOW)).toBe('4 min ago');
    expect(dayLabel(NOW - 86400_000, NOW)).toBe('Yesterday');
    expect(mix('#FF5B53', 10, '#121D20')).toBe('#2a2325');
    expect(mix('#14B8A6', 15)).toBe('rgba(20,184,166,0.15)');
  });
});
