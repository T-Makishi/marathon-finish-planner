import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { calendarCells, calendarLabel, calendarValue, parseCalendarDate, shiftMonth } from './calendar';

function today() {
  const date = new Date();
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}
export default function DateField({ label, value, onChange, small = false }: {
  label: string; value: string; onChange: (value: string) => void; small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(today);
  const selected = parseCalendarDate(value);
  const move = (delta: number) => setMonth(current => ({ ...shiftMonth(current.year, current.month, delta), day: 1 }));
  const close = () => setOpen(false);
  return <View style={[s.field, small && { flex: 1, minWidth: 115 }]}>
    <Text style={s.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}：${selected ? calendarLabel(selected) : value || '未設定'}。カレンダーを開く`}
      accessibilityState={{ expanded: open }} onPress={() => { setMonth(selected || today()); setOpen(true); }} style={s.input}>
      <Text style={[s.value, !value && { color: '#65776c' }]}>{selected ? calendarLabel(selected) : value || '日付を選択'}</Text>
      <Text style={s.icon}>▦</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={s.overlay}>
        <View style={s.dialog} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={s.content}>
            <Text accessibilityRole="header" style={s.title}>{label}</Text>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={s.month}>{month.year}年{month.month}月</Text>
            <View style={s.navigation}>
              {([{ text: '前年', delta: -12 }, { text: '前月', delta: -1 }, { text: '翌月', delta: 1 }, { text: '翌年', delta: 12 }]).map(item =>
                <Pressable key={item.text} accessibilityRole="button" accessibilityLabel={item.text} onPress={() => move(item.delta)} style={s.navButton}><Text style={s.label}>{item.text}</Text></Pressable>)}
            </View>
            <View style={s.grid}>
              {['日', '月', '火', '水', '木', '金', '土'].map(day => <View key={day} style={s.cell}><Text style={s.weekday}>{day}</Text></View>)}
              {calendarCells(month.year, month.month).map((day, index) => {
                if (day === null) return <View key={index} style={s.cell} />;
                const date = { ...month, day };
                const chosen = calendarValue(date) === value;
                return <View key={index} style={s.cell}><Pressable accessibilityRole="button" accessibilityLabel={calendarLabel(date)} accessibilityState={{ selected: chosen }}
                  onPress={() => { onChange(calendarValue(date)); close(); }} style={[s.day, chosen && s.selected]}>
                  <Text style={[s.dayText, chosen && { color: '#fff', fontWeight: '700' }]}>{day}</Text>
                </Pressable></View>;
              })}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setMonth(today())} style={s.action}><Text style={s.label}>今月を表示</Text></Pressable>
            <View style={s.navigation}>
              <Pressable accessibilityRole="button" onPress={() => { onChange(''); close(); }} style={s.action}><Text style={s.label}>日付を解除</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={close} style={s.action}><Text style={s.label}>閉じる</Text></Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  field: { gap: 7 }, label: { color: '#233e30', fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#c8d4ca', borderRadius: 8, backgroundColor: '#fbfdfa', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { color: '#233e30', fontSize: 16, flex: 1 }, icon: { color: '#164d3c', fontSize: 22 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  dialog: { width: '100%', maxWidth: 400, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 16 },
  content: { padding: 16, gap: 12 }, title: { fontSize: 18, fontWeight: '700', color: '#233e30' },
  month: { fontSize: 22, fontWeight: '700', color: '#164d3c', textAlign: 'center' },
  navigation: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  navButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#edf3ec' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: '14.285714%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: '#65776c', fontSize: 14 }, day: { width: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  dayText: { color: '#233e30', fontSize: 17 }, selected: { backgroundColor: '#164d3c' },
  action: { padding: 12, minHeight: 44, alignItems: 'center', borderRadius: 8, backgroundColor: '#edf3ec' },
});
