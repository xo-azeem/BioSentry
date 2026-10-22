import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSensors } from '@/lib/store';
import { useTheme } from '@/lib/theme';

import { Icon, type IconName } from './Icon';
import { T } from './Text';

const ITEMS: { route: string; label: string; icon: IconName }[] = [
  { route: 'index', label: 'Dashboard', icon: 'space_dashboard' },
  { route: 'alerts', label: 'Alerts', icon: 'notifications' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
];

/** Material 3 navigation bar from the design: 72dp, 60×32 active pill, badge on Alerts. */
export function TabBar({ state, navigateToTab }: { state: { index: number; routes: { name: string; key: string }[] }; navigateToTab: (routeKey: string) => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { unseenAlerts } = useSensors();
  const current = state.routes[state.index]?.name;

  return (
    <View style={{ backgroundColor: c.navBg, borderTopWidth: 1, borderTopColor: c.border, paddingBottom: insets.bottom }}>
      <View style={{ height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8 }}>
        {ITEMS.map((it) => {
          const on = current === it.route;
          const route = state.routes.find((r) => r.name === it.route);
          const badge = it.route === 'alerts' ? unseenAlerts : 0;
          return (
            <Pressable
              key={it.route}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={badge ? `${it.label}, ${badge} new` : it.label}
              onPress={() => {
                if (route && !on) navigateToTab(route.key);
              }}
              style={{ flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              {/* Keyed on state: Android drops the corner radius when a background goes transparent → colour. */}
              <View
                key={on ? 'on' : 'off'}
                style={{ width: 60, height: 32, borderRadius: 16, backgroundColor: on ? c.primaryC : 'transparent', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name={it.icon} size={24} color={on ? c.text : c.text2} fill={on} />
                {badge > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 12,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      borderRadius: 8,
                      backgroundColor: c.danger,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T size={10} lh={12} w={700} color={c.onDanger}>
                      {badge > 99 ? '99+' : badge}
                    </T>
                  </View>
                )}
              </View>
              <T size={12} lh={16} w={on ? 700 : 500} color={on ? c.text : c.text2}>
                {it.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
