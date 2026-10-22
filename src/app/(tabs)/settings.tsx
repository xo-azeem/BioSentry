import Slider from '@react-native-community/slider';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { T } from '@/components/Text';
import { Button, Group, Overline, Segmented, sepStyle, Switch } from '@/components/ui';
import { dbm, signalQuality, uptime } from '@/lib/format';
import { OFFLINE_RETRY_MS, useSensors } from '@/lib/store';
import { useTheme, type Tone } from '@/lib/theme';
import type { Settings, Thresholds } from '@/lib/types';

const INTERVALS = [
  { key: 1000, label: '1s' },
  { key: 2000, label: '2s' },
  { key: 5000, label: '5s' },
  { key: 10000, label: '10s' },
];

const THEMES: { key: Settings['theme']; label: string; icon: IconName }[] = [
  { key: 'system', label: 'System', icon: 'brightness_auto' },
  { key: 'dark', label: 'Dark', icon: 'dark_mode' },
  { key: 'light', label: 'Light', icon: 'light_mode' },
];

const LAYOUTS: { key: Settings['layout']; label: string; icon: IconName }[] = [
  { key: 'grid', label: 'Grid', icon: 'grid_view' },
  { key: 'list', label: 'List', icon: 'view_agenda' },
];

type SliderSpec = { label: string; key: keyof Thresholds; min: number; max: number; step: number; unit: string; tone: Tone };
const TH_GROUPS: { name: string; icon: IconName; sliders: SliderSpec[] }[] = [
  {
    name: 'Rain Sensor',
    icon: 'rainy',
    sliders: [
      { label: 'Damp above', key: 'rainDamp', min: 0, max: 100, step: 1, unit: '%', tone: 'info' },
      { label: 'Raining above', key: 'rainRaining', min: 0, max: 100, step: 1, unit: '%', tone: 'warning' },
    ],
  },
  {
    name: 'Biofilter Water Quality',
    icon: 'water_drop',
    sliders: [
      { label: 'Fair above', key: 'tdsFair', min: 0, max: 1000, step: 10, unit: 'ppm', tone: 'warning' },
      { label: 'Poor above', key: 'tdsPoor', min: 0, max: 1000, step: 10, unit: 'ppm', tone: 'danger' },
    ],
  },
  {
    name: 'Gas / Smoke Sensor',
    icon: 'detector_smoke',
    sliders: [
      { label: 'Elevated above', key: 'gasElevated', min: 0, max: 100, step: 1, unit: '%', tone: 'warning' },
      { label: 'Danger above', key: 'gasDanger', min: 0, max: 100, step: 1, unit: '%', tone: 'danger' },
    ],
  },
];

