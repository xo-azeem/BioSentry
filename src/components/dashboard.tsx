import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import type { BannerModel, CardModel } from '@/lib/cards';
import { mix, radius, useTheme, type Tone } from '@/lib/theme';

import { Icon, type IconName } from './Icon';
import { T } from './Text';
import { Chip, Skeleton, Sparkline } from './ui';

// ---------------------------------------------------------------------------------------------
export function SensorCardGrid({ card, onPress }: { card: CardModel; onPress: () => void }) {
  const { c, e1 } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${card.valueText} ${card.unit}, ${card.status}`}
      style={({ pressed }) => [
        {
          flex: 1,
          minWidth: 0,
          paddingTop: 14,
          paddingHorizontal: 14,
          paddingBottom: 12,
          borderRadius: radius.lg,
          backgroundColor: card.danger ? mix(c.danger, 10, c.surface) : c.surface,
          borderWidth: 1,
          borderColor: card.danger ? mix(c.danger, 55) : c.border,
          gap: 8,
          opacity: pressed ? 0.85 : 1,
        },
        e1,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconTile icon={card.icon} tone={card.iconTone} />
        <Icon name="chevron_right" size={20} color={c.text3} />
      </View>
      <View style={{ minHeight: 34, justifyContent: 'flex-end' }}>
        <T size={13} lh={17} w={600} color={c.text2}>
          {card.name}
        </T>
      </View>
      <Value card={card} size={32} lh={36} unitSize={15} />
      <Chip tone={card.tone} label={card.status} icon={card.statusIcon} />
      <View style={{ marginTop: 2 }}>
        <Sparkline line={card.spark.line} area={card.spark.area} color={c[card.sparkTone]} areaOpacity={card.areaOpacity} />
      </View>
      <T size={12} lh={16} color={c.text2} tnum numberOfLines={1}>
        {card.sub}
      </T>
    </Pressable>
  );
}

export function SensorCardList({ card, onPress }: { card: CardModel; onPress: () => void }) {
  const { c, e1 } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${card.valueText} ${card.unit}, ${card.status}`}
      style={({ pressed }) => [
        {
          paddingTop: 14,
          paddingBottom: 14,
          paddingLeft: 14,
          paddingRight: 12,
          borderRadius: radius.lg,
          backgroundColor: card.danger ? mix(c.danger, 10, c.surface) : c.surface,
          borderWidth: 1,
          borderColor: card.danger ? mix(c.danger, 55) : c.border,
          gap: 10,
          opacity: pressed ? 0.85 : 1,
        },
        e1,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon={card.icon} tone={card.iconTone} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T size={14} lh={19} w={600} numberOfLines={1}>
            {card.name}
          </T>
          <T size={12} lh={16} color={c.text2} tnum numberOfLines={1}>
            {card.sub}
          </T>
        </View>
        <Value card={card} size={28} lh={32} unitSize={14} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Chip tone={card.tone} label={card.status} icon={card.statusIcon} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sparkline line={card.spark.line} area={card.spark.area} color={c[card.sparkTone]} areaOpacity={card.areaOpacity} height={24} />
        </View>
        <Icon name="chevron_right" size={20} color={c.text3} />
      </View>
    </Pressable>
  );
}

export function IconTile({ icon, tone, size = 40, iconSize = 22, r = 12 }: { icon: IconName; tone: Tone; size?: number; iconSize?: number; r?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: mix(c[tone], 15), alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={iconSize} color={c[tone]} />
    </View>
  );
}

function Value({ card, size, lh, unitSize }: { card: CardModel; size: number; lh: number; unitSize: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, minWidth: 0 }}>
      <T size={size} lh={lh} w={700} ls={-0.03} tnum color={c[card.valColor]} numberOfLines={1}>
        {card.valueText}
      </T>
      {card.unit ? (
        <T size={unitSize} lh={unitSize + 4} w={600} color={c.text2}>
          {card.unit}
        </T>
      ) : null}
    </View>
  );
}

export function SkeletonCard() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, height: 186, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 }}>
      <Skeleton style={{ width: 40, height: 40, borderRadius: 12 }} />
      <Skeleton style={{ width: '80%', height: 12, borderRadius: 6 }} />
      <Skeleton style={{ width: '55%', height: 28, borderRadius: 8 }} />
      <Skeleton style={{ width: 64, height: 22, borderRadius: 11 }} />
      <Skeleton style={{ width: '100%', height: 24, borderRadius: 6, marginTop: 'auto' }} />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
export function Banner({ banner, onPress }: { banner: BannerModel; onPress?: () => void }) {
  const { c } = useTheme();
  const look = {
    danger: { bg: c.danger, border: c.danger, fg: c.onDanger, iconBg: 'rgba(0,0,0,0.14)', iconFg: c.onDanger },
    offline: { bg: mix(c.offline, 12, c.surface), border: mix(c.offline, 35), fg: c.text, iconBg: mix(c.offline, 18), iconFg: c.offline },
    invalid: { bg: mix(c.warning, 10, c.surface), border: mix(c.warning, 35), fg: c.text, iconBg: mix(c.warning, 18), iconFg: c.warning },
    warning: { bg: mix(c.warning, 10, c.surface), border: mix(c.warning, 35), fg: c.text, iconBg: mix(c.warning, 18), iconFg: c.warning },
    normal: { bg: mix(c.safe, 9, c.surface), border: mix(c.safe, 28), fg: c.text, iconBg: mix(c.safe, 16), iconFg: c.safe },
  }[banner.kind];
  const action = !!banner.target && !!onPress;
  return (
    <Pressable
      onPress={action ? onPress : undefined}
      disabled={!action}
      accessibilityRole={action ? 'button' : 'summary'}
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        paddingVertical: 14,
        paddingLeft: 16,
        paddingRight: 14,
        borderRadius: 18,
        backgroundColor: look.bg,
        borderWidth: 1,
        borderColor: look.border,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: look.iconBg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={banner.icon} size={22} color={look.iconFg} fill />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T size={16} lh={22} w={700} color={look.fg}>
          {banner.title}
        </T>
        <T size={13} lh={18} color={look.fg} tnum style={{ opacity: 0.86 }}>
          {banner.body}
        </T>
      </View>
      {action ? <Icon name="chevron_right" size={22} color={look.fg} /> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------
export interface PillModel {
  label: string;
  tone: Tone;
  icon?: IconName;
  live?: boolean;
  spin?: boolean;
}

export function ConnectionPill({ pill }: { pill: PillModel }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 26,
        paddingLeft: 9,
        paddingRight: 10,
        borderRadius: radius.full,
        backgroundColor: mix(c[pill.tone], 14),
      }}
    >
      {pill.live ? <PingDot color={c.safe} /> : pill.icon ? <Icon name={pill.icon} size={15} color={c[pill.tone]} spin={pill.spin} /> : null}
      <T size={12} lh={16} w={600} tnum numberOfLines={1}>
        {pill.label}
      </T>
    </View>
  );
}

/** Live dot with the design's `bs-ping` ring (scale 1 → 2.6, fade out, 1.8 s). */
function PingDot({ color }: { color: string }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: 8, height: 8 }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}
