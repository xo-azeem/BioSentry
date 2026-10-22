import { useState } from 'react';
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { motionShape } from '@/lib/series';
import { radius, useTheme, type Tone } from '@/lib/theme';
import type { MotionEvent } from '@/lib/types';

import { T } from './Text';

const H = 180;
const PT = 12;
const PB = 10;

export interface ThresholdLine {
  value: number;
  label: string;
  tone: Tone;
}

/**
 * Detail line chart (design: 180dp tall, thin line, 8% fill, dashed threshold lines labelled
 * in their status colour, crosshair + dot + tooltip that follows the finger).
 */
export function LineChart({
  data,
  max,
  tone,
  lines,
  hover,
  onHover,
  formatValue,
  formatTime,
}: {
  data: (number | null)[];
  max: number;
  tone: Tone;
  lines: ThresholdLine[];
  hover: number | null;
  onHover: (i: number) => void;
  formatValue: (v: number) => string;
  formatTime: (i: number) => string;
}) {
  const { c, e2 } = useTheme();
  const [W, setW] = useState(0);
  const [tipSize, setTipSize] = useState({ w: 96, h: 46 });
  const n = data.length;
  const color = c[tone];
  const yv = (v: number) => PT + (1 - Math.min(Math.max(v, 0), max) / max) * (H - PT - PB);
  const xv = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);

  // Line and area, broken wherever a bucket has no data.
  let line = '';
  let area = '';
  let seg: number[] = [];
  const flush = () => {
    if (!seg.length) return;
    const pts = seg.map((i) => `${xv(i).toFixed(1)} ${yv(data[i] as number).toFixed(1)}`);
    line += 'M' + pts.join(' L');
    area += 'M' + pts.join(' L') + ` L${xv(seg[seg.length - 1]).toFixed(1)} ${H} L${xv(seg[0]).toFixed(1)} ${H} Z`;
    seg = [];
  };
  data.forEach((v, i) => (v === null ? flush() : seg.push(i)));
  flush();

  const hasData = data.some((v) => v !== null);
  // Tooltip index: the finger, or 70% across like the design; snap to the nearest bucket with data.
  let idx = Math.max(0, Math.min(n - 1, hover ?? Math.round((n - 1) * 0.7)));
  if (hasData && data[idx] === null) {
    let best = -1;
    data.forEach((v, i) => {
      if (v !== null && (best === -1 || Math.abs(i - idx) < Math.abs(best - idx))) best = i;
    });
    idx = best;
  }
  const tipV = data[idx];
  const tx = xv(idx);
  const ty = tipV !== null && tipV !== undefined ? yv(tipV) : 0;
  const yPct = (ty / H) * 100;
  const bx = Math.max(0.17 * W, Math.min(0.83 * W, tx));
  const tipTop = yPct < 38 ? ty + 14 : ty - 14 - tipSize.h;

  const touch = (e: GestureResponderEvent) => {
    if (!W || n < 2) return;
    onHover(Math.max(0, Math.min(n - 1, Math.round((e.nativeEvent.locationX / W) * (n - 1)))));
  };

  return (
    <View
      style={{ height: H, marginRight: 2 }}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={touch}
      onResponderMove={touch}
      accessibilityLabel="Chart. Drag to inspect values."
    >
      {W > 0 && (
        <Svg width={W} height={H} style={{ position: 'absolute', overflow: 'visible' }}>
          <Line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke={c.border} strokeWidth={1} />
          {lines.map((l) => (
            <Line key={l.label} x1={0} x2={W} y1={yv(l.value)} y2={yv(l.value)} stroke={c[l.tone]} strokeWidth={1} strokeDasharray="3 4" opacity={0.9} />
          ))}
          {hasData && <Path d={area} fill={color} opacity={0.08} />}
          {hasData && <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
          {hasData && <Line x1={tx} x2={tx} y1={0} y2={H} stroke={c.text3} strokeWidth={1} opacity={0.5} />}
        </Svg>
      )}

      {lines.map((l) => (
        <View key={`lbl-${l.label}`} pointerEvents="none" style={{ position: 'absolute', left: 0, bottom: H - yv(l.value), paddingBottom: 3 }}>
          <T size={11} lh={14} w={600} color={c[l.tone]} tnum>
            {`${l.label} ${formatValue(l.value)}`}
          </T>
        </View>
      ))}

      {!hasData && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <T size={13} color={c.text3}>
            No readings in this range yet
          </T>
        </View>
      )}

      {W > 0 && hasData && tipV !== null && tipV !== undefined && (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: tx - 6,
              top: ty - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: c.surface,
              borderWidth: 2.5,
              borderColor: color,
            }}
          />
          <View
            pointerEvents="none"
            onLayout={(e) => setTipSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            style={[
              {
                position: 'absolute',
                left: bx - tipSize.w / 2,
                top: tipTop,
                paddingVertical: 7,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: c.elev,
                borderWidth: 1,
                borderColor: c.border,
                gap: 1,
              },
              e2,
            ]}
          >
            <T size={15} lh={19} w={700} tnum>
              {formatValue(tipV)}
            </T>
            <T size={11} lh={14} color={c.text2} tnum>
              {formatTime(idx)}
            </T>
          </View>
        </>
      )}
    </View>
  );
}

/** Motion timeline: on/off step chart (design: 112dp, dashed "Detected" level, solid "Clear" base). */
export function MotionChart({ events, windowSec, now }: { events: MotionEvent[]; windowSec: number; now: number }) {
  const { c } = useTheme();
  const [W, setW] = useState(0);
  const shape = motionShape(events, windowSec, W || 320, 24, 96, now);
  return (
    <View style={{ height: 112 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {W > 0 && (
        <Svg width={W} height={112} style={{ position: 'absolute', overflow: 'visible' }}>
          <Line x1={0} x2={W} y1={24} y2={24} stroke={c.border} strokeWidth={1} strokeDasharray="3 4" />
          <Line x1={0} x2={W} y1={96} y2={96} stroke={c.border} strokeWidth={1} />
          <Path d={shape.fill} fill={c.info} opacity={0.14} />
          <Path d={shape.step} stroke={c.info} strokeWidth={2} fill="none" strokeLinejoin="round" />
        </Svg>
      )}
      <T size={11} lh={14} w={600} color={c.info} style={{ position: 'absolute', left: 0, top: 4 }}>
        Detected
      </T>
      <T size={11} lh={14} w={600} color={c.text3} style={{ position: 'absolute', left: 0, top: 100 }}>
        Clear
      </T>
      {shape.count === 0 && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <T size={13} color={c.text3}>
            No motion in this range
          </T>
        </View>
      )}
    </View>
  );
}

export function ChartCard({ children }: { children: React.ReactNode }) {
  const { c, e1 } = useTheme();
  return (
    <View
      style={[
        {
          paddingTop: 16,
          paddingRight: 14,
          paddingBottom: 12,
          paddingLeft: 16,
          borderRadius: radius.lg,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          gap: 12,
        },
        e1,
      ]}
    >
      {children}
    </View>
  );
}