type TestState = { kind: 'idle' } | { kind: 'testing' } | { kind: 'ok'; ms: number; rssi: number | null; key: string } | { kind: 'fail'; msg: string; key: string };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { settings, updateSettings, device, status, latencyMs, testConnection } = useSensors();
  const [testState, setTest] = useState<TestState>({ kind: 'idle' });
  // A manual test result is shown until the connection state or address changes again.
  const key = `${status}|${settings.host}|${settings.port}`;
  const test: TestState = testState.kind === 'idle' || testState.kind === 'testing' || testState.key === key ? testState : { kind: 'idle' };

  const runTest = async () => {
    if (!settings.host || test.kind === 'testing') return;
    setTest({ kind: 'testing' });
    try {
      const r = await testConnection(settings.host, settings.port);
      setTest({ kind: 'ok', ms: r.latencyMs, rssi: r.device.rssi, key });
    } catch (e: any) {
      setTest({ kind: 'fail', msg: e?.message ?? 'No response', key });
    }
  };

  // Status line under the address
  let line: { icon: IconName; tone: Tone; text: string; spin?: boolean };
  const rssi = (r: number | null) => (r !== null ? ` · ${dbm(r)}` : '');
  if (test.kind === 'testing') line = { icon: 'progress_activity', tone: 'primary', text: 'Testing…', spin: true };
  else if (test.kind === 'ok') line = { icon: 'check_circle', tone: 'safe', text: `Reachable · ${test.ms} ms${rssi(test.rssi)}` };
  else if (test.kind === 'fail') line = { icon: 'error', tone: 'danger', text: `Not reachable · ${test.msg}` };
  else if (settings.demo) line = { icon: 'science', tone: 'info', text: 'Demo mode is on · values are simulated' };
  else if (!settings.host) line = { icon: 'cloud_off', tone: 'offline', text: 'No address saved' };
  else if (status === 'live') line = { icon: 'check_circle', tone: 'safe', text: `Reachable${latencyMs !== null ? ` · ${latencyMs} ms` : ''}${rssi(device?.rssi ?? null)}` };
  else if (status === 'offline') line = { icon: 'error', tone: 'danger', text: `Not responding · retrying every ${OFFLINE_RETRY_MS / 1000} s` };
  else if (status === 'reconnecting') line = { icon: 'sync', tone: 'warning', text: 'Reconnecting…', spin: true };
  else line = { icon: 'progress_activity', tone: 'primary', text: 'Connecting…', spin: true };

  const toggles: { key: 'demo' | 'vibrateOnDanger' | 'keepAwake'; icon: IconName; label: string; sub: string }[] = [
    { key: 'demo', icon: 'science', label: 'Demo mode', sub: 'Use simulated sensor data' },
    { key: 'vibrateOnDanger', icon: 'vibration', label: 'Vibrate on danger', sub: 'Long pulse when a Danger alert fires' },
    { key: 'keepAwake', icon: 'screen_lock_portrait', label: 'Keep screen awake', sub: 'While the dashboard is open' },
  ];

  const connected = !!device && (status === 'live' || status === 'demo');
  const version = `${Constants.expoConfig?.version ?? '1.0.0'} (${Constants.expoConfig?.android?.versionCode ?? 1})`;
  const aboutRows = [
    { label: 'App version', value: version },
    { label: 'Firmware', value: connected ? `BioSentry ${device!.firmware}` : '—' },
    { label: 'Board', value: connected ? device!.board : '—' },
    { label: 'Uptime', value: connected ? uptime(device!.uptimeSec) : '—' },
    { label: 'Wi-Fi signal', value: connected && device!.rssi !== null ? `${dbm(device!.rssi)} · ${signalQuality(device!.rssi)}` : '—' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <T size={26} lh={32} w={700} ls={-0.02} style={{ paddingVertical: 8 }}>
          Settings
        </T>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}>
        <Overline style={{ paddingTop: 4 }}>ESP32 connection</Overline>
        <Group style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primaryC, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="router" size={22} color={c.onPrimaryC} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={12} lh={16} color={c.text2}>
                Address
              </T>
              <T size={18} lh={24} w={700} tnum>
                {settings.host ? `${settings.host}:${settings.port}` : 'Not set'}
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={line.icon} size={16} color={c[line.tone]} fill spin={line.spin} />
            <T size={13} lh={18} color={c.text2} tnum style={{ flex: 1 }} numberOfLines={2}>
              {line.text}
            </T>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button kind="outline" label="Edit" icon="edit" style={{ flex: 1 }} onPress={() => router.push('/connect')} />
            <Button kind="tonal" label="Test" icon="network_check" style={{ flex: 1 }} onPress={runTest} disabled={!settings.host} />
          </View>
        </Group>

        <Overline>Data</Overline>
        <Group style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <T size={15} lh={20} w={600}>
              Refresh interval
            </T>
            <T size={12} lh={16} color={c.text3}>
              How often to poll the ESP32
            </T>
          </View>
          <Segmented variant="inset" items={INTERVALS} value={settings.intervalMs} onChange={(intervalMs) => updateSettings({ intervalMs })} />
        </Group>

        <Overline>Alert thresholds</Overline>
        <Group style={{ paddingVertical: 4, paddingHorizontal: 16 }}>
          {TH_GROUPS.map((g, gi) => (
            <View key={g.name} style={[{ paddingTop: 12, paddingBottom: 6, gap: 4 }, sepStyle(gi, TH_GROUPS.length, c.border)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
                <Icon name={g.icon} size={18} color={c.primary} />
                <T size={14} lh={19} w={700}>
                  {g.name}
                </T>
              </View>
              {g.sliders.map((s) => (
                <ThresholdSlider key={s.key} spec={s} value={settings.thresholds[s.key]} onCommit={(v) => updateSettings({ thresholds: { ...settings.thresholds, [s.key]: v } })} />
              ))}
            </View>
          ))}
        </Group>

        <Overline>Behaviour</Overline>
        <Group style={{ paddingHorizontal: 16 }}>
          {toggles.map((t, i) => (
            <Pressable
              key={t.key}
              onPress={() => updateSettings({ [t.key]: !settings[t.key] } as Partial<Settings>)}
              accessibilityRole="switch"
              accessibilityState={{ checked: settings[t.key] }}
              accessibilityLabel={t.label}
              style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 }, sepStyle(i, toggles.length, c.border)]}
            >
              <Icon name={t.icon} size={22} color={c.text2} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size={15} lh={20} w={600}>
                  {t.label}
                </T>
                <T size={12} lh={16} color={c.text2}>
                  {t.sub}
                </T>
              </View>
              <Switch on={settings[t.key]} />
            </Pressable>
          ))}
        </Group>

        <Overline>Appearance</Overline>
        <Group style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
          <T size={15} lh={20} w={600}>
            Theme
          </T>
          <Segmented variant="inset" items={THEMES} value={settings.theme} onChange={(theme) => updateSettings({ theme })} />
          <T size={15} lh={20} w={600} style={{ marginTop: 4 }}>
            Dashboard layout
          </T>
          <Segmented variant="inset" items={LAYOUTS} value={settings.layout} onChange={(layout) => updateSettings({ layout })} />
        </Group>

        <Overline>About</Overline>
        <Group style={{ paddingHorizontal: 16 }}>
          {aboutRows.map((a, i) => (
            <View key={a.label} style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52 }, sepStyle(i, aboutRows.length, c.border)]}>
              <T size={14} lh={19} color={c.text2}>
                {a.label}
              </T>
              <T size={14} lh={19} w={600} tnum style={{ flexShrink: 1, textAlign: 'right' }}>
                {a.value}
              </T>
            </View>
          ))}
        </Group>
      </ScrollView>
    </View>
  );
}

