import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { FONT, T } from '@/components/Text';
import { Button, LogoTile } from '@/components/ui';
import { cleanHost, isValidHost, isValidPort } from '@/lib/api';
import { dbm } from '@/lib/format';
import { useSensors } from '@/lib/store';
import { mix, useTheme } from '@/lib/theme';
import type { DeviceInfo, Reading } from '@/lib/types';

type State = { kind: 'idle' } | { kind: 'invalid' } | { kind: 'testing' } | { kind: 'success'; device: DeviceInfo; reading: Reading } | { kind: 'failed' };

export default function Connect() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { settings, updateSettings, testConnection } = useSensors();
  const [ip, setIp] = useState(settings.host || '192.168.1.50');
  const [port, setPort] = useState(String(settings.port || 80));
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [focus, setFocus] = useState<'ip' | 'port' | null>(null);

  const target = `${cleanHost(ip)}:${port}`;

  const leave = () => (router.canGoBack() ? router.dismissTo('/') : router.replace('/'));

  const onPrimary = async () => {
    if (state.kind === 'success') {
      updateSettings({ host: ip, port: Number(port), demo: false });
      leave();
      return;
    }
    if (state.kind === 'testing') return;
    if (!isValidHost(ip) || !isValidPort(port)) {
      setState({ kind: 'invalid' });
      return;
    }
    setState({ kind: 'testing' });
    try {
      const r = await testConnection(ip, Number(port));
      setState({ kind: 'success', device: r.device, reading: r.reading });
    } catch {
      setState({ kind: 'failed' });
    }
  };

  const onDemo = () => {
    updateSettings({ demo: true });
    leave();
  };

  const ipBorder = state.kind === 'failed' || state.kind === 'invalid' ? c.danger : state.kind === 'success' ? c.safe : focus === 'ip' ? c.primary : c.border;
  const ipIcon = state.kind === 'invalid' ? c.danger : focus === 'ip' ? c.primary : c.text3;
  const portBorder = state.kind === 'invalid' && !isValidPort(port) ? c.danger : focus === 'port' ? c.primary : c.border;
  const btn =
    state.kind === 'success'
      ? { label: 'Open dashboard', icon: 'arrow_forward' as const }
      : state.kind === 'testing'
        ? { label: 'Testing…', icon: 'network_check' as const }
        : { label: 'Test connection', icon: 'network_check' as const };

  const sensorsFound = (r: Reading) => 1 + (['rain', 'tds', 'gas'] as const).filter((k) => r[k].ok).length;
  const inputText = { flex: 1, minWidth: 0, color: c.text, fontFamily: FONT[600], fontSize: 17, fontVariant: ['tabular-nums' as const], padding: 0 };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 24 + insets.bottom, gap: 20 }}
      >
        <View style={{ gap: 14, paddingTop: 12 }}>
          <LogoTile size={52} r={16} />
          <T size={28} lh={34} w={700} ls={-0.02}>
            Connect to your BioSentry
          </T>
          <T size={15} lh={22} color={c.text2}>
            Connect your phone to the same Wi-Fi as your ESP32, then enter its IP address.
          </T>
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <T size={13} lh={17} w={600} color={c.text2}>
                IP address
              </T>
              <View style={{ height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: ipBorder, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
                <Icon name="router" size={20} color={ipIcon} />
                <TextInput
                  value={ip}
                  onChangeText={(t) => {
                    setIp(t);
                    setState({ kind: 'idle' });
                  }}
                  onFocus={() => setFocus('ip')}
                  onBlur={() => setFocus(null)}
                  placeholder="192.168.1.50"
                  placeholderTextColor={c.text3}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={onPrimary}
                  selectionColor={c.primary}
                  cursorColor={c.primary}
                  accessibilityLabel="IP address"
                  style={inputText}
                />
              </View>
            </View>
            <View style={{ width: 96, gap: 6 }}>
              <T size={13} lh={17} w={600} color={c.text2}>
                Port
              </T>
              <View style={{ height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: portBorder, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
                <TextInput
                  value={port}
                  onChangeText={(t) => {
                    setPort(t.replace(/[^\d]/g, ''));
                    setState({ kind: 'idle' });
                  }}
                  onFocus={() => setFocus('port')}
                  onBlur={() => setFocus(null)}
                  keyboardType="number-pad"
                  maxLength={5}
                  selectionColor={c.primary}
                  cursorColor={c.primary}
                  accessibilityLabel="Port"
                  style={inputText}
                />
              </View>
            </View>
          </View>
          {state.kind === 'invalid' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="error" size={15} color={c.danger} fill />
              <T size={12} lh={16} color={c.danger}>
                {isValidHost(ip) ? 'Enter a port between 1 and 65535' : 'Enter a full address, e.g. 192.168.1.50'}
              </T>
            </View>
          ) : (
            <T size={12} lh={16} color={c.text3}>
              Printed in the ESP32 serial monitor when it boots.
            </T>
          )}
        </View>

        {state.kind === 'testing' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <Icon name="progress_activity" size={22} color={c.primary} spin />
            <View style={{ gap: 2 }}>
              <T size={15} lh={20} w={600}>
                Testing connection…
              </T>
              <T size={13} lh={18} color={c.text2} tnum>
                {`Contacting ${target}`}
              </T>
            </View>
          </View>
        )}

        {state.kind === 'success' && (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: mix(c.safe, 12, c.surface), borderWidth: 1, borderColor: mix(c.safe, 35) }}>
            <Icon name="check_circle" size={22} color={c.safe} fill />
            <View style={{ flex: 1, gap: 4 }}>
              <T size={15} lh={20} w={700}>
                Connected to BioSentry ESP32
              </T>
              <T size={13} lh={18} color={c.text2} tnum>
                {`Firmware ${state.device.firmware}${state.device.rssi !== null ? ` · Wi-Fi ${dbm(state.device.rssi)}` : ''} · ${sensorsFound(state.reading)} sensors found`}
              </T>
            </View>
          </View>
        )}

        {state.kind === 'failed' && (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: mix(c.danger, 12, c.surface), borderWidth: 1, borderColor: mix(c.danger, 40) }}>
            <Icon name="error" size={22} color={c.danger} fill />
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <T size={15} lh={20} w={700} tnum>
                {`Couldn't reach ${target}`}
              </T>
              <T size={13} lh={18} color={c.text2}>
                {"Turn off mobile data and check both devices are on the same Wi-Fi. The IP may have changed — look it up in your router's device list."}
              </T>
            </View>
          </View>
        )}

        <View style={{ gap: 10 }}>
          <Button label={btn.label} icon={btn.icon} onPress={onPrimary} />
          <Button kind="secondary" label="Try Demo Mode" icon="science" onPress={onDemo} />
          <T size={12} lh={16} color={c.text3} style={{ textAlign: 'center' }}>
            Simulated data, no hardware needed
          </T>
        </View>

        <View
          style={{
            marginTop: 'auto',
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
            paddingVertical: 12,
            paddingRight: 12,
            paddingLeft: 16,
            borderRadius: 16,
            backgroundColor: mix(c.info, 10, c.surface),
            borderWidth: 1,
            borderColor: mix(c.info, 25),
          }}
        >
          <Icon name="wifi_tethering" size={22} color={c.info} />
          <T size={13} lh={18} style={{ flex: 1 }}>
            Joined the{' '}
            <T size={13} lh={18} w={700}>
              BioSentry-Setup
            </T>{' '}
            Wi-Fi? Use{' '}
            <T size={13} lh={18} w={700} tnum>
              192.168.4.1
            </T>
          </T>
          <Pressable
            onPress={() => {
              setIp('192.168.4.1');
              setPort('80');
              setState({ kind: 'idle' });
            }}
            accessibilityRole="button"
            accessibilityLabel="Use 192.168.4.1"
            style={({ pressed }) => ({ height: 48, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: pressed ? mix(c.info, 12) : 'transparent' })}
          >
            <T size={14} lh={18} w={700} color={c.info}>
              Use
            </T>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
