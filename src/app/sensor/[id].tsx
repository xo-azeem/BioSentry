import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChartCard, LineChart, MotionChart } from '@/components/charts';
import { IconTile } from '@/components/dashboard';
import { Icon } from '@/components/Icon';
import { T } from '@/components/Text';
import { Chip, Group, Overline, Segmented, sepStyle } from '@/components/ui';
import { buildCard, motionStats } from '@/lib/cards';
import { agoStr, hm, hms } from '@/lib/format';
import { SENSOR_MAP, thresholdLines, withUnit } from '@/lib/sensors';
import { bucketize, motionShape, RANGES, type RangeKey } from '@/lib/series';
import { useSensors } from '@/lib/store';
import { mix, radius, useTheme } from '@/lib/theme';
import type { SensorId } from '@/lib/types';
import { useNow } from '@/lib/useNow';

export default function SensorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { latest, history, motionEvents, settings, status, lastSuccessAt } = useSensors();
  const [range, setRange] = useState<RangeKey>('15m');
  const [hover, setHover] = useState<number | null>(null);
  const now = useNow(1000);

  const def = SENSOR_MAP[id as SensorId];
  const offline = status === 'offline' && !!latest;
  const rg = RANGES.find((r) => r.key === range)!;
  // Whole seconds, so the chart re-buckets once per second as time moves on.
  const endSec = Math.floor((offline && latest ? latest.t : now) / 1000);
  const end = endSec * 1000;
  const sensorId = def?.id;

  const data = useMemo(() => (sensorId && sensorId !== 'motion' ? bucketize(history, sensorId, rg.n, rg.step, endSec * 1000) : []), [history, sensorId, rg, endSec]);

  if (!def) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <T>Unknown sensor</T>
      </View>
    );
  }

  const card = latest ? buildCard(def.id, { latest, history, events: motionEvents, th: settings.thresholds, now, offline, lastSuccessAt }) : null;
  const isMotion = def.id === 'motion';
  const m = motionStats(motionEvents, now);

  const secs = latest ? Math.max(0, Math.floor((now - latest.t) / 1000)) : 0;
  const agoText = !latest ? 'No data' : offline ? `Last data ${agoStr(latest.t, now)}` : secs === 0 ? 'Updated just now' : `Updated ${secs}s ago`;

  // Hero sub-line
  let sub = card?.sub ?? 'Waiting for the first reading';
  if (latest && card && !offline && !card.invalid) {
    if (def.id === 'rain') sub = `Wetness · digital output ${latest.rain.raining ? 'Raining' : 'Dry'}`;
    if (def.id === 'tds') sub = latest.tds.temp !== null ? `Water temperature ${latest.tds.temp.toFixed(1)} °C` : `Probe voltage ${latest.tds.voltage.toFixed(2)} V · no temperature probe`;
    if (def.id === 'gas') sub = `Raw ADC ${latest.gas.raw} of 4095`;
    if (def.id === 'motion')
      sub = latest.motion.detected && m.last
        ? `Moving now · started ${hms(m.last.start)}`
        : m.last
          ? `Last motion ${hms(m.last.end ?? m.last.start)} · ${m.today} events today`
          : 'No motion recorded yet';
  }
  const danger = !!card?.danger;
  const note = def.id === 'gas' ? 'Ventilate the area and keep ignition sources away.' : 'Check the biofilter — water quality is poor.';

  // Chart model
  const lbl = (t: number) => (range === '1m' ? hms(t) : hm(t));
  const span = (rg.n - 1) * rg.step * 1000;
  const xLabels = [lbl(end - span), lbl(end - span / 2), 'Now'];
  const chartTone = !card || card.tone === 'safe' || card.tone === 'offline' ? 'primary' : card.tone;
  const fmt = (v: number) => withUnit(def.id, v);

  let stats: { label: string; value: string; unit: string }[];
  let inRange = 0;
  if (isMotion) {
    inRange = motionShape(motionEvents, rg.n * rg.step, 100, 0, 1, now).count;
    stats = [
      { label: 'Events today', value: String(m.today), unit: '' },
      { label: 'In range', value: String(inRange), unit: '' },
      { label: 'Last motion', value: latest?.motion.detected ? 'Now' : m.last ? hm(m.last.end ?? m.last.start) : '—', unit: '' },
    ];
  } else {
    const vals = data.filter((v): v is number => v !== null);
    const f = (v: number | null) => (v === null ? '—' : String(Math.round(v)));
    stats = [
      { label: 'Min', value: f(vals.length ? Math.min(...vals) : null), unit: def.unit },
      { label: 'Average', value: f(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null), unit: def.unit },
      { label: 'Max', value: f(vals.length ? Math.max(...vals) : null), unit: def.unit },
    ];
  }

  const recent = [...motionEvents].reverse().slice(0, 6);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* App bar */}
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4, paddingRight: 8 }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surface : 'transparent' })}
        >
          <Icon name="arrow_back" size={24} color={c.text} />
        </Pressable>
        <T size={18} lh={24} w={700} ls={-0.01} numberOfLines={1} style={{ flex: 1 }}>
          {def.name}
        </T>
        <T size={12} lh={16} color={c.text3} tnum style={{ paddingRight: 8 }}>
          {agoText}
        </T>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 24 + insets.bottom, gap: 12 }}>
        {/* Hero */}
        <View
          style={{
            paddingTop: 18,
            paddingHorizontal: 18,
            paddingBottom: 16,
            borderRadius: radius.xl,
            backgroundColor: danger ? mix(c.danger, 10, c.surface) : c.surface,
            borderWidth: 1,
            borderColor: danger ? mix(c.danger, 55) : c.border,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <IconTile icon={def.icon} tone={card?.iconTone ?? 'offline'} size={44} iconSize={24} r={14} />
            {card ? <Chip tone={card.tone} label={card.status} icon={card.statusIcon} large /> : <Chip tone="offline" label="No data" icon="cloud_off" large />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <T size={60} lh={64} w={700} ls={-0.04} tnum color={card ? c[card.valColor] : c.text3}>
              {card?.valueText ?? '—'}
            </T>
            {card?.unit ? (
              <T size={22} lh={28} w={600} color={c.text2}>
                {card.unit}
              </T>
            ) : null}
          </View>
          <T size={14} lh={20} color={c.text2} tnum>
            {sub}
          </T>
          {danger && (
            <View style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.danger, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name="warning" size={18} color={c.onDanger} fill />
              <T size={13} lh={18} w={600} color={c.onDanger} style={{ flex: 1 }}>
                {note}
              </T>
            </View>
          )}
        </View>

        <Segmented
          items={RANGES.map((r) => ({ key: r.key, label: r.label }))}
          value={range}
          onChange={(k) => {
            setRange(k);
            setHover(null);
          }}
        />

        {!isMotion ? (
          <ChartCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T size={14} lh={18} w={600}>
                {`${def.metric} · last ${rg.label}`}
              </T>
              <T size={12} lh={16} color={c.text3}>
                Drag to inspect
              </T>
            </View>
            <LineChart
              data={data}
              max={def.max}
              tone={chartTone}
              lines={thresholdLines(def.id, settings.thresholds)}
              hover={hover}
              onHover={setHover}
              formatValue={fmt}
              formatTime={(i) => hms(end - (rg.n - 1 - i) * rg.step * 1000)}
            />
            <XLabels labels={xLabels} />
          </ChartCard>
        ) : (
          <ChartCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T size={14} lh={18} w={600}>
                {`Activity · last ${rg.label}`}
              </T>
              <T size={12} lh={16} color={c.text3} tnum>
                {`${inRange} ${inRange === 1 ? 'event' : 'events'}`}
              </T>
            </View>
            <MotionChart events={motionEvents} windowSec={rg.n * rg.step} now={now} />
            <XLabels labels={xLabels} />
          </ChartCard>
        )}

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {stats.map((s) => (
            <View
              key={s.label}
              style={{ flex: 1, minWidth: 0, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 10, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 4 }}
            >
              <T size={12} lh={16} w={500} color={c.text2} numberOfLines={1}>
                {s.label}
              </T>
              <T size={20} lh={24} w={700} ls={-0.02} tnum numberOfLines={1}>
                {s.value}
                {s.unit && s.value !== '—' ? (
                  <T size={12} lh={16} w={600} color={c.text2}>
                    {' ' + s.unit}
                  </T>
                ) : null}
              </T>
            </View>
          ))}
        </View>

        {isMotion && (
          <>
            <Overline style={{ paddingTop: 8 }}>Recent events</Overline>
            <Group style={{ paddingHorizontal: 16 }}>
              {recent.length === 0 ? (
                <View style={{ minHeight: 56, justifyContent: 'center' }}>
                  <T size={14} color={c.text2}>
                    No motion recorded yet
                  </T>
                </View>
              ) : (
                recent.map((e, i) => {
                  const live = i === 0 && e.end === null;
                  const dur = Math.max(1, Math.round(((e.end ?? now) - e.start) / 1000));
                  return (
                    <View key={e.start} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }, sepStyle(i, recent.length, c.border)]}>
                      <Icon name={live ? 'sensors' : 'motion_sensor_active'} size={20} color={live ? c.info : c.text3} fill />
                      <View style={{ flex: 1, gap: 1 }}>
                        <T size={14} lh={19} w={600}>
                          {live ? 'Motion in progress' : 'Motion detected'}
                        </T>
                        <T size={12} lh={16} color={c.text2} tnum>
                          {`${hms(e.start)} · ${live ? 'ongoing' : `${dur} s`}`}
                        </T>
                      </View>
                      <T size={12} lh={16} color={c.text3} tnum>
                        {live ? 'Now' : agoStr(e.start, now)}
                      </T>
                    </View>
                  );
                })
              )}
            </Group>
          </>
        )}

      </ScrollView>
    </View>
  );
}

function XLabels({ labels }: { labels: string[] }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {labels.map((l, i) => (
        <T key={i} size={11} lh={14} color={c.text3} tnum>
          {l}
        </T>
      ))}
    </View>
  );
}
