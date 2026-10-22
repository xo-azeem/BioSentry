import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/lib/theme';

export const FONT = {
  400: 'SpaceGrotesk_400Regular',
  500: 'SpaceGrotesk_500Medium',
  600: 'SpaceGrotesk_600SemiBold',
  700: 'SpaceGrotesk_700Bold',
} as const;

type Weight = keyof typeof FONT;

interface Props extends TextProps {
  size?: number;
  lh?: number;
  w?: Weight;
  /** Letter spacing in em, as written in the design. */
  ls?: number;
  color?: string;
  /** Tabular figures for live values. */
  tnum?: boolean;
}

/** Space Grotesk text. Android needs one font family per weight, so `w` picks the family. */
export function T({ size = 15, lh, w = 500, ls, color, tnum, style, ...rest }: Props) {
  const { c } = useTheme();
  const s: TextStyle = {
    ...(tnum ? { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] } : null),
    fontFamily: FONT[w],
    fontSize: size,
    lineHeight: lh ?? Math.round(size * 1.35),
    color: color ?? c.text,
    letterSpacing: ls ? ls * size : 0,
    includeFontPadding: false,
  };
  return <RNText {...rest} style={[s, style]} />;
}
