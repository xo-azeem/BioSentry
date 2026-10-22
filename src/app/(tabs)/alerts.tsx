import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { T } from '@/components/Text';
import { Overline, sepStyle } from '@/components/ui';
import { dayLabel, hm } from '@/lib/format';
import { useSensors } from '@/lib/store';
import { mix, radius, useTheme } from '@/lib/theme';
import type { AlertItem, Severity } from '@/lib/types';
import { useNow } from '@/lib/useNow';

type Filter = 'All' | 'Danger' | 'Warning' | 'Info';
const FILTERS: Filter[] = ['All', 'Danger', 'Warning', 'Info'];
const SEV: Record<Severity, [string, IconName]> = { danger: ['Danger', 'error'], warning: ['Warning', 'warning'], info: ['Info', 'info'] };

export default function Alerts() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { alerts, clearAlerts, markAlertsSeen } = useSensors();
  const [filter, setFilter] = useState<Filter>('All');
  const now = useNow(30_000);

  // Opening the tab (and leaving it) clears the badge.
  useFocusEffect(
    useCallback(() => {
      markAlertsSeen();
      return markAlertsSeen;
    }, [markAlertsSeen]),
  );

  const matches = (a: AlertItem, f: Filter) => f === 'All' || a.sev === f.toLowerCase();
  const shown = alerts.filter((a) => matches(a, filter));
  const groups: { label: string; items: AlertItem[] }[] = [];
  for (const a of shown) {
    const label = dayLabel(a.t, now);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(a);
    else groups.push({ label, items: [a] });
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ paddingTop: 8, paddingRight: 8, paddingBottom: 4, paddingLeft: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T size={26} lh={32} w={700} ls={-0.02}>
          Alerts
        </T>
        <Pressable
          onPress={clearAlerts}
          disabled={!alerts.length}
          accessibilityRole="button"
          accessibilityLabel="Clear all alerts"
          style={({ pressed }) => ({ height: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: !alerts.length ? 0.45 : pressed ? 0.7 : 1 })}
        >
          <Icon name="delete_sweep" size={20} color={c.primary} />
          <T size={14} lh={18} w={600} color={c.primary}>
            Clear all
          </T>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 12 }}>
        {FILTERS.map((f) => {
          const on = filter === f;
          const count = alerts.filter((a) => matches(a, f)).length;
          return (
            <Pressable
              key={`${f}-${on}`} // remount on selection so Android keeps the pill's corner radius
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                height: 36,
                paddingHorizontal: 14,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: on ? 'transparent' : c.border,
                backgroundColor: on ? c.primaryC : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <T size={13} lh={17} w={600} color={on ? c.onPrimaryC : c.text2}>
                {f}
              </T>
              <T size={13} lh={17} w={600} color={on ? c.onPrimaryC : c.text2} tnum style={{ opacity: 0.7 }}>
                {count}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 10, flexGrow: 1 }}>
        {shown.length === 0 && (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 80, paddingHorizontal: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="notifications_off" size={32} color={c.text3} />
            </View>
            <T size={17} lh={22} w={700} style={{ marginTop: 8 }}>
              No alerts
            </T>
            <T size={14} lh={20} color={c.text2} style={{ textAlign: 'center' }}>
              New events from your sensors will appear here.
            </T>
          </View>
        )}
        {groups.map((g) => (
          <View key={g.label} style={{ gap: 10 }}>
            <Overline style={{ paddingTop: 6 }}>{g.label}</Overline>
            <View style={{ borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
              {g.items.map((a, i) => (
                <AlertRow key={a.id} a={a} style={sepStyle(i, g.items.length, c.border)} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function AlertRow({ a, style }: { a: AlertItem; style: object }) {
  const { c } = useTheme();
  const dz = a.sev === 'danger';
  const [sevLabel, sevIcon] = SEV[a.sev];
  return (
    <View style={[{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, backgroundColor: dz ? mix(c.danger, 7) : 'transparent' }, style]}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: dz ? c.danger : mix(c[a.sev], 15), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={a.icon} size={21} color={dz ? c.onDanger : c[a.sev]} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <T size={14} lh={19} w={600}>
          {a.title}
        </T>
        <T size={12} lh={16} color={c.text2} tnum>
          {a.sub}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <Icon name={sevIcon} size={14} color={c[a.sev]} fill />
          <T size={11} lh={14} w={700} color={c[a.sev]}>
            {sevLabel}
          </T>
        </View>
      </View>
      <T size={12} lh={16} color={c.text3} tnum style={{ paddingTop: 2 }}>
        {hm(a.t)}
      </T>
    </View>
  );
}
