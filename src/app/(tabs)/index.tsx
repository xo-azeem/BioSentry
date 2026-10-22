import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner, ConnectionPill, SensorCardGrid, SensorCardList, SkeletonCard, type PillModel } from '@/components/dashboard';
import { Icon } from '@/components/Icon';
import { T } from '@/components/Text';
import { Button, Group, sepStyle, Skeleton } from '@/components/ui';
import { buildBanner, buildCard } from '@/lib/cards';
import { agoStr, dbm, uptimeShort } from '@/lib/format';
import { OFFLINE_AFTER, useSensors } from '@/lib/store';
import { mix, useTheme } from '@/lib/theme';
import type { SensorId } from '@/lib/types';
import { useNow } from '@/lib/useNow';

const IDS: SensorId[] = ['rain', 'tds', 'gas', 'motion'];

const TIPS = [
  ['ESP32 powered on?', 'The blue LED on the board should be lit.'],
  ['Same Wi-Fi network', 'Your phone must not be on mobile data or a guest network.'],
  ['IP address changed?', "Check your router's device list or the serial monitor."],
  ['Setup hotspot', 'Join BioSentry-Setup Wi-Fi and use 192.168.4.1.'],
];

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const s = useSensors();
  const { settings, status, latest, history, motionEvents, failures, nextRetryAt, lastSuccessAt, device, refresh, updateSettings } = s;
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow(1000);

  // "Keep screen awake — while the dashboard is open"
  useFocusEffect(
    useCallback(() => {
      if (!settings.keepAwake) return;
      activateKeepAwakeAsync('dashboard').catch(() => {});
      return () => {
        deactivateKeepAwake('dashboard').catch(() => {});
      };
    }, [settings.keepAwake]),
  );

  const offline = status === 'offline' && !!latest;
  const unreachable = status === 'offline' && !latest;
  const loading = !latest && !unreachable;

  const cards = useMemo(
    () => (latest ? IDS.map((id) => buildCard(id, { latest, history, events: motionEvents, th: settings.thresholds, now, offline, lastSuccessAt })) : []),
    [latest, history, motionEvents, settings.thresholds, now, offline, lastSuccessAt],
  );
  const banner = latest ? buildBanner(cards, latest, { offline, lastSuccessAt }) : null;

  let pill: PillModel;
  if (settings.demo) pill = { label: 'Demo', tone: 'info', icon: 'science' };
  else if (unreachable || status === 'reconnecting') pill = { label: 'Reconnecting…', tone: 'warning', icon: 'sync', spin: true };
  else if (offline) pill = { label: 'Offline', tone: 'offline', icon: 'cloud_off' };
  else if (status === 'connecting' || !latest) pill = { label: 'Connecting…', tone: 'warning', icon: 'progress_activity', spin: true };
  else pill = { label: `Live • ${settings.host}`, tone: 'safe', live: true };

  const secs = latest ? Math.max(0, Math.floor((now - latest.t) / 1000)) : 0;
  const agoText = offline
    ? `Last data ${agoStr(lastSuccessAt ?? latest!.t, now)}`
    : unreachable
      ? 'No data'
      : loading
        ? 'Waiting…'
        : secs === 0
          ? 'Updated just now'
          : `Updated ${secs}s ago`;

  const deviceLine = settings.demo
    ? `Demo mode · simulated ESP32 data`
    : offline || unreachable || !device
      ? 'ESP32 · not responding'
      : `ESP32 · firmware ${device.firmware}${device.rssi !== null ? ` · ${dbm(device.rssi)}` : ''} · ${uptimeShort(device.uptimeSec)}`;

  const doRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const open = (id: SensorId) => router.push({ pathname: '/sensor/[id]', params: { id } });
  const retryIn = nextRetryAt ? Math.max(1, Math.ceil((nextRetryAt - now) / 1000)) : 10;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* Top bar */}
      <View style={{ paddingTop: 8, paddingRight: 14, paddingBottom: 12, paddingLeft: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <T size={22} lh={28} w={700} ls={-0.02}>
            BioSentry
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ConnectionPill pill={pill} />
            <T size={12} lh={16} w={500} color={c.text3} tnum>
              {agoText}
            </T>
          </View>
        </View>
        <Pressable
          onPress={doRefresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: pressed ? c.elev : c.surface,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Icon name={refreshing ? 'progress_activity' : 'refresh'} size={22} color={c.text2} spin={refreshing} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={doRefresh} colors={[c.primary]} tintColor={c.primary} progressBackgroundColor={c.elev} />
        }
      >
        {loading && (
          <>
            <Skeleton style={{ height: 72, borderRadius: 16 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 4 }}>
              <Icon name="progress_activity" size={18} color={c.text3} spin />
              <T size={13} color={c.text3} tnum>
                {failures > 0 ? `Attempt ${failures + 1} of ${OFFLINE_AFTER} · ${settings.host}` : `Waiting for the first reading from ${settings.host}`}
              </T>
            </View>
          </>
        )}

        {unreachable && (
          <>
            <View style={{ alignItems: 'center', gap: 10, paddingTop: 28, paddingHorizontal: 8, paddingBottom: 8 }}>
              <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: mix(c.offline, 16), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="wifi_off" size={38} color={c.offline} />
              </View>
              <T size={22} lh={28} w={700} ls={-0.01} style={{ marginTop: 6, textAlign: 'center' }}>
                {"Can't reach your ESP32"}
              </T>
              <T size={14} lh={20} color={c.text2} tnum style={{ textAlign: 'center' }}>
                {`${settings.host}:${settings.port} didn't respond after ${failures} attempts. Retrying in ${retryIn} s.`}
              </T>
            </View>
            <Group style={{ paddingVertical: 6, paddingHorizontal: 16 }}>
              {TIPS.map(([title, body], i) => (
                <View key={title} style={[{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12 }, sepStyle(i, TIPS.length, c.border)]}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.elev, alignItems: 'center', justifyContent: 'center' }}>
                    <T size={12} lh={14} w={700} color={c.text2}>
                      {i + 1}
                    </T>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={14} lh={20} w={600}>
                      {title}
                    </T>
                    <T size={13} lh={18} color={c.text2}>
                      {body}
                    </T>
                  </View>
                </View>
              ))}
            </Group>
            <Button label={refreshing ? 'Retrying…' : 'Retry now'} icon={refreshing ? 'progress_activity' : 'refresh'} iconSpin={refreshing} onPress={doRefresh} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button kind="outline" label="Change address" style={{ flex: 1, borderRadius: 14 }} onPress={() => router.push('/connect')} />
              <Button kind="outline" label="Use Demo Mode" style={{ flex: 1, borderRadius: 14 }} onPress={() => updateSettings({ demo: true })} />
            </View>
          </>
        )}

        {latest && banner && (
          <>
            <Banner banner={banner} onPress={banner.target ? () => open(banner.target!) : undefined} />
            {settings.layout === 'list' ? (
              <View style={{ gap: 10 }}>
                {cards.map((card) => (
                  <SensorCardList key={card.id} card={card} onPress={() => open(card.id)} />
                ))}
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {[0, 2].map((row) => (
                  <View key={row} style={{ flexDirection: 'row', gap: 12 }}>
                    {cards.slice(row, row + 2).map((card) => (
                      <SensorCardGrid key={card.id} card={card} onPress={() => open(card.id)} />
                    ))}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {!loading && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, paddingHorizontal: 4 }}>
            <Icon name="memory" size={16} color={c.text3} />
            <T size={12} lh={16} color={c.text3} tnum style={{ flex: 1 }}>
              {deviceLine}
            </T>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
