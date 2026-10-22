import { readingStatus, SENSOR_MAP } from './sensors';
import type { AlertItem, Reading, Thresholds } from './types';

export type NewAlert = Omit<AlertItem, 'id' | 't'>;

const pct = (v: number) => `${Math.round(v)}%`;

/** Remembers whether a rain shower is in progress, so "Rain stopped" fires once wetness is back to Dry. */
export interface AlertMemory {
  raining: boolean;
}

/** Compares two consecutive readings and returns the alerts the change should raise (wording from the design). */
export function evaluateAlerts(prev: Reading, cur: Reading, th: Thresholds, memory: AlertMemory = { raining: false }): NewAlert[] {
  const out: NewAlert[] = [];

  // Gas / smoke
  if (cur.gas.ok && prev.gas.ok) {
    const a = readingStatus('gas', prev, th).tone;
    const b = readingStatus('gas', cur, th).tone;
    const adc = `${SENSOR_MAP.gas.name} · ADC ${cur.gas.raw}`;
    if (b !== a) {
      if (b === 'danger') out.push({ sev: 'danger', icon: 'detector_smoke', sensor: 'gas', title: `Gas level reached ${pct(cur.gas.percent)} — Danger`, sub: adc });
      else if (b === 'warning' && a === 'safe') out.push({ sev: 'warning', icon: 'detector_smoke', sensor: 'gas', title: `Gas level elevated — ${pct(cur.gas.percent)}`, sub: adc });
      else if (b === 'safe') out.push({ sev: 'info', icon: 'detector_smoke', sensor: 'gas', title: 'Gas level back to normal', sub: `Now ${pct(cur.gas.percent)} · ${SENSOR_MAP.gas.name}` });
    }
  }

  // Biofilter water quality
  if (cur.tds.ok && prev.tds.ok) {
    const a = readingStatus('tds', prev, th).tone;
    const b = readingStatus('tds', cur, th).tone;
    const ppm = `${Math.round(cur.tds.ppm)} ppm`;
    if (b !== a) {
      if (b === 'danger') out.push({ sev: 'danger', icon: 'water_drop', sensor: 'tds', title: `Water quality poor — ${ppm}`, sub: `Biofilter TDS above ${th.tdsPoor} ppm` });
      else if (b === 'warning' && a === 'safe') out.push({ sev: 'warning', icon: 'water_drop', sensor: 'tds', title: `Water quality fair — ${ppm}`, sub: `Biofilter TDS above ${th.tdsFair} ppm` });
      else if (b === 'safe') out.push({ sev: 'info', icon: 'water_drop', sensor: 'tds', title: `Water quality good — ${ppm}`, sub: `Biofilter TDS below ${th.tdsFair} ppm` });
    }
  }

  // Rain
  if (cur.rain.ok && prev.rain.ok) {
    const a = readingStatus('rain', prev, th).label;
    const b = readingStatus('rain', cur, th).label;
    if (b === 'Raining' && a !== 'Raining' && !memory.raining) {
      memory.raining = true;
      out.push({ sev: 'warning', icon: 'rainy', sensor: 'rain', title: 'Rain started', sub: `Wetness ${pct(cur.rain.percent)} · digital output ${cur.rain.raining ? 'Raining' : 'Dry'}` });
    } else if (b === 'Dry' && memory.raining) {
      memory.raining = false;
      out.push({ sev: 'info', icon: 'sunny', sensor: 'rain', title: 'Rain stopped', sub: `Wetness back under ${th.rainDamp}%` });
    }
  }

  // Motion
  if (cur.motion.detected && !prev.motion.detected) {
    out.push({ sev: 'info', icon: 'motion_sensor_active', sensor: 'motion', title: 'Motion detected', sub: `${SENSOR_MAP.motion.name} · above drum hatch` });
  }

  // Sensors that stop reporting
  (['rain', 'tds', 'gas'] as const).forEach((id) => {
    if (prev[id].ok && !cur[id].ok) {
      out.push({ sev: 'warning', icon: 'sensors_off', sensor: id, title: `${SENSOR_MAP[id].name} not reporting`, sub: `Invalid reading · check wiring on GPIO ${SENSOR_MAP[id].pin}` });
    }
  });

  return out;
}
