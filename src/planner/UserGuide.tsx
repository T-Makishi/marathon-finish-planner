import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

const steps = [
  { title: '大会を選ぶ', image: require('../../assets/guide/race.jpg'), alt: '大会画面：大会を選択するボタンと保存済み計画の一覧', body: '「大会を選択する」で大会を探します。初めての方は、保存済みのサンプルを選んで試せます。', tip: '大会の日付・距離・関門は、最新の公式要項で確認してください。', destination: '大会' },
  { title: '目標と走り方を決める', image: require('../../assets/guide/plan.jpg'), alt: '計画画面：目標時間とペース配分の設定', body: '「計画」で目標時間を選びます。最初は「一定ペース」で試し、必要に応じて前半・後半の配分を変更します。', tip: 'ネット＝スタートライン通過から。号砲＝大会のスタート合図から。', destination: '計画' },
  { title: 'カードを印刷して持参する', image: require('../../assets/guide/card.jpg'), alt: 'カード画面：印刷するカードと挑戦・本命・堅実の比較目標', body: '「カード」で印刷内容を選び、下のプレビューを確認。「この内容を印刷・PDF・共有」を押します。', tip: 'A4・倍率100%で印刷。本番案＋3案比較は外周を切り、中央は切らずに二つ折りにします。', destination: 'カード' },
] as const;
export default function UserGuide({ onOpen }: { onOpen: (tab: '大会' | '計画' | 'カード') => void }) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  return <View style={s.page}>
    <Text accessibilityRole="header" style={s.title}>使い方</Text>
    <Text style={s.intro}>大会前に計画して、紙のカードを持って走るアプリです。</Text>
    <View style={s.flow}>{steps.map((item, i) => <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={`手順${i + 1}：${item.title}`} accessibilityState={{ selected: index === i }} onPress={() => setIndex(i)} style={[s.pill, i === index && s.selected]}><Text style={[s.pillText, i === index && s.white]}>{i + 1} {item.destination}</Text></Pressable>)}</View>
    <View style={s.panel}>
      <Text accessibilityRole="header" style={s.heading}>{index + 1} / 3　{step.title}</Text>
      <Text style={s.body}>{step.body}</Text>
      <View style={s.image}><Image source={step.image} accessibilityLabel={step.alt} resizeMode="contain" style={{ position: 'absolute', width: '100%', height: '100%' }} /></View>
      <Text style={s.caption}>実際のアプリ画面（使い方サンプル）</Text>
      <Text style={s.tip}>{step.tip}</Text>
      <View style={s.flow}>
        <Pressable accessibilityRole="button" accessibilityLabel="前の使い方" disabled={index === 0} onPress={() => setIndex(index - 1)} style={[s.button, index === 0 && s.disabled]}><Text style={s.pillText}>戻る</Text></Pressable>
        {index < 2 ? <Pressable accessibilityRole="button" accessibilityLabel="次の使い方" onPress={() => setIndex(index + 1)} style={[s.button, s.selected]}><Text style={s.white}>次へ →</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => onOpen('大会')} style={[s.button, s.selected]}><Text style={s.white}>大会から始める</Text></Pressable>}
      </View>
    </View>
    <Text style={s.note}>保存について：計画は端末内に自動保存されます。大会の登録・編集は入力欄の保存ボタンで確定します。端末を変える前は「保存」でバックアップを保存してください。</Text>
    <Text style={s.caption}>PCSAPO / マキシ企画</Text>
  </View>;
}
const s = StyleSheet.create({
  page: { gap: 12, width: '100%', maxWidth: 820, alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#173f32' },
  intro: { fontSize: 15, lineHeight: 23, color: '#405b4f' },
  flow: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#eaf0e8', alignItems: 'center' },
  pillText: { color: '#164d3c', fontWeight: '700', fontSize: 15 },
  selected: { backgroundColor: '#164d3c' }, white: { color: '#fff', fontWeight: '700', fontSize: 15 },
  panel: { backgroundColor: '#fff', padding: 16, borderRadius: 16, gap: 12, borderWidth: 1, borderColor: '#dce4da' },
  heading: { fontSize: 20, fontWeight: '700', color: '#173f32' }, body: { fontSize: 16, lineHeight: 25, color: '#263f34' },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: '#f4f6f1' },
  caption: { fontSize: 11, color: '#65756c' },
  tip: { fontSize: 14, lineHeight: 22, backgroundColor: '#edf3eb', padding: 12, borderRadius: 8, color: '#294f3d' },
  button: { flex: 1, minHeight: 44, padding: 12, borderRadius: 10, backgroundColor: '#edf3eb', alignItems: 'center' },
  disabled: { opacity: .35 }, note: { fontSize: 13, lineHeight: 21, color: '#52685b' },
});
