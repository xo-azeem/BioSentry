import type { DeviceInfo, HistoryPayload, MotionEvent, Reading } from './types';

const HOUR = 3600_000;

/**
 * Believable simulated sensors so the app can be explored without hardware.
 * Mostly calm, with slow rain showers, a creeping TDS, an occasional gas spike and random motion.
 */
export function createDemoSource(startAt = Date.now()) {
  const seed = startAt / 1000;
  const noise = (k: number, s: number) => {
    const x = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453;
    return x - Math.floor(x) - 0.5;
  };

  // Gas spikes and motion are decided per time slot, so history and live data agree.
  const gasAt = (t: number) => {
    const sec = t / 1000;
    const slot = Math.floor(sec / 600); // one possible spike every 10 minutes
    let v = 18 + noise(Math.floor(sec / 3), 3) * 3 + noise(Math.floor(sec / 21), 10) * 4;
    if (noise(slot, 41) > 0.38) {
      const into = sec - slot * 600 - 120;
      if (into > 0 && into < 150) v += 54 * Math.sin((into / 150) * Math.PI);
    }
    return Math.max(0, Math.min(100, v));
  };
  const rainAt = (t: number) => {
    const min = t / 60000;
    const wave = Math.max(0, Math.sin((min - seed / 60) / 7)) * 85;
    return Math.max(0, Math.min(100, 8 + wave + noise(Math.floor(t / 3000), 1) * 3));
  };
  const tdsAt = (t: number) => 214 + Math.sin(t / 900_000) * 40 + noise(Math.floor(t / 3000), 2) * 6 + noise(Math.floor(t / 21000), 9) * 9;
  const tempAt = (t: number) => 22.4 + Math.sin(t / 1_800_000) * 0.8;
  const motionEvents = (from: number, to: number): MotionEvent[] => {
    const out: MotionEvent[] = [];
    // About three short visits an hour, like someone checking the drum.
    for (let slot = Math.floor(from / 600_000); slot <= Math.floor(to / 600_000); slot++) {
      if (noise(slot, 17) > 0.0) continue; // half of the 10-minute slots have motion
      const start = slot * 600_000 + Math.floor((noise(slot, 23) + 0.5) * 540_000);
      const end = start + 3000 + Math.floor((noise(slot, 29) + 0.5) * 15_000);
      if (start >= from && start <= to) out.push({ start, end });
    }
    return out;
  };

  const readingAt = (t: number, events: MotionEvent[]): Reading => {
    const rain = rainAt(t);
    const tds = tdsAt(t);
    const gas = gasAt(t);
    const active = events.find((e) => e.start <= t && (e.end ?? Infinity) >= t);
    const past = events.filter((e) => e.start <= t);
    return {
      t,
      rain: { percent: rain, raining: rain > 60, raw: Math.round(4095 - (rain / 100) * 4095), ok: true },
      tds: { ppm: tds, temp: tempAt(t), voltage: tds / 400, raw: Math.round((tds / 400 / 3.3) * 4095), ok: true },
      gas: { percent: gas, alarm: gas > 75, raw: Math.round((gas / 100) * 4095), ok: true },
      motion: { detected: !!active, count: past.length, lastMotionAt: past.length ? (past[past.length - 1].end ?? t) : null },
    };
  };

  const device = (now: number): DeviceInfo => ({
    name: 'Demo device',
    firmware: 'Demo',
    board: 'Simulated ESP32',
    uptimeSec: Math.round((now - startAt) / 1000 + 3 * 86400 + 4 * 3600),
    rssi: -58,
    ip: null,
  });

  return {
    /** One hour of 5-second samples, like the ESP32's /api/history. */
    history(now = Date.now()): HistoryPayload {
      const events = motionEvents(now - HOUR, now);
      const readings: Reading[] = [];
      for (let t = now - HOUR; t < now; t += 5000) readings.push(readingAt(t, events));
      return { readings, events };
    },
    read(now = Date.now()) {
      const events = motionEvents(now - HOUR, now);
      return { reading: readingAt(now, events), device: device(now) };
    },
  };
}
