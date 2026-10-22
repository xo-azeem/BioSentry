import type { IconName } from '@/components/Icon';

export type SensorId = 'rain' | 'tds' | 'gas' | 'motion';

/** One normalised snapshot of all sensors, as returned by the ESP32 (or the demo generator). */
export interface Reading {
  t: number; // phone timestamp (ms) of the sample
  rain: { percent: number; raining: boolean; raw: number; ok: boolean };
  tds: { ppm: number; temp: number | null; voltage: number; raw: number; ok: boolean };
  gas: { percent: number; alarm: boolean; raw: number; ok: boolean };
  motion: { detected: boolean; count: number; lastMotionAt: number | null };
}

/** A motion episode: from the PIR going HIGH until it goes LOW again (`end` null while ongoing). */
export interface MotionEvent {
  start: number;
  end: number | null;
}

export interface DeviceInfo {
  name: string;
  firmware: string;
  board: string;
  uptimeSec: number;
  rssi: number | null;
  ip: string | null;
}

export interface Thresholds {
  rainDamp: number; // %
  rainRaining: number; // %
  tdsFair: number; // ppm
  tdsPoor: number; // ppm
  gasElevated: number; // %
  gasDanger: number; // %
}

export interface Settings {
  host: string; // e.g. 192.168.1.50
  port: number;
  intervalMs: number;
  demo: boolean;
  vibrateOnDanger: boolean;
  keepAwake: boolean;
  theme: 'system' | 'dark' | 'light';
  layout: 'grid' | 'list';
  thresholds: Thresholds;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline' | 'demo';

export type Severity = 'danger' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  t: number;
  sev: Severity;
  icon: IconName;
  sensor: SensorId | 'system';
  title: string;
  sub: string;
}

export interface HistoryPayload {
  readings: Reading[];
  events: MotionEvent[];
}
