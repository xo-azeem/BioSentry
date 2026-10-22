import type { IconName } from '@/components/Icon';

import { hm, startOfToday } from './format';
import { isValid, readingStatus, SENSOR_MAP } from './sensors';
import { bucketize, motionShape, sparkPaths } from './series';
import type { Tone } from './theme';
import type { MotionEvent, Reading, SensorId, Thresholds } from './types';

export interface CardModel {
  id: SensorId;
  name: string;
  icon: IconName;
  valueText: string;
  unit: string;
  status: string;
  statusIcon: IconName;
  tone: Tone;
  /** Value colour: danger red, normal text, or muted for offline / invalid. */
  valColor: 'danger' | 'text' | 'text3';
  sub: string;
  iconTone: Tone;
  sparkTone: Tone;
  areaOpacity: number;
  spark: { line: string; area: string };
  danger: boolean;
  invalid: boolean;
}

export interface CardContext {
  latest: Reading;
  history: Reading[];
  events: MotionEvent[];
  th: Thresholds;
  now: number;
  /** Showing last known values because the ESP32 stopped answering. */
  offline: boolean;
  lastSuccessAt: number | null;
}

export const SPARK_POINTS = 40;
export const SPARK_STEP_SEC = 6;

export function motionStats(events: MotionEvent[], now: number) {
  const today = events.filter((e) => e.start >= startOfToday(now)).length;
  const last = events.length ? events[events.length - 1] : null;
  return { today, last, ongoing: !!last && last.end === null };
}

/** Builds one dashboard card (design `mkCard`). */
export function buildCard(id: SensorId, ctx: CardContext): CardModel {
  const def = SENSOR_MAP[id];
  const r = ctx.latest;
  const st = readingStatus(id, r, ctx.th);
  let valueText: string;
  let sub: string;
  let spark: { line: string; area: string };

  if (id === 'motion') {
    const m = motionStats(ctx.events, ctx.now);
    valueText = st.label;
    sub = r.motion.detected
      ? `Moving now · ${m.today} today`
      : m.last
        ? `Last ${hm(m.last.end ?? m.last.start)} · ${m.today} today`
        : 'No motion yet · 0 today';
    const ms = motionShape(ctx.events, 3600, 100, 4, 26, ctx.now);
    spark = { line: ms.step, area: ms.fill };
  } else {
    valueText = String(Math.round(id === 'rain' ? r.rain.percent : id === 'tds' ? r.tds.ppm : r.gas.percent));
    spark = sparkPaths(bucketize(ctx.history, id, SPARK_POINTS, SPARK_STEP_SEC, r.t));
    if (id === 'rain') sub = `Digital: ${r.rain.raining ? 'Raining' : 'Dry'}`;
    else if (id === 'tds') sub = r.tds.temp !== null ? `Water ${r.tds.temp.toFixed(1)} °C` : `Probe ${r.tds.voltage.toFixed(2)} V`;
    else sub = `Raw ADC ${r.gas.raw}`;
  }

  let tone: Tone = st.tone;
  let status = st.label;
  let statusIcon: IconName = st.icon;
  let valColor: CardModel['valColor'] = tone === 'danger' ? 'danger' : 'text';
  let unit = def.unit;
  const invalid = !isValid(id, r);

  if (ctx.offline) {
    tone = 'offline';
    status = 'Last known';
    statusIcon = 'cloud_off';
    valColor = 'text3';
    sub = `Last data ${ctx.lastSuccessAt ? hm(ctx.lastSuccessAt) : '—'}`;
  }
  if (invalid) {
    tone = 'offline';
    status = 'Invalid reading';
    statusIcon = 'sensors_off';
    valColor = 'text3';
    valueText = '—';
    unit = '';
    sub = `Check probe wiring · GPIO ${def.pin}`;
  }
  const muted = ctx.offline || invalid;
  const danger = tone === 'danger';

  return {
    id,
    name: def.name,
    icon: def.icon,
    valueText,
    unit,
    status,
    statusIcon,
    tone,
    valColor,
    sub,
    iconTone: muted ? 'offline' : tone === 'safe' ? 'primary' : tone,
    sparkTone: muted ? 'offline' : danger ? 'danger' : tone === 'safe' ? 'primary' : tone,
    areaOpacity: id === 'motion' ? 0.28 : 0.1,
    spark,
    danger,
    invalid,
  };
}

export interface BannerModel {
  kind: 'danger' | 'offline' | 'invalid' | 'warning' | 'normal';
  icon: IconName;
  title: string;
  body: string;
  /** Sensor to open when the banner is tapped. */
  target?: SensorId;
}

/** Dashboard banner (design: danger → offline → invalid → all normal; plus a warning summary). */
export function buildBanner(cards: CardModel[], latest: Reading, ctx: { offline: boolean; lastSuccessAt: number | null }): BannerModel {
  const by = Object.fromEntries(cards.map((c) => [c.id, c])) as Record<SensorId, CardModel>;
  const rainNote = by.rain.status === 'Raining' ? ` Also raining (${by.rain.valueText}%).` : '';
  if (!ctx.offline && by.gas.danger) {
    return {
      kind: 'danger',
      icon: 'detector_smoke',
      title: 'Gas level dangerous!',
      body: `${by.gas.valueText}% at ${hm(latest.t)} — ventilate the area.${rainNote}${by.tds.danger ? ' Water quality is also poor.' : ''}`,
      target: 'gas',
    };
  }
  if (!ctx.offline && by.tds.danger) {
    return { kind: 'danger', icon: 'water_drop', title: 'Water quality poor!', body: `${by.tds.valueText} ppm at ${hm(latest.t)} — check the biofilter.${rainNote}`, target: 'tds' };
  }
  if (ctx.offline) {
    return {
      kind: 'offline',
      icon: 'cloud_off',
      title: 'ESP32 offline',
      body: `Showing last known values from ${ctx.lastSuccessAt ? hm(ctx.lastSuccessAt) : '—'}. Retrying every 10 s.`,
    };
  }
  const invalid = cards.filter((c) => c.invalid);
  if (invalid.length) {
    return {
      kind: 'invalid',
      icon: 'sensors_off',
      title: `${invalid.length} sensor${invalid.length > 1 ? 's' : ''} not reporting`,
      body: `${invalid.map((c) => c.name).join(' and ')} returned an invalid reading.`,
      target: invalid[0].id,
    };
  }
  const attention = cards.filter((c) => c.id !== 'motion' && c.tone === 'warning');
  if (attention.length) {
    return {
      kind: 'warning',
      icon: 'warning',
      title: attention.length === 1 ? '1 sensor needs attention' : `${attention.length} sensors need attention`,
      body: attention.map((c) => `${c.name}: ${c.status} (${c.valueText}${c.unit === '%' ? '%' : ' ' + c.unit})`).join(' · '),
      target: attention[0].id,
    };
  }
  const reporting = cards.filter((c) => !c.invalid).length;
  const d = new Date(latest.t);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return {
    kind: 'normal',
    icon: 'check_circle',
    title: 'All systems normal',
    body: `${reporting} of 4 sensors reporting · ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`,
  };
}
