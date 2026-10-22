import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Vibration } from 'react-native';

import { evaluateAlerts, type AlertMemory, type NewAlert } from './alerts';
import { cleanHost, fetchHistory, fetchReading } from './api';
import { createDemoSource } from './demo';
import type { AlertItem, ConnectionStatus, DeviceInfo, HistoryPayload, MotionEvent, Reading, Settings } from './types';

const SETTINGS_KEY = 'biosentry.settings.v2';
const ALERTS_KEY = 'biosentry.alerts.v2';
const SEEN_KEY = 'biosentry.alertsSeen.v1';
const HISTORY_WINDOW_MS = 62 * 60 * 1000; // a little over the 1-hour chart range
const MAX_ALERTS = 200;
const MAX_EVENTS = 200;
/** After 3 failed polls the ESP32 counts as offline and is retried every 10 s. */
export const OFFLINE_AFTER = 3;
export const OFFLINE_RETRY_MS = 10_000;

export const DEFAULT_SETTINGS: Settings = {
  host: '',
  port: 80,
  intervalMs: 2000,
  demo: false,
  vibrateOnDanger: true,
  keepAwake: true,
  theme: 'system',
  layout: 'grid',
  thresholds: {
    rainDamp: 20,
    rainRaining: 60,
    tdsFair: 300,
    tdsPoor: 600,
    gasElevated: 35,
    gasDanger: 60,
  },
};

interface SensorContextValue {
  loaded: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  status: ConnectionStatus;
  error: string | null;
  latest: Reading | null;
  device: DeviceInfo | null;
  latencyMs: number | null;
  failures: number;
  nextRetryAt: number | null;
  lastSuccessAt: number | null;
  history: Reading[];
  motionEvents: MotionEvent[];
  alerts: AlertItem[];
  unseenAlerts: number;
  markAlertsSeen: () => void;
  clearAlerts: () => void;
  refresh: () => Promise<boolean>;
  testConnection: (host: string, port: number) => Promise<{ device: DeviceInfo; latencyMs: number; reading: Reading }>;
}

const SensorContext = createContext<SensorContextValue | null>(null);

export function useSensors() {
  const ctx = useContext(SensorContext);
  if (!ctx) throw new Error('useSensors must be used inside <SensorProvider>');
  return ctx;
}

/** Adds events we haven't seen yet (same start ±5 s counts as the same event). */
function mergeEvents(list: MotionEvent[], incoming: MotionEvent[], now: number): MotionEvent[] {
  const out = [...list];
  for (const e of incoming) {
    const ev = { start: e.start, end: e.end !== null && e.end > now ? null : e.end };
    const same = out.findIndex((x) => Math.abs(x.start - ev.start) < 5000);
    if (same === -1) out.push(ev);
    else if (out[same].end === null && ev.end !== null) out[same] = { ...out[same], end: ev.end };
  }
  return out.sort((a, b) => a.start - b.start).slice(-MAX_EVENTS);
}

