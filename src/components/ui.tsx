import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Pressable, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { mix, radius, useTheme, type Tone } from '@/lib/theme';

import { Icon, type IconName } from './Icon';
import { T } from './Text';

// ---------------------------------------------------------------------------------------------
// Status chip — danger chips are solid so they read at a glance; every other chip is a 16% tint.
export function Chip({ tone, label, icon, large }: { tone: Tone; label: string; icon: IconName; large?: boolean }) {
  const { c } = useTheme();
  const danger = tone === 'danger';
  const fg = danger ? c.onDanger : c[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: large ? 5 : 4,
        height: large ? 30 : 24,
        paddingLeft: large ? 9 : 7,
        paddingRight: large ? 12 : 9,
        borderRadius: radius.full,
        backgroundColor: danger ? c.danger : mix(c[tone], 16),
      }}
    >
      <Icon name={icon} size={large ? 18 : 15} color={fg} fill />
      <T size={large ? 14 : 12} lh={large ? 18 : 16} w={700} color={fg} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
export function Overline({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ paddingHorizontal: 4, paddingTop: 10 }, style]}>
      <T size={12} lh={16} w={700} ls={0.08} color={c.text3} style={{ textTransform: 'uppercase' }}>
        {children}
      </T>
    </View>
  );
}

/** Rounded surface group (cards, lists). */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, style]}>{children}</View>;
}

/** Bottom border for every row but the last. */
export function sepStyle(i: number, n: number, color: string): ViewStyle {
  return { borderBottomWidth: 1, borderBottomColor: i === n - 1 ? 'transparent' : color };
}

// ---------------------------------------------------------------------------------------------
type ButtonKind = 'primary' | 'secondary' | 'tonal' | 'outline';

export function Button({
  kind = 'primary',
  label,
  icon,
  iconSpin,
  onPress,
  disabled,
  style,
}: {
  kind?: ButtonKind;
  label: string;
  icon?: IconName;
  iconSpin?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const spec = {
    primary: { h: 52, r: 14, bg: c.primary, fg: c.onPrimary, border: 0, bc: 'transparent', w: 700 as const, fs: 16, is: 20, ic: c.onPrimary },
    secondary: { h: 52, r: 14, bg: 'transparent', fg: c.text, border: 1.5, bc: c.border, w: 600 as const, fs: 16, is: 20, ic: c.primary },
    tonal: { h: 48, r: 12, bg: c.primaryC, fg: c.onPrimaryC, border: 0, bc: 'transparent', w: 600 as const, fs: 14, is: 18, ic: c.onPrimaryC },
    outline: { h: 48, r: 12, bg: 'transparent', fg: c.text, border: 1.5, bc: c.border, w: 600 as const, fs: 14, is: 18, ic: c.text },
  }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: mix(spec.fg, 14), borderless: false }}
      style={({ pressed }) => [
        {
          height: spec.h,
          borderRadius: spec.r,
          backgroundColor: disabled && kind === 'primary' ? c.surface : spec.bg,
          borderWidth: spec.border,
          borderColor: spec.bc,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: kind === 'primary' || kind === 'secondary' ? 8 : 6,
          paddingHorizontal: 16,
          overflow: 'hidden',
          opacity: pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={spec.is} color={disabled ? c.text3 : spec.ic} spin={iconSpin} /> : null}
      <T size={spec.fs} lh={spec.fs + 4} w={spec.w} color={disabled ? c.text3 : spec.fg}>
        {label}
      </T>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------
/**
 * Segmented control. `card` sits on the page (range picker), `inset` sits inside a group card
 * on the page background colour (refresh interval, theme).
 */
export function Segmented<K extends string | number>({
  items,
  value,
  onChange,
  variant = 'card',
}: {
  items: { key: K; label: string; icon?: IconName }[];
  value: K;
  onChange: (k: K) => void;
  variant?: 'card' | 'inset';
}) {
  const { c } = useTheme();
  const inset = variant === 'inset';
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: inset ? 12 : 14,
        backgroundColor: inset ? c.bg : c.surface,
        borderWidth: inset ? 0 : 1,
        borderColor: c.border,
      }}
    >
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            // keyed on state too: Android drops the corner radius when a background goes transparent → colour
            key={`${it.key}-${on}`}
            onPress={() => onChange(it.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              height: 40,
              borderRadius: inset ? radius.xs : 10,
              backgroundColor: on ? c.primaryC : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {it.icon ? <Icon name={it.icon} size={18} color={on ? c.onPrimaryC : c.text2} /> : null}
            <T size={14} lh={18} w={on ? 700 : 500} color={on ? c.onPrimaryC : c.text2} tnum>
              {it.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
/** Material 3 switch: 52×32 track, 24dp knob on / 16dp knob off. */
export function Switch({ on }: { on: boolean }) {
  const { c } = useTheme();
  const knob = on ? 24 : 16;
  return (
    <View
      key={on ? 'on' : 'off'} // see Segmented: remount so the rounded background is redrawn
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: on ? c.primary : c.text3,
        backgroundColor: on ? c.primary : 'transparent',
      }}
    >
      <View
        style={{
          position: 'absolute',
          // like CSS, offsets are measured inside the 2dp border
          left: on ? 22 : 6,
          top: 14 - knob / 2,
          width: knob,
          height: knob,
          borderRadius: knob / 2,
          backgroundColor: on ? c.onPrimary : c.text3,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
/** Skeleton block with the design's `bs-pulse` animation (opacity .45 ↔ .9, 1.4 s). */
export function Skeleton({ style }: { style: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [v] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.9, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: c.elev, opacity: v }, style]} />;
}

// ---------------------------------------------------------------------------------------------
/**
 * Sparkline drawn in a 100×28 box stretched to the available width
 * (design: viewBox 0 0 100 28, preserveAspectRatio none, non-scaling 1.75 stroke).
 */
export function Sparkline({ line, area, color, areaOpacity, height = 28 }: { line: string; area: string; color: string; areaOpacity: number; height?: number }) {
  const [w, setW] = useState(0);
  const sx = w / 100;
  const sy = height / 28;
  const scale = (d: string) =>
    d.replace(/([MLHV])\s*([-\d.]+)(?:[ ,]([-\d.]+))?/g, (_m, cmd: string, a: string, b?: string) => {
      if (cmd === 'H') return `H${(+a * sx).toFixed(1)}`;
      if (cmd === 'V') return `V${(+a * sy).toFixed(1)}`;
      return `${cmd}${(+a * sx).toFixed(1)} ${(+(b ?? 0) * sy).toFixed(1)}`;
    });
  return (
    <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && line ? (
        <Svg width={w} height={height} style={{ overflow: 'visible' }}>
          <Path d={scale(area)} fill={color} opacity={areaOpacity} />
          <Path d={scale(line)} stroke={color} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
/** The BioSentry logo as an app-icon tile. */
export function LogoTile({ size, r }: { size: number; r: number }) {
  return (
    <Image
      source={require('../../assets/logo-tile.png')}
      style={{ width: size, height: size, borderRadius: r, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
      accessibilityLabel="BioSentry logo"
    />
  );
}
