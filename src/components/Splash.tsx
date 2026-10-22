import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/lib/theme';

import { Icon } from './Icon';
import { T } from './Text';
import { LogoTile } from './ui';

/** Launch screen from the design: brand gradient, logo tile, name, and a "looking for" status line. */
export function Splash({ message }: { message: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
        <Defs>
          <LinearGradient id="brand" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.brandTop} />
            <Stop offset="1" stopColor={c.brandBottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#brand)" />
      </Svg>
      <LogoTile size={104} r={32} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <T size={34} lh={40} w={700} ls={-0.03} color={c.brandText}>
          BioSentry
        </T>
        <T size={14} lh={20} w={500} ls={0.02} color={c.brandSub}>
          Biofilter monitoring
        </T>
      </View>
      <View style={{ position: 'absolute', bottom: 48 + insets.bottom, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="progress_activity" size={18} color={c.brandSub} spin />
        <T size={13} w={500} color={c.brandSub}>
          {message}
        </T>
      </View>
    </View>
  );
}