export function SensorProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  /** Connection state of the polling loop; demo / no-address are derived (see `status` below). */
  const [rawStatus, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [motionEvents, setMotionEvents] = useState<MotionEvent[]>([]);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [latencyMs, setLatency] = useState<number | null>(null);
  const [failures, setFailures] = useState(0);
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsSeenAt, setAlertsSeenAt] = useState(0);
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');

  const settingsRef = useRef(settings);
  const prevReading = useRef<Reading | null>(null);
  const memory = useRef<AlertMemory>({ raining: false });
  const failuresRef = useRef(0);
  const connectedRef = useRef(false); // currently receiving data
  const everConnected = useRef(false);
  const lastSuccessRef = useRef<number | null>(null);
  const needBackfill = useRef(true);
  const kick = useRef<(() => Promise<void>) | null>(null);

  // ---- persistence -------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [s, a, seen] = await Promise.all([AsyncStorage.getItem(SETTINGS_KEY), AsyncStorage.getItem(ALERTS_KEY), AsyncStorage.getItem(SEEN_KEY)]);
        if (s) {
          const parsed = JSON.parse(s);
          const next = { ...DEFAULT_SETTINGS, ...parsed, thresholds: { ...DEFAULT_SETTINGS.thresholds, ...parsed.thresholds } };
          settingsRef.current = next;
          setSettings(next);
        }
        if (a) setAlerts(JSON.parse(a));
        if (seen) setAlertsSeenAt(Number(seen) || 0);
      } catch {
        // corrupted storage — fall back to defaults
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)).catch(() => {});
  }, [alerts, loaded]);

  /** Fresh data whenever the device (or demo mode) changes. */
  const resetData = useCallback(() => {
    setHistory([]);
    setMotionEvents([]);
    setDevice(null);
    setLatency(null);
    setFailures(0);
    setLastSuccessAt(null);
    setNextRetryAt(null);
    setError(null);
    setStatus('connecting');
    prevReading.current = null;
    failuresRef.current = 0;
    connectedRef.current = false;
    everConnected.current = false;
    lastSuccessRef.current = null;
    needBackfill.current = true;
    memory.current = { raining: false };
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const prev = settingsRef.current;
      const next = { ...prev, ...patch, host: patch.host !== undefined ? cleanHost(patch.host) : prev.host };
      if (next.host !== prev.host || next.port !== prev.port || next.demo !== prev.demo) resetData();
      settingsRef.current = next;
      setSettings(next);
    },
    [resetData],
  );

  // ---- alerts ------------------------------------------------------------
  const pushAlerts = useCallback((items: NewAlert[]) => {
    if (!items.length) return;
    const now = Date.now();
    const made = items.map((a, i) => ({ ...a, id: `${now}-${i}-${Math.random().toString(36).slice(2, 7)}`, t: now }));
    setAlerts((list) => [...made.reverse(), ...list].slice(0, MAX_ALERTS));
    if (items.some((a) => a.sev === 'danger') && settingsRef.current.vibrateOnDanger) {
      Vibration.vibrate(800); // "Long pulse when a Danger alert fires"
    }
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);
  const markAlertsSeen = useCallback(() => {
    const now = Date.now();
    setAlertsSeenAt(now);
    AsyncStorage.setItem(SEEN_KEY, String(now)).catch(() => {});
  }, []);

  // ---- data intake --------------------------------------------------------
  const ingest = useCallback(
    (reading: Reading, dev: DeviceInfo) => {
      const prev = prevReading.current;
      prevReading.current = reading;
      setHistory((h) => {
        const cutoff = reading.t - HISTORY_WINDOW_MS;
        const start = h.findIndex((x) => x.t >= cutoff);
        return [...(start <= 0 ? h : h.slice(start)), reading];
      });
      setDevice(dev);
      setError(null);

      // Motion episodes from the live PIR edges.
      const wasDetected = prev?.motion.detected ?? false;
      if (reading.motion.detected && !wasDetected) {
        setMotionEvents((ev) => mergeEvents(ev, [{ start: reading.t, end: null }], reading.t));
      } else if (!reading.motion.detected && wasDetected) {
        setMotionEvents((ev) => {
          let i = ev.length - 1;
          while (i >= 0 && ev[i].end !== null) i--;
          if (i === -1) return ev;
          const copy = [...ev];
          copy[i] = { ...copy[i], end: reading.t };
          return copy;
        });
      }

      if (prev) pushAlerts(evaluateAlerts(prev, reading, settingsRef.current.thresholds, memory.current));
    },
    [pushAlerts],
  );

  const backfill = useCallback((payload: HistoryPayload) => {
    const now = Date.now();
    setHistory((h) => {
      const first = h.length ? h[0].t - 1000 : Infinity;
      return [...payload.readings.filter((r) => r.t < first && r.t >= now - HISTORY_WINDOW_MS), ...h];
    });
    setMotionEvents((ev) => mergeEvents(ev, payload.events, now));
  }, []);

  // ---- polling loop ------------------------------------------------------
  const { host, port, intervalMs, demo } = settings;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s !== 'background'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!loaded || !appActive) return;
    if (!demo && !host) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (demo) {
      const source = createDemoSource();
      const tick = () => {
        if (needBackfill.current) {
          needBackfill.current = false;
          const past = source.history();
          backfill(past);
          prevReading.current = past.readings[past.readings.length - 1] ?? null;
        }
        const { reading, device: dev } = source.read();
        ingest(reading, dev);
        setLatency(null);
        setLastSuccessAt(reading.t);
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      };
      timer = setTimeout(tick, 0);
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }

    let inflight: Promise<void> | null = null;
    const poll = async () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      setNextRetryAt(null);
      try {
        const res = await fetchReading(host, port, Math.max(3000, Math.min(intervalMs * 2, 6000)));
        if (cancelled) return;
        const wasOffline = failuresRef.current >= OFFLINE_AFTER && everConnected.current;
        if (needBackfill.current) {
          needBackfill.current = false;
          const past = await fetchHistory(host, port);
          if (cancelled) return;
          if (past) backfill(past);
        }
        ingest(res.reading, res.device);
        if (wasOffline) {
          pushAlerts([{ sev: 'info', icon: 'wifi', sensor: 'system', title: 'ESP32 reconnected', sub: `${host}${res.device.rssi !== null ? ` · ${res.device.rssi} dBm` : ''}` }]);
        }
        failuresRef.current = 0;
        connectedRef.current = true;
        everConnected.current = true;
        lastSuccessRef.current = res.reading.t;
        setLatency(res.latencyMs);
        setFailures(0);
        setLastSuccessAt(res.reading.t);
        setStatus('live');
      } catch (e: any) {
        if (cancelled) return;
        failuresRef.current += 1;
        setFailures(failuresRef.current);
        setError(e?.message ?? 'Connection failed');
        if (failuresRef.current >= OFFLINE_AFTER) {
          if (connectedRef.current) {
            const secs = lastSuccessRef.current ? Math.round((Date.now() - lastSuccessRef.current) / 1000) : 0;
            pushAlerts([{ sev: 'warning', icon: 'wifi_off', sensor: 'system', title: 'ESP32 disconnected', sub: `No response for ${secs} s` }]);
          }
          connectedRef.current = false;
          setStatus('offline');
        } else {
          setStatus(everConnected.current ? 'reconnecting' : 'connecting');
        }
      }
      if (cancelled) return;
      const delay = failuresRef.current >= OFFLINE_AFTER ? OFFLINE_RETRY_MS : intervalMs;
      setNextRetryAt(Date.now() + delay);
      timer = setTimeout(tick, delay);
    };
    // One request at a time: a manual refresh during a poll just waits for that poll.
    const tick = () => {
      if (!inflight) inflight = poll().finally(() => (inflight = null));
      return inflight;
    };

    kick.current = tick;
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      kick.current = null;
      if (timer) clearTimeout(timer);
    };
  }, [loaded, appActive, host, port, intervalMs, demo, ingest, backfill, pushAlerts]);

  /** Poll right now (pull-to-refresh, "Retry now"). Resolves true when the ESP32 answered. */
  const refresh = useCallback(async () => {
    const s = settingsRef.current;
    if (s.demo) return true;
    if (!s.host) return false;
    const before = lastSuccessRef.current;
    if (kick.current) await kick.current();
    return lastSuccessRef.current !== before;
  }, []);

  const testConnection = useCallback(async (h: string, p: number) => {
    const { device: dev, latencyMs: ms, reading } = await fetchReading(h, p, 4000);
    return { device: dev, latencyMs: ms, reading };
  }, []);

  const status: ConnectionStatus = settings.demo ? 'demo' : !settings.host ? 'idle' : rawStatus;
  const unseenAlerts = useMemo(() => alerts.filter((a) => a.t > alertsSeenAt && a.sev !== 'info').length, [alerts, alertsSeenAt]);

  const value = useMemo<SensorContextValue>(
    () => ({
      loaded,
      settings,
      updateSettings,
      status,
      error,
      latest: history.length ? history[history.length - 1] : null,
      device,
      latencyMs,
      failures,
      nextRetryAt,
      lastSuccessAt,
      history,
      motionEvents,
      alerts,
      unseenAlerts,
      markAlertsSeen,
      clearAlerts,
      refresh,
      testConnection,
    }),
    [loaded, settings, updateSettings, status, error, history, device, latencyMs, failures, nextRetryAt, lastSuccessAt, motionEvents, alerts, unseenAlerts, markAlertsSeen, clearAlerts, refresh, testConnection],
  );

  return <SensorContext.Provider value={value}>{children}</SensorContext.Provider>;
}
