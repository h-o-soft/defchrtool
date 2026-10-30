# X1Pen host integration, version 1

DEFCHR TOOL は単独でファイルを保存できます。同一 origin の iframe にホストが以下の口を提供した場合に、
PROGRAMMING パネルで指定した出力を X1Pen へ渡します。外部サービスへの取得・送信は追加しません。

## 起動と配布

ホストは子 iframe の最初の module script より前に同期スクリプトを配置し、その子の
`window.X1Host = { exportPCG }` を設定します。別のエディタの window.X1Host とは独立しています。
DEFCHR TOOL は自身の window だけを見て任意検出します。P で開く際にも再検出します。
既に選択した host が消失した場合はエラーとし、出力先を自動で変更しません。

X1Pen は採用する commit SHA を固定し、`npm ci` → `npx vite build --base ./` でビルドします。
資産一式、README.md、commit/sha256 を記載する source.json を `assets/defchrtool/` へ取り込み、
配布時は `dist/defchrtool/`、同じ origin の `/defchrtool/index.html` へ配置します。
このリポジトリの MIT 本文は README.md の「ライセンス」節にあり、独立した LICENSE ファイルはありません。
X1Pen 側で LICENSE を同梱する場合は同節から作成し、README.md のフォント利用条件の参照も保持してください。
上流 GitHub Pages 用の base は `/defchrtool/` のままです。フォントも BASE_URL 配下から読みます。

ホストはタブ初回表示時に iframe を一度作り、切替時は非表示にして同じインスタンスを維持します。
表示時に iframe にフォーカスを渡し、挿入成功時には実際の出力先タブへ切り替えます。

## 受渡しの型

型の定義元は [src/host/X1Host.ts](src/host/X1Host.ts) です。

```ts
interface PCGExportRequest {
  version: 1;
  target: 'fuzzybasic' | 'asm' | 'slang' | 'hubasic';
  format: 'image' | 'bin' | 'bin3' | 'bas' | 'asm' | 'asm3';
  basFormat?: 'asc' | 'bin'; // format=bas のときに指定
  start: number; // inclusive、0..255
  end: number;   // inclusive、start..255
  fileName: string;
  blob: Blob;
  hubasic?: { lineStart: number; lineStep: number }; // target=hubasic のときに指定
}
type PCGExportResult =
  | { ok: true; insertedInto: 'asm' | 'slang' | 'hubasic'; message?: string }
  | { ok: false; code: 'unsupported' | 'invalid' | 'conflict' | 'unavailable'; message: string };

window.X1Host.exportPCG(request): Promise<PCGExportResult>;
```

target はユーザーが明示選択した出力先です。アクティブタブからの推測はしません。
fuzzybasic は ASM へデータを渡すので、成功時の insertedInto は `asm` です。
image は既存形式との型共有のために含みますが、host v1 では送信しません。

Blob は既存のファイル保存と同じ artifact です。テキストは `blob.text()`、バイナリは
`new Uint8Array(await blob.arrayBuffer())` で取得してください。
iframe と親ではコンストラクタが異なるため `instanceof Blob` 等では検証しません。
`typeof blob.arrayBuffer === 'function'` 等の形と必要なプロパティで確かめます。
戻り値も形で検証します。メソッドは X1Host を this として呼びます。

## 推奨形式と手動選択

| target | 自動選択 | 実挿入先 | 順序 |
| --- | --- | --- | --- |
| fuzzybasic | asm3 | ASM の DB | 文字ごとに B0,R0,G0,...,B7,R7,G7 |
| asm | asm3 | ASM の DB | 同上 |
| slang | bin3 | SLANG の ARRAY BYTE | 同上 |
| hubasic | bas / asc | 行番号付き DEFCHR$=HEXCHR$ | 文字ごとに B[8],R[8],G[8] |

出力先を変更したときだけ推奨形式を設定し、その後の手動変更を保持します。
PCGDEF 呼出しやメモリアドレスの割当は生成しません。