/** Slider row: label with status-colour square, live value, commits when the finger lifts. */
function ThresholdSlider({ spec, value, onCommit }: { spec: SliderSpec; value: number; onCommit: (v: number) => void }) {
  const { c } = useTheme();
  // While dragging show the finger's value; otherwise the saved one.
  const [drag, setDrag] = useState<number | null>(null);
  const live = drag ?? value;
  return (
    <View style={{ minHeight: 56, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c[spec.tone] }} />
          <T size={13} lh={17} color={c.text2}>
            {spec.label}
          </T>
        </View>
        <T size={15} lh={20} w={700} tnum>
          {live}
          <T size={12} lh={16} w={600} color={c.text2}>
            {' ' + spec.unit}
          </T>
        </T>
      </View>
      <Slider
        style={{ height: 28, marginHorizontal: -8 }}
        minimumValue={spec.min}
        maximumValue={spec.max}
        step={spec.step}
        value={value}
        minimumTrackTintColor={c.primary}
        maximumTrackTintColor={c.border}
        thumbTintColor={c.primary}
        onValueChange={(v) => setDrag(Math.round(v))}
        onSlidingComplete={(v) => {
          onCommit(Math.round(v));
          setDrag(null);
        }}
        accessibilityLabel={`${spec.label} ${spec.unit}`}
      />
    </View>
  );
}
