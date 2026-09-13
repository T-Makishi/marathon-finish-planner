import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

const steps = [
  { title: '大会を選ぶ', image: require('../../assets/guide/race.jpg'), alt: '大会画面：大会を選択するボタンと保存済み計画の一覧', body: '「大会を選択する」で大会を探します。初めての方は、保存済みのサンプルを選んで試せます。', tip: '大会の日付・距離・関門は、最新の公式要項で確認してください。', destination: '大会' },
  { title: '目標と走り方を決める', image: require('../../assets/guide/plan.jpg'), alt: '計画画面：目標時間とペース配分の設定', body: '「計画」で目標時間を選びます。最初は「一定ペース」で試し、必要に応じて前半・後半の配分を変更します。', tip: 'ネット＝スタートライン通過から。号砲＝大会のスタート合図から。', destination: '計画' },
  { title: 'カードを印刷して持参する', image: require('../../assets/guide/card.jpg'), alt: 'カード画面：印刷するカードと挑戦・本命・堅実の比較目標', body: '印刷プレビューは、紙に出る内容を先に確かめる画面です。知りたい項目を開くと、選び方と操作手順を確認できます。', tip: 'A4・倍率100%で印刷。本番案＋3案比較は外周を切り、中央は切らずに二つ折りにします。', destination: 'カード' },
] as const;
const printTopics = [
  { title: '1. 印刷するカードは3種類', lines: [
    ['本番案だけ', '「計画」で決めた走り方の累計時間を1列で印刷します。初めての方は、まずこちらを選ぶと確認しやすくなります。'],
    ['3案比較だけ', '挑戦・本命・堅実の3つの目標を横に並べます。挑戦は好条件で狙う目標、本命は比較の中心、堅実は状況に応じて切り替える目標です。'],
    ['本番案＋3案比較', '本番案と比較の両方を出します。ポケット用では表裏になる2面をつなげます。手首用では別々に切り取ります。'],
    ['比較目標の設定', '時間・分・秒を選び、挑戦→本命→堅実の順に時間を長くします。「本番案の目標を本命にして±5分で設定」なら、例として4時間を中心に3時間55分・4時間・4時間5分を設定できます。比較目標は本番案と別に設定できます。'],
  ] },
  { title: '2. ポケット用・手首用と折り方', lines: [
    ['ポケット（幅85mm・高さ自動）', '累計時間に加えて、ペース配分や移動平均も載せます。高さは情報量に合わせて135〜195mmに自動調整します。'],
    ['2面つながったカード', '外周の破線だけを切り取り、中央の実線は切らず、印刷面が外側になるよう山折りにします。左右は長い面の高さに揃います。続きの1/2・2/2も表裏として使えます。'],
    ['手首用', '本番案は幅50mm、3目標比較は幅70mm、高さ180〜195mmの細長いカードです。配分説明・移動平均は省きます。「本番案だけ」は累計時間1列、「3案比較だけ」は3列です。両方を選んだ場合も、外周をそれぞれ切り取ります。'],
    ['収まりきらない場合', '文字を小さくせず、続きの面へ分けます。ポケット用は2面ずつつなぎ、最後が1面だけなら単独で切り取ります。カードに書かれた分割番号を確認してください。'],
  ] },
  { title: '3. 累計時間・関門・勧告の読み方', lines: [
    ['ネット累計で印刷', '自分がスタートラインを通過してからの経過時間です。スタートラインで計測を始める時計と照らし合わせます。'],
    ['号砲からの累計で印刷', '大会のスタート合図からの経過時間です。スタート待ちの時間も含みます。比較目標の入力基準は、目標欄の上の説明で確認してください。'],
    ['関門・中止勧告は時計の時刻', '黒背景・白文字の「関門 12:15」「勧告 10:25」は経過時間ではありません。「勧告」は競技中止勧告の略です。例えば9時号砲で累計1:20:00なら、到着予定は10時20分です。'],
    ['携帯カードに関門を表示', 'ONにすると登録済みの関門・勧告地点をカードに追加します。制限完走の計画では表示されます。大会情報は必ず最新の公式要項と照合してください。'],
  ] },
  { title: '4. 必要な追加資料を選ぶ', lines: [
    ['関門・制限時間の確認表を追加', '締切時刻・通過予定時刻・残りの余裕を詳しく確認する資料です。携帯カードの関門表示とは別の設定です。'],
    ['補給・停止の計画を追加', '停止地点・停止時間・メモを印刷します。'],
    ['コース補正の設定表を追加', '補正区間・秒/kmの調整・メモを印刷します。補正がOFFでも、登録した設定表は出力できます。'],
    ['紙を節約するには', '持参するカードだけでよければ、追加資料はOFFにします。内容が少ない資料は同じ用紙へ自動でまとめます。未登録の資料は追加ページを作りません。'],
  ] },
  { title: '5. プレビューで確認すること', lines: [
    ['「前へ」「次へ」で全ページを見る', '「1 / 3 ページ」はA4用紙3ページのうち1ページ目という意味です。「携帯カード1枚／追加資料2ページ」なら、切り取るカードは1枚でも印刷用紙は合計3ページになる場合があります。'],
    ['「拡大して確認」と「A4全体」', '拡大すると細かい文字を読みやすくできます。「A4全体」で用紙全体の表示に戻ります。この切り替えは画面の見え方だけで、印刷サイズやページ数は変わりません。'],
    ['大会名・目標・時間基準・ゴールまで確認', '地点の抜け、関門・勧告時刻、文字の重なり、切り取り線・折り線を確認します。カード内の「1/2・2/2」はカードの続きの番号で、A4用紙のページ数とは別です。'],
  ] },
  { title: '6. 印刷・PDF保存の手順', lines: [
    ['アプリから印刷画面へ', '「この内容を印刷・PDF・共有（○ページ）」を押します。Web版では開いた画面の「この内容を印刷・PDF保存」へ進みます。ボタンが押せないときは、カード画面のエラー表示を確認して目標や入力内容を修正してください。'],
    ['パソコンの印刷設定', '用紙はA4縦、倍率は100%（実際のサイズ）、ヘッダーとフッターはOFFにします。二つ折りカードは片面印刷して折ります。背景の印刷設定がある場合はONにし、関門の黒背景が出ることを確認してください。'],
    ['スマートフォンの印刷設定', '印刷画面でプリンタ・用紙・ページ数を確認します。項目名や倍率設定の有無は端末によって異なります。倍率を選べる場合は100%にします。'],
    ['PDFで残す・共有する', '印刷画面にPDF保存があれば選びます。スマートフォンでは共有メニューからファイル保存できる場合があります。表示されない場合はパソコンでPDF保存し、スマートフォンへ送れます。'],
    ['印刷した紙で最後に確認', '用紙の「50mm」の目盛りを定規で測ります。5cmになっていることと、関門時刻・小さい文字の読みやすさを確認してから切り取ります。余分なページがあれば、まずアプリの追加資料の設定を見直してください。'],
  ] },
] as const;
function PrintHelp() {
  const [open, setOpen] = useState<number | null>(null);
  return <View style={{ gap: 10 }}>
    <Text style={s.tip}>① 内容を選ぶ → ② サイズ・時間基準を選ぶ → ③ 全ページを確認 → ④ 印刷して切り取る</Text>
    {printTopics.map((topic, i) => <View key={topic.title} style={s.topic}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === i }} onPress={() => setOpen(open === i ? null : i)} style={s.topicButton}>
        <Text style={[s.pillText, { flex: 1 }]}>{topic.title}</Text><Text style={s.pillText}>{open === i ? '−' : '＋'}</Text>
      </Pressable>
      {open === i && <View style={s.topicBody}>{topic.lines.map(([title, body]) => <View key={title} style={{ gap: 4 }}><Text style={s.pillText}>{title}</Text><Text style={s.body}>{body}</Text></View>)}
        {i === 1 && <><Image source={require('../../assets/guide/print-fold.png')} accessibilityLabel="実際の印刷出力例。左右同じ高さの2面を外周の破線で切り取り、中央の実線で折る" resizeMode="contain" style={{ width: '100%', aspectRatio: 210 / 297 }} /><Text style={s.caption}>実際の印刷出力例（説明用のサンプル設定。大会の時刻表ではありません）</Text></>}
      </View>}
    </View>)}
  </View>;
}
export default function UserGuide({ onOpen, initialStep = 0 }: { initialStep?: number; onOpen: (tab: '大会' | '計画' | 'カード') => void }) {
  const [index, setIndex] = useState(initialStep);
  const step = steps[index];
  return <View style={s.page}>
    <Text accessibilityRole="header" style={s.title}>使い方</Text>
    <Text style={s.intro}>大会前に計画して、紙のカードを持って走るアプリです。</Text>
    <View style={s.flow}>{steps.map((item, i) => <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={`手順${i + 1}：${item.title}`} accessibilityState={{ selected: index === i }} onPress={() => setIndex(i)} style={[s.pill, i === index && s.selected]}><Text style={[s.pillText, i === index && s.white]}>{i + 1} {item.destination}</Text></Pressable>)}</View>
    <View style={s.panel}>
      <Text accessibilityRole="header" style={s.heading}>{index + 1} / 3　{step.title}</Text>
      <Text style={s.body}>{step.body}</Text>
      {index !== 2 && <><View style={s.image}><Image source={step.image} accessibilityLabel={step.alt} resizeMode="contain" style={{ position: 'absolute', width: '100%', height: '100%' }} /></View>
      <Text style={s.caption}>実際のアプリ画面（使い方サンプル）</Text>
      <Text style={s.tip}>{step.tip}</Text></>}
      {index === 2 && <><PrintHelp /><Pressable accessibilityRole="button" onPress={() => onOpen('カード')} style={[s.button, s.selected]}><Text style={s.white}>カード画面で試す</Text></Pressable></>}
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
  topic: { borderWidth: 1, borderColor: '#dce4da', borderRadius: 10, overflow: 'hidden' },
  topicButton: { flexDirection: 'row', gap: 8, padding: 14, minHeight: 48, backgroundColor: '#f3f6f0' },
  topicBody: { padding: 14, gap: 16 },
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
