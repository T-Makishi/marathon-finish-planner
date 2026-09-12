import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
export default function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}>
    <Text style={{ color: '#233e30', fontSize: 14, fontWeight: '600' }}>{label}</Text>
    {Platform.OS === 'web' ? React.createElement('select', {
      'aria-label': label, value, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
      style: { width: '100%', padding: 12, minHeight: 46, fontSize: 16, color: '#233e30', border: '1px solid #c8d4ca', borderRadius: 8, background: '#fff' },
    }, options.map(option => React.createElement('option', { key: option.value, value: option.value }, option.label))) : <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ padding: 14, borderWidth: 1, borderColor: '#c8d4ca', borderRadius: 8 }}><Text>{options.find(o => o.value === value)?.label}　{open ? '▴' : '▾'}</Text></Pressable>
      {open && <ScrollView nestedScrollEnabled style={{ maxHeight: 240, borderWidth: 1, borderColor: '#c8d4ca', borderRadius: 8 }}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => { onChange(option.value); setOpen(false); }} style={{ padding: 14, backgroundColor: value === option.value ? '#e5eee6' : '#fff' }}><Text>{option.label}</Text></Pressable>)}</ScrollView>}
    </>}
  </View>;
}