| 手動選択 | fuzzybasic / asm | slang | hubasic |
| --- | --- | --- | --- |
| asm / asm3 | テキストを ASM へそのまま挿入 | テキストをそのまま挿入 | 非対応 |
| bas / asc | テキストをそのまま挿入 | テキストをそのまま挿入 | DEFCHR$ 行を取り込む |
| bin / bin3 | ホストで DB 数値列へ整形 | ホストで ARRAY BYTE へ整形 | 非対応 |
| bas / bin、image | 非対応 | 非対応 | 非対応 |

非推奨テキストの言語としての有効性は利用側で扱います。
非対応の組合せは送信前に説明を表示します。全形式は「ファイル保存」で引き続き選択できます。
BIN は面順、BIN(x3) は行順を維持し、ホストで再インターリーブしません。
1文字24 bytes、start..end の昇順です。

SLANG の構文と命名はホストが担当します。例は `ARRAY BYTE PCG41[] = { … };`。
開始コードを使った名前に、既存名と衝突する場合は `_2` 等を付けます。
ホストは1文字分を1行とし、文字コードを `// $41` のように付記します。
DEFCHR TOOL は配列名を付けません。

## HuBASIC

開始行は60960、ステップは10。両方を正の整数とし、最後の行は65529以下です。
1文字につき1行、RETURN は付けません。ファイル保存の既定行番号は変えません。
元の ASCII は CR 区切りです。ホストが CR/CRLF/LF を論理行に正規化します。

同番号の既存行がすべて同じ文字コードの DEFCHR$ なら置換できます。
別の文字や別の文と一つでも衝突した場合は conflict として全体を拒否し、何も変更しません。
全行を組み立ててから番号順に一回で差し替えます。
**HuBASIC の差し替えは Undo 履歴を消すため、Ctrl+Z で戻せません。**
ASM/SLANG は一回の挿入として、Ctrl+Z 一回で戻せます。

## 成功・失敗・待機

ホストは確認ダイアログで止めず、Promise を必ず決着させます。
RUN 中や自動操作中は unavailable を返します。
ok:true は指定先への適用と通常の保存処理を受け付けた後に返します。
ok:false は全検証・衝突検査の結果、何も変更しなかった場合だけ返してください。
部分書込みはしません。検証後に一回のエディタ更新で適用してください。

message は利用者向け日本語で、そのまま textContent で表示します。
成功 message が省略された場合は DEFCHR TOOL が文言を表示します。
不正な応答や例外は反映状態不明として、挿入先の確認を促します。
自動再送・自動ダウンロード・応答タイムアウトによる結果の推測はしません。

送信待ちは出力設定・EXEC・CANCEL と Esc を無効化し、多重送信を防ぎます。
成功するとパネルを閉じ、失敗時はパネルと入力を残します。
応答が戻らない場合は挿入先を確認したうえで iframe/ページを再読み込みしてください。
再読み込みは送信取消を保証せず、自動再送もしません。復帰する絵は既存の自動保存済み状態です。

## 設定と描画データの保存

同じ iframe でパネルを開き直した場合、配信方法・出力先・形式・BASサブ形式・行番号は保持します。
SAVE/LOAD は SAVE に、文字コード範囲は00..FFに戻します。
reload 後は X1Pen/出力先未選択/IMAGE/ASC/60960/10 へ初期化します。
これら出力設定の永続化は追加していません。

描いた PCG、編集中バッファ、状態、フォントの保存キーと500ms自動保存は既存のままです。
出力はデータのコピーを読み、絵を消去・再定義しません。
origin が異なる GitHub Pages と X1Pen のデータは自動共有しません。
保存待ち中の即時終了、localStorage の容量や削除には従来どおりの制約があります。
逆向きの読み込みは今回の契約に含めず、将来別の口として追加します。

## 検証範囲

`npm test` は形式のバイト順・行番号境界・host の検出と応答の形を確認します。
`npm run test:browser` はビルド済みファイルを配信し、Chrome で単独と同一 origin iframe の
推奨選択・ファイル保存・エラー表示・待機・設定保持・自動保存復元を確認します。
ホスト部分はスタブです。X1Pen の実エディタ・言語パーサ・Undo・RUN状態との結合は X1Pen 側で検証します。
