import { addDays, dayKey, dayKeyToMs, type DayKey } from '@snote/core';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/lib/theme';
import { IconButton } from './ui';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function Calendar({ value, onChange, activeDays }: { value: DayKey; onChange: (d: DayKey) => void; activeDays: Set<DayKey> }) {
  const colors = useColors();
  const [cursor, setCursor] = useState(() => {
    const d = new Date(dayKeyToMs(value));
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const today = dayKey(Date.now());
  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const start = addDays(dayKey(first.getTime()), -((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);
  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const label = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View>
      <View style={styles.head}>
        <IconButton name="chevron-back" label="Previous month" onPress={() => shift(-1)} />
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>{label}</Text>
        <IconButton name="chevron-forward" label="Next month" onPress={() => shift(1)} />
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={[styles.cell, styles.weekday, { color: colors.textFaint }]}>
            {w}
          </Text>
        ))}
        {cells.map((d) => {
          const inMonth = new Date(dayKeyToMs(d)).getMonth() === cursor.month;
          const selected = d === value;
          return (
            <Pressable
              key={d}
              onPress={() => onChange(d)}
              accessibilityRole="button"
              accessibilityLabel={d}
              accessibilityState={{ selected }}
              style={[styles.cell, styles.day, selected && { backgroundColor: colors.accent }]}
            >
              <Text
                style={{
                  color: selected ? '#fff' : d === today ? colors.accent : inMonth ? colors.text : colors.textFaint,
                  fontWeight: d === today || selected ? '700' : '400',
                }}
              >
                {Number(d.slice(8))}
              </Text>
              {activeDays.has(d) && <View style={[styles.dot, { backgroundColor: selected ? '#fff' : colors.accent }]} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1.15, alignItems: 'center', justifyContent: 'center' },
  weekday: { aspectRatio: 2, textAlign: 'center', textAlignVertical: 'center', fontSize: 12 },
  day: { borderRadius: 10 },
  dot: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2 },
});
