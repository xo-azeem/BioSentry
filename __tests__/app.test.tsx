import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { DEFAULT_SETTINGS } from '@/lib/store';

jest.setTimeout(30_000);

/** A fake ESP32 on the other end of fetch(). Tests change `esp` to drive scenarios. */
const esp = {
  up: true,
  gas: 18,
  rain: 8,
  tdsOk: true,
  motion: false,
  requests: [] as string[],
};

function sensorsJson() {
  return {
    device: 'BioSentry-ESP32',
    fw: '1.1.0',
    board: 'ESP32-D0WD-V3',
    uptime: 3 * 86400 + 4 * 3600 + 12 * 60,
    rssi: -58,
    ip: '192.168.1.50',
    rain: { raw: Math.round(4095 - (esp.rain / 100) * 4095), percent: esp.rain, raining: esp.rain > 60, ok: true },
    tds: { raw: 812, voltage: 0.65, ppm: 214, temp: 22.4, ok: esp.tdsOk },
    gas: { raw: Math.round((esp.gas / 100) * 4095), percent: esp.gas, alarm: false, ok: true },
    motion: { detected: esp.motion, count: 7, lastSeconds: 30 },
  };
}

beforeEach(async () => {
  Object.assign(esp, { up: true, gas: 18, rain: 8, tdsOk: true, motion: false, requests: [] });
  await AsyncStorage.clear();
  globalThis.fetch = jest.fn(async (url: string) => {
    esp.requests.push(String(url));
    if (!esp.up) throw new Error('Network request failed');
    const body = String(url).endsWith('/api/history')
      ? { step: 5, age: 1, rain: [8, 9, 8], tds: [210, 212, 214], gas: [17, 18, 18], motion: [0, 0, 0], events: [[600, 6]] }
      : sensorsJson();
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
});

async function saveSettings(patch: Partial<typeof DEFAULT_SETTINGS>) {
  await AsyncStorage.setItem('biosentry.settings.v2', JSON.stringify({ ...DEFAULT_SETTINGS, host: '192.168.1.50', intervalMs: 1000, ...patch }));
}

/** renderRouter() switches Jest to fake timers, so the clock is advanced explicitly in 50 ms steps. */
const tick = async (ms: number) => {
  for (let t = 0; t < ms; t += 50) {
    await act(async () => {
      jest.advanceTimersByTime(Math.min(50, ms - t));
    });
  }
  await act(async () => {});
};
async function until(check: () => void, timeout = 3000) {
  let last: unknown;
  for (let t = 0; t <= timeout; t += 50) {
    try {
      check();
      return;
    } catch (e) {
      last = e;
    }
    await tick(50);
  }
  const texts: string[] = [];
  const walk = (n: any) => {
    if (typeof n === 'string') texts.push(n);
    else n?.children?.forEach(walk);
  };
  const j = screen.toJSON();
  (Array.isArray(j) ? j : [j]).forEach(walk);
  console.log('SCREEN TEXT:', texts.filter((x) => x.trim()).join(' | '));
  throw last;
}
const find = async (m: string | RegExp, timeout?: number) => {
  await until(() => screen.getByText(m), timeout);
  return screen.getByText(m);
};
const findLabel = async (m: string | RegExp, timeout?: number) => {
  await until(() => screen.getByLabelText(m), timeout);
  return screen.getByLabelText(m);
};
/** Press, then let the clock run a little so async handlers settle. */
const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await fireEvent.press(el);
  await tick(200);
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(screen.getByLabelText(label), text);
  await tick(50);
};

describe('BioSentry app', () => {
  it('first launch: Connect validates the address, tests it and opens the live dashboard', async () => {
    await renderRouter('src/app', { initialUrl: '/' });
    expect(await find('Connect to your BioSentry')).toBeTruthy();

    // Invalid address → inline error, no request
    await type('IP address', '192.168.1');
    await press(screen.getByText('Test connection'));
    expect(await find('Enter a full address, e.g. 192.168.1.50')).toBeTruthy();
    expect(esp.requests).toHaveLength(0);

    // Hotspot shortcut fills 192.168.4.1
    await press(screen.getByLabelText('Use 192.168.4.1'));
    await until(() => expect(screen.getByLabelText('IP address').props.value).toBe('192.168.4.1'));

    // Unreachable → failed card
    esp.up = false;
    await press(screen.getByText('Test connection'));
    expect(await find("Couldn't reach 192.168.4.1:80")).toBeTruthy();

    // Reachable → success card → Open dashboard
    esp.up = true;
    await type('IP address', '192.168.1.50');
        await press(await find('Test connection'));
    expect(await find('Connected to BioSentry ESP32')).toBeTruthy();
    expect(screen.getByText('Firmware 1.1.0 · Wi-Fi −58 dBm · 4 sensors found')).toBeTruthy();
    await press(screen.getByText('Open dashboard'));

    expect(await find('All systems normal')).toBeTruthy();
    expect(screen.getByText('Live • 192.168.1.50')).toBeTruthy();
    expect(screen.getByText('214')).toBeTruthy();
    expect(screen.getByText('Water 22.4 °C')).toBeTruthy();
    expect(screen.getByText(/ESP32 · firmware 1\.1\.0 · −58 dBm · up 3 d 4 h/)).toBeTruthy();
    expect(esp.requests.some((u) => u.endsWith('/api/history'))).toBe(true);
  });

  it('gas danger: red banner, alert with vibration, detail screen with note and range picker', async () => {
    await saveSettings({});
    await renderRouter('src/app', { initialUrl: '/' });
    expect(await find('All systems normal')).toBeTruthy();

    esp.gas = 72;
    esp.rain = 78;
    expect(await find('Gas level dangerous!', 4000)).toBeTruthy();
    expect(screen.getByText(/72% at \d\d:\d\d — ventilate the area\. Also raining \(78%\)\./)).toBeTruthy();
    expect(screen.getByText('DANGER')).toBeTruthy();
    expect(screen.getByLabelText(/Alerts, \d+ new/)).toBeTruthy(); // badge on the nav bar

    await press(screen.getByText('Gas level dangerous!'));
    expect(await find('Ventilate the area and keep ignition sources away.')).toBeTruthy();
    expect(screen.getByText('Gas level · last 15 min')).toBeTruthy();
    expect(screen.getByText('Raw ADC 2948 of 4095')).toBeTruthy();
    await press(screen.getByText('1 hour'));
    expect(await find('Gas level · last 1 hour')).toBeTruthy();
    expect(screen.getByText('Elevated 35%')).toBeTruthy(); // threshold labels
    expect(screen.getByText('Danger 60%')).toBeTruthy();
    await press(screen.getByLabelText('Back'));

    // Alerts tab: grouped, filterable, clearable
    await press(await findLabel(/Alerts, \d+ new/));
    expect(await find('Gas level reached 72% — Danger')).toBeTruthy();
    expect(screen.getByText('Rain started')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    await press(screen.getByText('Info'));
    await until(() => expect(screen.queryByText('Gas level reached 72% — Danger')).toBeNull());
    await press(screen.getByText('Danger'));
    expect(await find('Gas level reached 72% — Danger')).toBeTruthy();
    await press(screen.getByLabelText('Clear all alerts'));
    expect(await find('No alerts')).toBeTruthy();
  });

  it('ESP32 unreachable on start: troubleshooting view, then demo mode', async () => {
    esp.up = false;
    await saveSettings({ intervalMs: 1000 });
    await renderRouter('src/app', { initialUrl: '/' });
    expect(await find(/Waiting for the first reading|Attempt \d of 3/)).toBeTruthy();
    expect(await find("Can't reach your ESP32", 6000)).toBeTruthy();
    expect(screen.getByText(/192\.168\.1\.50:80 didn't respond after 3 attempts\. Retrying in \d+ s\./)).toBeTruthy();
    expect(screen.getByText('Same Wi-Fi network')).toBeTruthy();
    expect(screen.getByText('Reconnecting…')).toBeTruthy();

    await press(screen.getByText('Use Demo Mode'));
    expect(await find('Demo')).toBeTruthy();
    expect(await find('Demo mode · simulated ESP32 data')).toBeTruthy();
  });

  it('goes offline after losing the ESP32 and shows last known values', async () => {
    await saveSettings({ intervalMs: 1000 });
    await renderRouter('src/app', { initialUrl: '/' });
    expect(await find('All systems normal')).toBeTruthy();
    esp.up = false;
    expect(await find('ESP32 offline', 6000)).toBeTruthy();
    expect(screen.getAllByText('Last known').length).toBe(4);
    expect(screen.getByText('Offline')).toBeTruthy();
    esp.up = true;
    await press(screen.getByLabelText('Refresh'));
    expect(await find('All systems normal', 4000)).toBeTruthy();
  });

  it('invalid TDS reading keeps the slot but drops the number', async () => {
    esp.tdsOk = false;
    await saveSettings({});
    await renderRouter('src/app', { initialUrl: '/' });
    expect(await find('1 sensor not reporting')).toBeTruthy();
    expect(screen.getByText('Invalid reading')).toBeTruthy();
    expect(screen.getByText('Check probe wiring · GPIO 34')).toBeTruthy();
  });

  it('settings: device info, test, layout, theme, toggles persist', async () => {
    await saveSettings({});
    await renderRouter('src/app', { initialUrl: '/settings' });
    expect(await find('192.168.1.50:80')).toBeTruthy();
    expect(await find('BioSentry 1.1.0')).toBeTruthy();
    expect(screen.getByText('3 d 4 h 12 m')).toBeTruthy();
    expect(screen.getByText('−58 dBm · Good')).toBeTruthy();

    await press(screen.getByText('Test'));
    expect(await find(/Reachable · \d+ ms · −58 dBm/)).toBeTruthy();

    await press(screen.getByText('List'));
    await press(screen.getByText('Light'));
    await press(screen.getByLabelText('Vibrate on danger'));
    await press(screen.getByText('5s'));
    await tick(50);
    const saved = JSON.parse((await AsyncStorage.getItem('biosentry.settings.v2'))!);
    expect(saved).toMatchObject({ layout: 'list', theme: 'light', vibrateOnDanger: false, intervalMs: 5000 });

    await press(screen.getByLabelText('Demo mode'));
    await until(() => expect(screen.getByText('Demo mode is on · values are simulated')).toBeTruthy());
  });

  it('motion detail lists events with durations', async () => {
    await saveSettings({});
    await renderRouter('src/app', { initialUrl: '/' });
    expect(await find('All systems normal')).toBeTruthy();
    esp.motion = true;
    await tick(1500);
    await press(screen.getByLabelText(/Motion Sensor, Detected/));
    expect(await find('Motion in progress')).toBeTruthy();
    expect(screen.getByText('Recent events')).toBeTruthy();
    expect(screen.getByText(/· 6 s$/)).toBeTruthy(); // event from /api/history
    expect(screen.getByText('Activity · last 15 min')).toBeTruthy();
  });
});
