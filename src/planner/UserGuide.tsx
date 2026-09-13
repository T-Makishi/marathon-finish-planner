import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

const steps = [
  { title: '大会を選ぶ', image: require('../../assets/guide/race.jpg'), alt: '大会画面：大会を選択するボタンと保存済み計画の一覧', body: '「大会を選択する」で大会を探します。初めての方は、保存済みのサンプルを選んで試せます。', tip: '大会の日付・距離・関門は、最新の公式要項で確認してください。', destination: '大会' },
  { title: '目標と走り方を決める', image: require('../../assets/guide/plan.jpg'), alt: '計画画面：目標時間とペース配分の設定', body: '「計画」で目標時間を選びます。最初は「一定ペース」で試し、必要に応じて前半・後半の配分を変更します。', tip: 'ネット＝スタートライン通過から。号砲＝大会のスタート合図から。', destination: '計画' },
  { title: 'カードを印刷して持参する', image: require('../../assets/guide/card.jpg'), alt: 'カード画面：印刷するカードと挑戦・本命・堅実の比較目標', body: '印刷プレビューは、紙に出る内容を先に確かめる画面です。知りたい項目を開くと、選び方と操作手順を確認できます。', tip: 'A4・倍率100%で印刷。本番案＋3案比較は外周を切り、中央は切らずに二つ折りにします。', destination: 'カード' },
] as const;
type GuideTopic = { title: string; lines: readonly (readonly [string, string])[] };
const raceTopics: GuideTopic[] = [
  { title: '1. 初めてならサンプルで試す', lines: [
    ['保存済みの計画を選ぶ', '「大会」の「計画を選ぶ」にある保存済み一覧から選びます。選択中の大会名と計画名を確認してください。'],
    ['サンプルは練習用', '初回のサンプルは架空の大会です。まず「計画」で目標を変え、「カード」で結果を見ると操作を試せます。実際のレースには参加する大会を登録して使います。'],
    ['サンプルを消した場合', 'サンプルがなくても「大会を選択する」または「大会を新規登録」から始められます。'],
  ] },
  { title: '2. 登録されている大会を探す', lines: [
    ['「大会を選択する」を押す', '都道府県・距離種別を選び、必要なら大会名を入力して絞り込みます。大会名を押すと開催日や関門などの詳細が開きます。'],
    ['年・種目・スタートを確認', '同じ大会でも開催年や距離が違うことがあります。参加区分の選択がある大会は、自分のスタート時刻を選んでください。「公式情報を確認する」で参加案内と照合します。'],
    ['「この大会・種目で計画を作る」を押す', '大会情報を取り込んだ新しい計画が作られます。画面上部の大会名を確認し、「計画」で目標を設定します。'],
    ['見つからないとき', '都道府県を「全国」に戻す、検索語を短くするなど、条件を減らして探します。全国すべての大会を収録しているわけではありません。なければ一覧を閉じて「大会を新規登録」を使います。'],
  ] },
  { title: '3. 自分で大会を登録する', lines: [
    ['「大会を新規登録」を押す', '大会名と計画名を入力します。計画名は「完走目標」「4時間目標」など、後から見分けられる名前にします。'],
    ['日付・距離・号砲を選ぶ', '開催日はカレンダーから選び、距離や時刻は数字の選択欄で設定します。ハーフという名称だけで距離を決めず、公式の距離を使ってください。'],
    ['完走制限は経過時間', '例：号砲9:00、終了15:00なら、完走制限は6:00:00です。終了時刻の15:00をそのまま入れないでください。'],
    ['「この大会・計画を登録」で確定', '登録後、入力欄は空に戻り閉じます。保存済みの一覧に残り、「選択中」に大会が表示されれば登録できています。'],
  ] },
  { title: '4. 関門・停止・コース補正を設定する', lines: [
    ['必要な見出しを押して開く', '「関門」「給水・補給などの停止」「コースによるペース補正」は折りたたみ式です。初めは必要な項目だけ開きます。'],
    ['関門', '公式案内を見て地点の距離・締切の時刻・区分を登録します。完走制限とは違い、例えば12時15分なら「12:15」と時計の時刻を設定します。'],
    ['給水・補給などの停止', '「停止を追加」で、例として停止地点5km・停止時間20秒・メモ「給水」を設定します。同じ地点に関門がある場合は「同地点の関門を通過してから停止」の設定も確認します。'],
    ['コースによるペース補正', '「補正区間を追加」で開始・終了距離と補正秒数を選びます。例：5〜6kmで＋10秒/kmなら、その区間を遅くする設定です。高低差からの自動推定ではありません。「計画に補正を適用」をONにすると計算に使います。'],
  ] },
  { title: '5. 保存・編集・削除の違い', lines: [
    ['大会名や日付を直したい', '「選択中の大会情報を編集」で開き、変更後は「大会情報の変更を保存」を押します。保存前の入力をやめる場合は「入力を取り消す」を押します。'],
    ['関門・停止・補正を保存', 'これらは自動保存されます。下部の「この計画を保存」を押して「端末に保存済み」を確認すると安心です。'],
    ['不要な計画を片付ける', '「この計画を削除済みに移す」で一覧から外します。「保存」内の削除済みの計画から復元できます。完全削除すると復元できません。'],
    ['端末を変える前に', '計画は使っている端末・ブラウザに保存されます。「保存」でバックアップを保存し、新しい端末で復元してください。'],
  ] },
];
const planTopics: GuideTopic[] = [
  { title: '1. 目標の決め方を選ぶ', lines: [
    ['目標タイム', '「タイムで入力」なら、例として4時間・0分・0秒を選びます。「平均ペースで入力」なら、1kmあたり何分何秒で移動するかを選びます。停止時間は別に加算します。'],
    ['自己ベスト更新', '今の自己ベストと短縮したい秒数を設定します。例：自己ベスト4時間、短縮60秒なら、目標は3時間59分です。'],
    ['制限時間内の完走', '「締切に残す余裕（分）」を選びます。登録した正式関門・完走制限から配分を計算します。任意の「走れる最速ペース」は自分の条件として入力します。完走の保証ではないため、警告や勧告時刻も確認してください。'],
  ] },
  { title: '2. ネット・号砲・スタートの遅れ', lines: [
    ['ネットタイム', '自分がスタートラインを通過してからゴールするまでの時間です。'],
    ['号砲からのタイム', '大会の開始合図からゴールまでの時間です。号砲が鳴ってからラインを通過するまでの遅れも含みます。'],
    ['「スタートの遅れを設定」を開く', '大会号砲を確認し、「号砲後ライン通過まで（分）」を選びます。例：9:00号砲、9:10にライン通過なら10分です。ウェーブスタートの場合だけ「ウェーブ号砲」も設定し、その号砲からライン通過までの遅れを入力します。'],
    ['入力基準と印刷基準', 'この画面は目標を何の時間として入力するかを決めます。「カード」では印刷に使う時間基準を別に選べます。どちらの画面でも見出しを確認してください。'],
  ] },
  { title: '3. 6種類のペース配分を選ぶ', lines: [
    ['一定ペース', '移動中のペースを一定にする基本設定です。初めてなら、まずこれを選んで結果を確認します。'],
    ['後半を5分速く／後半を10分速く', '後半にかかる時間を前半より5分または10分短くする設定です。目標全体から5分・10分を引く意味ではありません。'],
    ['後半を5分遅く／後半を10分遅く', '後半にかかる時間を前半より5分または10分長くする設定です。後半の減速を計画に含めたいときに使います。'],
    ['自分で設定', '前後半の差や区間ごとのペースを直接指定します。「前半より後半を短くする秒数」は300なら5分速く、−300なら5分遅くなります。'],
    ['制限完走の場合', '「一定ペース」「自分で設定」を使います。自分で設定する場合は区間指定を使い、前後半差は使用しません。'],
  ] },
  { title: '4. 坂や区間ペースを反映する', lines: [
    ['区間の補正を使う', '大会画面で補正区間を設定し、適用をONにします。上り下りの距離だけでは自動計算されないので、自分で秒/kmの調整を設定してください。'],
    ['目標タイムを維持', '坂で遅くする区間などを設定した分、指定していない区間を調整して目標に合わせます。他の区間が速くなりすぎていないか確認してください。'],
    ['他の区間を維持', '指定していない区間をそのままにするため、予定フィニッシュが変わります。変更後は画面上部の時間を確認します。'],
    ['区間を直接指定する', '「自分で設定」→「区間ペースを追加」で開始km・終了km・ペースを選びます。まず1区間だけ設定し、通過予定の変化を確認すると分かりやすくなります。'],
  ] },
  { title: '5. 計算結果を確認してカードへ', lines: [
    ['画面上部の予定フィニッシュ', '設定を変えると計算結果が更新されます。目標の基準、移動平均、前半・後半の時間を確認します。移動平均は停止を除いた走行中のペースです。'],
    ['通過予定の2つの時間', '「累計時間」はスタートライン通過からの経過時間、「通過時刻」は時計の時刻です。「1km・関門・停止地点も表示」で詳しい地点も確認できます。'],
    ['警告と関門の余裕', '警告が出たら、目標・スタートの遅れ・停止時間・大会情報を見直します。関門を非表示にしても締切の確認は行われます。'],
    ['「早見カードを作る」へ進む', '計画の変更は自動保存されます。「端末に保存済み」を確認してカード画面へ進み、印刷する内容を選んでください。'],
    ['別案を残したいとき', '「この計画を複製して比較する」を押すとコピーを作れます。元の案を残して、別の目標や配分を試せます。'],
  ] },
];
function LearningHelp({ kind }: { kind: 0 | 1 }) {
  const [open, setOpen] = useState<number | null>(null);
  const topics = kind === 0 ? raceTopics : planTopics;
  const flow = kind === 0 ? ['大会を探す／新規登録', '開催年・距離・号砲・関門を確認', '保存して「計画」へ'] : ['目標と時間基準を選ぶ', '配分・スタートの遅れを設定', '通過予定を確認して「カード」へ'];
  return <View style={{ gap: 10 }}>
    <View accessibilityLabel="操作の流れ" style={s.diagram}>{flow.map((label, i) => <View key={label} style={{ alignItems: 'center', width: '100%' }}><Text style={s.diagramBox}>{i + 1}　{label}</Text>{i < flow.length - 1 && <Text style={s.arrow}>↓</Text>}</View>)}</View>
    {topics.map((topic, i) => <View key={topic.title} style={s.topic}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === i }} onPress={() => setOpen(open === i ? null : i)} style={s.topicButton}><Text style={[s.pillText, { flex: 1 }]}>{topic.title}</Text><Text style={s.pillText}>{open === i ? '−' : '＋'}</Text></Pressable>
      {open === i && <View style={s.topicBody}>
        {topic.lines.map(([title, body]) => <View key={title} style={{ gap: 4 }}><Text style={s.pillText}>{title}</Text><Text style={s.body}>{body}</Text></View>)}
        {((kind === 0 && i === 0) || (kind === 1 && i === 0)) && <><View style={s.image}><Image source={steps[kind].image} accessibilityLabel={steps[kind].alt} resizeMode="contain" style={{ width: '100%', height: '100%' }} /></View><Text style={s.caption}>実際のアプリ画面（使い方サンプル）</Text></>}
        {kind === 1 && i === 1 && <View style={s.diagram}><Text style={s.pillText}>例：9:00号砲・10分後にライン通過</Text><Text style={s.diagramBox}>9:00　大会号砲</Text><Text style={s.arrow}>↓ スタート待ち 10分</Text><Text style={s.diagramBox}>9:10　スタートライン通過</Text><Text style={s.arrow}>↓ ネットタイム 4時間</Text><Text style={s.diagramBox}>13:10　ゴール</Text><Text style={s.tip}>ネット：4:00:00{'\n'}号砲から：4:10:00</Text></View>}
        {kind === 0 && i === 2 && <View style={s.diagram}><Text style={s.diagramBox}>大会情報を入力</Text><Text style={s.arrow}>↓ 「この大会・計画を登録」</Text><Text style={s.diagramBox}>保存済みの一覧に追加</Text><Text style={s.tip}>入力欄が空に戻っても、登録した計画は一覧に残ります。</Text></View>}
      </View>}
    </View>)}
  </View>;
}
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
      {index !== 2 && <><LearningHelp key={index} kind={index as 0 | 1} /><Pressable accessibilityRole="button" onPress={() => onOpen(index === 0 ? '大会' : '計画')} style={[s.button, s.selected]}><Text style={s.white}>{index === 0 ? '大会画面で試す' : '計画画面で試す'}</Text></Pressable></>}
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
  diagram: { gap: 6, padding: 12, borderRadius: 10, backgroundColor: '#edf3eb' },
  diagramBox: { width: '100%', padding: 10, borderRadius: 8, backgroundColor: '#fff', color: '#164d3c', fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 21 },
  arrow: { color: '#405b4f', fontSize: 14, lineHeight: 23, textAlign: 'center' },
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
