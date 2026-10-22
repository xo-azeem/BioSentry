import { useEffect, useState } from 'react';
import { Animated, Easing, Text, type StyleProp, type TextStyle } from 'react-native';

/**
 * Material Symbols Rounded (opsz 24, wght 400) codepoints. The outlined font is a subset of these
 * glyphs; the filled font is the full static FILL=1 instance, because subsetting drops the codepoints
 * whose filled shape is reached through an OpenType substitution.
 */
const GLYPHS = {
  arrow_back: 0xe5c4,
  arrow_downward: 0xe5db,
  arrow_forward: 0xe5c8,
  brightness_auto: 0xe1ab,
  cable: 0xefe6,
  check_circle: 0xf0be,
  chevron_right: 0xe5cc,
  circle: 0xef4a,
  cloud_off: 0xe2c1,
  dark_mode: 0xe51c,
  delete_sweep: 0xe16c,
  detector_smoke: 0xe285,
  edit: 0xf097,
  error: 0xf8b6,
  grid_view: 0xe9b0,
  info: 0xe88e,
  light_mode: 0xe518,
  location_on: 0xf1db,
  memory: 0xe322,
  motion_sensor_active: 0xe792,
  network_check: 0xe640,
  notifications: 0xe7f5,
  notifications_off: 0xe7f6,
  progress_activity: 0xe9d0,
  rainy: 0xf176,
  refresh: 0xe5d5,
  router: 0xe328,
  schedule: 0xefd6,
  science: 0xea4b,
  screen_lock_portrait: 0xf2be,
  sensors: 0xe51e,
  sensors_off: 0xe51f,
  settings: 0xe8b8,
  space_dashboard: 0xe66b,
  sunny: 0xe81a,
  sync: 0xe627,
  vibration: 0xf2cb,
  view_agenda: 0xe8e9,
  warning: 0xf083,
  water_drop: 0xe798,
  wifi: 0xe63e,
  wifi_off: 0xe648,
  wifi_tethering: 0xe1e2,
} as const;

export type IconName = keyof typeof GLYPHS;

export const ICON_FONTS = {
  MSRounded: require('../../assets/fonts/MaterialSymbolsRounded-Fill0.ttf'),
  MSRoundedFill: require('../../assets/fonts/MaterialSymbolsRounded-Fill1.ttf'),
};

interface Props {
  name: IconName;
  size?: number;
  color: string;
  fill?: boolean;
  /** Continuous rotation, like the design's `bs-spin` animation. */
  spin?: boolean;
  /** Static rotation in degrees. */
  rotate?: number;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 24, color, fill, spin, rotate, style }: Props) {
  const s: TextStyle = {
    fontFamily: fill ? 'MSRoundedFill' : 'MSRounded',
    fontSize: size,
    lineHeight: size,
    width: size,
    height: size,
    textAlign: 'center',
    color,
    includeFontPadding: false,
  };
  const glyph = String.fromCodePoint(GLYPHS[name]);
  if (spin) return <SpinningGlyph glyph={glyph} style={[s, style]} />;
  return (
    <Text style={[s, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]} accessibilityElementsHidden importantForAccessibility="no">
      {glyph}
    </Text>
  );
}

function SpinningGlyph({ glyph, style }: { glyph: string; style: StyleProp<TextStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.Text style={[style, { transform: [{ rotate }] }]}>{glyph}</Animated.Text>;
}
