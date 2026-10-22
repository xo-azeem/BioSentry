import type { IconName } from '@/components/Icon';

import type { Tone } from './theme';
import type { Reading, SensorId, Thresholds } from './types';

export interface SensorDef {
  id: SensorId;
  name: string;
  icon: IconName;
  unit: string;
  /** Metric name used in the chart title ("TDS · last 15 min"). */
  metric: string;
  /** Fixed chart axis maximum. */
  max: number;
  /** GPIO of the signal pin, shown when a reading is invalid. */
  pin: number;
}

export const SENSORS: SensorDef[] = [
  {
    id: 'rain',
    name: 'Rain Sensor',
    icon: 'rainy',
    unit: '%',
    metric: 'Wetness',
    max: 100,
    pin: 35,
  },
  {
    id: 'tds',
    name: 'Biofilter Water Quality',
    icon: 'water_drop',
    unit: 'ppm',
    metric: 'TDS',
    max: 800,
    pin: 34,
  },
  {
    id: 'gas',
    name: 'Gas / Smoke Sensor',
    icon: 'detector_smoke',
    unit: '%',
    metric: 'Gas level',
    max: 100,
    pin: 32,
  },
  {
    id: 'motion',
    name: 'Motion Sensor',
    icon: 'motion_sensor_active',
    unit: '',
    metric: 'Activity',
    max: 1,
    pin: 14,
  },
];

export const SENSOR_MAP = Object.fromEntries(SENSORS.map((s) => [s.id, s])) as Record<SensorId, SensorDef>;
export const ANALOG_IDS: Exclude<SensorId, 'motion'>[] = ['rain', 'tds', 'gas'];

export function sensorValue(id: SensorId, r: Reading): number {
  switch (id) {
    case 'rain':
      return r.rain.percent;
    case 'tds':
      return r.tds.ppm;
    case 'gas':
      return r.gas.percent;
    case 'motion':
      return r.motion.detected ? 1 : 0;
  }
}

export function isValid(id: SensorId, r: Reading): boolean {
  if (id === 'motion') return true;
  return r[id].ok;
}

export interface SensorStatus {
  label: string;
  tone: Tone;
  icon: IconName;
}

/** Status rules exactly as in the design (`statusOf`). */
export function statusOf(id: SensorId, v: number, th: Thresholds, detected = false): SensorStatus {
  switch (id) {
    case 'rain':
      if (v < th.rainDamp) return { label: 'Dry', tone: 'safe', icon: 'check_circle' };
      if (v <= th.rainRaining) return { label: 'Damp', tone: 'info', icon: 'water_drop' };
      return { label: 'Raining', tone: 'warning', icon: 'rainy' };
    case 'tds':
      if (v < th.tdsFair) return { label: 'Good', tone: 'safe', icon: 'check_circle' };
      if (v <= th.tdsPoor) return { label: 'Fair', tone: 'warning', icon: 'warning' };
      return { label: 'Poor', tone: 'danger', icon: 'error' };
    case 'gas':
      if (v < th.gasElevated) return { label: 'Normal', tone: 'safe', icon: 'check_circle' };
      if (v <= th.gasDanger) return { label: 'Elevated', tone: 'warning', icon: 'warning' };
      return { label: 'DANGER', tone: 'danger', icon: 'error' };
    case 'motion':
      return detected ? { label: 'Detected', tone: 'info', icon: 'sensors' } : { label: 'Clear', tone: 'safe', icon: 'check_circle' };
  }
}

export function readingStatus(id: SensorId, r: Reading, th: Thresholds): SensorStatus {
  return statusOf(id, sensorValue(id, r), th, r.motion.detected);
}

export function thresholdLines(id: SensorId, th: Thresholds): { value: number; label: string; tone: Tone }[] {
  switch (id) {
    case 'rain':
      return [
        { value: th.rainDamp, label: 'Damp', tone: 'info' },
        { value: th.rainRaining, label: 'Raining', tone: 'warning' },
      ];
    case 'tds':
      return [
        { value: th.tdsFair, label: 'Fair', tone: 'warning' },
        { value: th.tdsPoor, label: 'Poor', tone: 'danger' },
      ];
    case 'gas':
      return [
        { value: th.gasElevated, label: 'Elevated', tone: 'warning' },
        { value: th.gasDanger, label: 'Danger', tone: 'danger' },
      ];
    case 'motion':
      return [];
  }
}

/** "72%" / "214 ppm" */
export function withUnit(id: SensorId, v: number): string {
  const u = SENSOR_MAP[id].unit;
  return Math.round(v) + (u === '%' ? '%' : u ? ' ' + u : '');
}
