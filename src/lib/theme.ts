import { useColorScheme } from 'react-native';

import { useSensors } from './store';

/** Design tokens from "BioSentry Design" — values in dp. */
export const PALETTES = {
  dark: {
    bg: '#0B1416',
    surface: '#121D20',
    elev: '#1A292D',
    navBg: '#0E191B',
    border: '#22353A',
    primary: '#14B8A6',
    onPrimary: '#03201D',
    primaryC: '#103A36',
    onPrimaryC: '#99F6E4',
    accent: '#A3E635',
    text: '#E6EFEE',
    text2: '#9AAEAD',
    text3: '#7A8E90',
    safe: '#3CCB7F',
    warning: '#F4B740',
    danger: '#FF5B53',
    onDanger: '#200605',
    info: '#22D3EE',
    offline: '#7E8C8F',
    brandTop: '#0B1416',
    brandBottom: '#0A2624',
    brandText: '#F0FDFA',
    brandSub: '#99D9CF',
  },
  light: {
    bg: '#F3F7F6',
    surface: '#FFFFFF',
    elev: '#FFFFFF',
    navBg: '#FFFFFF',
    border: '#DCE6E4',
    primary: '#0F766E',
    onPrimary: '#FFFFFF',
    primaryC: '#CCF1EA',
    onPrimaryC: '#064E47',
    accent: '#65A30D',
    text: '#0E1A1B',
    text2: '#4C605F',
    text3: '#687978',
    safe: '#17844A',
    warning: '#A66A00',
    danger: '#D3302A',
    onDanger: '#FFFFFF',
    info: '#0E7490',
    offline: '#637173',
    brandTop: '#0F766E',
    brandBottom: '#0B5B55',
    brandText: '#F0FDFA',
    brandSub: '#99D9CF',
  },
};

export type Palette = (typeof PALETTES)['dark'];
export type Tone = 'safe' | 'warning' | 'danger' | 'info' | 'offline' | 'primary';
/** Kept for older call sites — a status level is a tone. */
export type Level = Tone;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/**
 * CSS `color-mix(in srgb, color pct%, base)`.
 * Without a base it mixes with transparent, which is the colour at `pct` alpha.
 */
export function mix(color: string, pct: number, base?: string): string {
  const c = hex(color);
  if (!base) return `rgba(${c[0]},${c[1]},${c[2]},${pct / 100})`;
  const b = hex(base);
  return toHex(c.map((v, i) => v * (pct / 100) + b[i] * (1 - pct / 100)));
}

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, '2xl': 32, '3xl': 48 };
export const radius = { xs: 9, sm: 12, md: 14, lg: 20, xl: 24, full: 999 };

export function useTheme() {
  const system = useColorScheme();
  const { settings } = useSensors();
  const mode: 'dark' | 'light' = settings.theme === 'system' ? (system === 'light' ? 'light' : 'dark') : settings.theme;
  const c = PALETTES[mode];
  return {
    c,
    mode,
    tone: (t: Tone) => c[t],
    /** Elevation 1: light cards only. Dark theme separates with surface + border. */
    e1: mode === 'light' ? { boxShadow: '0 1px 2px rgba(16,40,38,0.05), 0 1px 4px rgba(16,40,38,0.05)' } : {},
    /** Elevation 2/3/4: tooltips and the pull indicator. */
    e2: mode === 'light' ? { boxShadow: '0 8px 24px rgba(16,40,38,0.14)' } : { boxShadow: '0 6px 20px rgba(0,0,0,0.4)' },
  };
}
