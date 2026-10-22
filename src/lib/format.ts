const p2 = (n: number) => String(n).padStart(2, '0');

/** 14:02 */
export const hm = (t: number) => {
  const d = new Date(t);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

/** 14:02:30 */
export const hms = (t: number) => `${hm(t)}:${p2(new Date(t).getSeconds())}`;

/** "12 s ago" · "4 min ago" · "2 h ago" (design `agoStr`). */
export function agoStr(t: number, now = Date.now()): string {
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return `${Math.max(1, Math.round(s))} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** 3 d 4 h 12 m */
export function uptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d} d ${h} h ${m} m`;
  if (h) return `${h} h ${m} m`;
  return `${m} m ${Math.floor(sec % 60)} s`;
}

/** Short uptime for the dashboard footer: "up 3 d 4 h". */
export function uptimeShort(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `up ${d} d ${h} h`;
  if (h) return `up ${h} h ${m} m`;
  return `up ${m} m`;
}

/** Typographic minus, as in the design: −58 dBm */
export const dbm = (rssi: number) => `${rssi < 0 ? '−' : ''}${Math.abs(rssi)} dBm`;

export function signalQuality(rssi: number): string {
  if (rssi >= -55) return 'Excellent';
  if (rssi >= -67) return 'Good';
  if (rssi >= -75) return 'Fair';
  return 'Weak';
}

/** Alert group headers: Today · Yesterday · Mon 21 Oct */
export function dayLabel(t: number, now = Date.now()): string {
  const day = (x: number) => {
    const d = new Date(x);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diff = Math.round((day(now) - day(t)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const d = new Date(t);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${wd} ${d.getDate()} ${mo}`;
}

export const startOfToday = (now = Date.now()) => {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
