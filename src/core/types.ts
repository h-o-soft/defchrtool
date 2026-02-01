/**
 * X1 DEFCHR TOOL for Web - 型定義
 */

/** X1のテキストVRAMサイズ */
export const TEXT_VRAM_SIZE = 2000; // 80x25

/** X1の解像度 */
export const X1_WIDTH = 640;
export const X1_HEIGHT = 200;

/** フォントサイズ */
export const FONT_WIDTH = 8;
export const FONT_HEIGHT = 8;

/** 画面モード */
export type ScreenMode = 'WIDTH40' | 'WIDTH80';

/** 色定義（X1の8色） */
export const X1_COLORS = {
  BLACK: 0,
  BLUE: 1,
  RED: 2,
  MAGENTA: 3,
  GREEN: 4,
  CYAN: 5,
  YELLOW: 6,
  WHITE: 7
} as const;

export type X1Color = typeof X1_COLORS[keyof typeof X1_COLORS];

/** RGB値への変換 */
export const X1_COLOR_RGB: Record<X1Color, [number, number, number]> = {
  [X1_COLORS.BLACK]: [0, 0, 0],
  [X1_COLORS.BLUE]: [0, 0, 255],
  [X1_COLORS.RED]: [255, 0, 0],
  [X1_COLORS.MAGENTA]: [255, 0, 255],
  [X1_COLORS.GREEN]: [0, 255, 0],
  [X1_COLORS.CYAN]: [0, 255, 255],
  [X1_COLORS.YELLOW]: [255, 255, 0],
  [X1_COLORS.WHITE]: [255, 255, 255]
};

/** PCGデータ（8バイト = 1文字） */
export interface PCGCharacter {
  /** キャラクタコード */
  code: number;
  /** 8x8のビットマップデータ */
  data: Uint8Array;
}

/** イベントタイプ */
export type EventType =
  | 'pcg-updated'
  | 'cursor-moved'
  | 'screen-refresh'
  | 'mode-changed';

/** イベントハンドラ */
export type EventHandler<T = unknown> = (data: T) => void;

/** 編集モード（EDIT MODE） */
export enum EditMode {
  /** 4Chr.ベツベツ - 2x2のエリアを無関係の4文字として扱う */
  SEPARATE = 0,
  /** タテ2Chr. - 縦2文字を1組として扱う */
  VERTICAL = 1,
  /** ヨコ2Chr. - 横2文字を1組として扱う */
  HORIZONTAL = 2,
  /** 4Chr.スベテ - 4文字全てを1つの画像として扱う */
  ALL = 3
}

/** 位置を表すインターフェース */
export interface Position {
  x: number;
  y: number;
}

/** カーソル移動方向 */
export enum Direction {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right'
}

/** エディタの状態 */
export interface EditorState {
  /** 現在の編集モード */
  editMode: EditMode;
  /** カーソル位置（ドット座標: 0-15, 0-15） */
  cursorPosition: Position;
  /** 選択中の色（0-7） */
  currentColor: X1Color;
  /** 最後のカーソル移動方向 */
  lastDirection: Direction;
  /** 現在編集中の基準キャラクターコード */
  currentCharCode: number;
  /** マウスモードか */
  mouseMode: boolean;
  /** EDIT CHR.で最後に入力した文字コード（表示用） */
  editChrCode: number;
}

/** PCGデータのバイト定数 */
export const PCG_BYTES_PER_PLANE = 8;
export const PCG_PLANES = 3; // B, R, G
export const PCG_BYTES_PER_CHAR = PCG_BYTES_PER_PLANE * PCG_PLANES; // 24
export const PCG_TOTAL_CHARS = 256;
export const PCG_TOTAL_BYTES = PCG_BYTES_PER_CHAR * PCG_TOTAL_CHARS; // 6144

/** X1 罫線文字コード */
export const X1_BOX_CHARS = {
  HORIZONTAL: 0x90,   // ─ 横線
  VERTICAL: 0x91,     // │ 縦線
  CROSS: 0x96,        // ┼ 十字
  TOP_RIGHT: 0x98,    // ┐ 右上角
  BOTTOM_RIGHT: 0x99, // ┘ 右下角
  BOTTOM_LEFT: 0x9A,  // └ 左下角
  TOP_LEFT: 0x9B      // ┌ 左上角
} as const;

/** X1 矢印文字コード */
export const X1_ARROW_CHARS = {
  RIGHT: 0x1C,  // →
  LEFT: 0x1D,   // ←
  UP: 0x1E,     // ↑
  DOWN: 0x1F    // ↓
} as const;
