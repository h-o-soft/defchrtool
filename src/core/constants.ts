/**
 * アプリケーション定数
 * DEFCHR TOOL for Web で使用する定数を集約
 */

/** ローカルストレージのキー */
export const STORAGE_KEYS = {
  PCG_DATA: 'defchr-pcgdata',
  EDIT_BUFFER: 'defchr-editbuffer',
  EDITOR_STATE: 'defchr-state',
  FONT_DATA: 'defchr-fontdata'
} as const;

/** X1パレット（RGB値） */
export const X1_PALETTE: [number, number, number][] = [
  [0, 0, 0],       // 0: 黒
  [0, 0, 255],     // 1: 青
  [255, 0, 0],     // 2: 赤
  [255, 0, 255],   // 3: マゼンタ
  [0, 255, 0],     // 4: 緑
  [0, 255, 255],   // 5: シアン
  [255, 255, 0],   // 6: 黄
  [255, 255, 255], // 7: 白
];

/** 編集エリアサイズ */
export const EDITOR_SIZE = {
  DOTS: 16,           // 16x16ドット
  DOT_PIXEL_SIZE: 8,  // 1ドット = 8ピクセル
  CHARS_X: 2,         // 横2文字
  CHARS_Y: 2,         // 縦2文字
} as const;

/** PCG定義エリアサイズ */
export const DEFINITION_SIZE = {
  CHARS_X: 16,        // 横16文字
  CHARS_Y: 16,        // 縦16文字
  TOTAL: 256,         // 全256文字
} as const;

/** ステータスメッセージの表示時間（ms） */
export const STATUS_MESSAGE_DURATION = 2000;

/** 自動保存のデバウンス時間（ms） */
export const AUTO_SAVE_DELAY = 500;

/** BAS形式の行番号開始 */
export const BAS_LINE_START = 60960;
