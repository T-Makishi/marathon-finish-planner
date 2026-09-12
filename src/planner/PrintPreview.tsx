import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Plan } from './model';
import { buildCardHtml, buildPrintLayout, exportProblems } from './cards';

export default function PrintPreview({ plan }: { plan: Plan }) {
  const [page, setPage] = useState(0), [actualSize, setActualSize] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(280);
  const layout = buildPrintLayout(plan), errors = exportProblems(plan);
  const selected = Math.min(page, Math.max(0, layout.pages.length - 1));
  if (errors.length || !layout.pages.length) return <Text style={{ color: '#806037', lineHeight: 22 }}>入力内容を修正すると、実際の印刷レイアウトを表示します。</Text>;
  const available = Math.max(160, Math.min(previewWidth - 2, 760));
  const scale = actualSize ? 1 : available / 794;
  const html = buildCardHtml(plan, new Date().toISOString(), { preview: true, previewPage: selected });
  return <View style={{ gap: 12 }} onLayout={event => setPreviewWidth(event.nativeEvent.layout.width)}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="前の印刷ページ" disabled={selected === 0} onPress={() => setPage(selected - 1)} style={{ padding: 12, backgroundColor: '#edf3eb', borderRadius: 8, opacity: selected === 0 ? .4 : 1 }}><Text>前へ</Text></Pressable>
      <Text style={{ padding: 12 }}>{selected + 1} / {layout.pages.length} ページ</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="次の印刷ページ" disabled={selected >= layout.pages.length - 1} onPress={() => setPage(selected + 1)} style={{ padding: 12, backgroundColor: '#edf3eb', borderRadius: 8, opacity: selected >= layout.pages.length - 1 ? .4 : 1 }}><Text>次へ</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={actualSize ? 'A4全体を表示' : '印刷プレビューを拡大'} onPress={() => setActualSize(!actualSize)} style={{ padding: 12, backgroundColor: '#edf3eb', borderRadius: 8 }}><Text>{actualSize ? 'A4全体' : '拡大して確認'}</Text></Pressable>
    </View>
    <ScrollView horizontal style={{ backgroundColor: '#e4e9e3', borderWidth: 1, borderColor: '#c8d4ca', maxHeight: actualSize ? 600 : 1123 * scale }}>
      <ScrollView nestedScrollEnabled contentContainerStyle={{ width: 794 * scale, height: 1123 * scale }}>
        {Platform.OS === 'web' ? React.createElement('iframe', { title: `印刷プレビュー ${selected + 1}ページ`, srcDoc: html, sandbox: '', scrolling: 'no', style: { width: 794, height: 1123, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left', display: 'block', position: 'absolute', top: 0, left: 0 } }) : <WebView originWhitelist={['about:blank']} source={{ html }} javaScriptEnabled={false} scrollEnabled={false} scalesPageToFit style={{ width: 794 * scale, height: 1123 * scale, backgroundColor: '#fff' }} />}
      </ScrollView>
    </ScrollView>
    <Text style={{ fontSize: 12, lineHeight: 19, color: '#65746a' }}>画面は用紙全体の縮小表示です。印刷時はA4・100%を選び、50mmの目盛りで実寸を確認してください。</Text>
  </View>;
}
