import React, { useState } from 'react';
import { Linking, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';

export default function GuideVideo() {
  const { width } = useWindowDimensions();
  const [choice, setChoice] = useState<'mobile' | 'pc' | null>(null);
  const mode = choice ?? (width < 600 ? 'mobile' : 'pc');
  // Use the app's directory on both localhost and GitHub project Pages.
  const base = Platform.OS === 'web'
    ? new URL('./guide-media/', `${window.location.origin}${window.location.pathname.replace(/\/?$/, '/')}`).href
    : 'https://t-makishi.github.io/marathon-finish-planner/guide-media/';
  const source = `${base}guide-${mode}-v1.mp4`;
  return <View style={{ padding: 16, gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#dce4da' }}>
    <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700', color: '#173f32' }}>動画でわかる使い方（約1分33秒）</Text>
    <Text style={{ fontSize: 15, lineHeight: 23, color: '#405b4f' }}>大会選択から印刷まで、実際の画面と図解で説明します。女性音声・字幕付きです。再生ボタンを押すと音声が流れます。</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>{(['mobile', 'pc'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }} onPress={() => setChoice(value)} style={{ flex: 1, minHeight: 48, padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === value ? '#164d3c' : '#edf3eb' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: mode === value ? '#fff' : '#164d3c' }}>{value === 'mobile' ? 'スマホ版' : 'PC版'}</Text>
    </Pressable>)}</View>
    {Platform.OS === 'web' ? React.createElement('video', {
      key: mode, src: source, controls: true, playsInline: true, preload: 'none',
      poster: `${base}guide-${mode}-v1.png`, 'aria-label': `${mode === 'mobile' ? 'スマホ版' : 'PC版'}の使い方動画。女性音声と字幕付き`,
      style: { display: 'block', width: '100%', maxHeight: 480, borderRadius: 10, background: '#eff4ef', aspectRatio: mode === 'mobile' ? '9 / 16' : '16 / 9', objectFit: 'contain' },
    }) : <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(source); }} style={{ padding: 16, backgroundColor: '#edf3eb', borderRadius: 10 }}><Text style={{ color: '#164d3c', fontSize: 16, fontWeight: '700' }}>使い方動画を開く</Text></Pressable>}
    <Text style={{ fontSize: 13, lineHeight: 21, color: '#52685b' }}>一時停止しながら操作できます。詳しい説明は、下の「大会・計画・カード」から選んでください。動画の再生には通信が必要です。</Text>
  </View>;
}
