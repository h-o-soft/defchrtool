/**
 * 入力イベント型定義（Discriminated Union）
 * 各イベントタイプに対応する型安全なデータ構造を提供
 */

import { Direction, X1Color } from '../core/types';

/** 入力モード */
export type InputMode =
  | 'edit'      // 通常編集モード
  | 'editchr'   // EDIT CHR.（文字コード入力待ち）
  | 'setchr'    // SET CHR.（文字コード入力待ち）
  | 'menu';     // メニュー表示中

/** 入力モード（キーボード/マウス） */
export type InputDeviceMode = 'keyboard' | 'mouse';

/** ファイルフォーマット */
export type FileFormat = 'image' | 'bin' | 'bin3' | 'bas';

/** 減色モード */
export type ColorReduceMode = 'none' | 'reduce' | 'dither' | 'edfs' | 'retro';

/** ROTATIONの種類 */
export type RotationType =
  | 'right'    // 0: 右（左に移動）
  | 'left'     // 1: 左（右に移動）
  | 'up'       // 2: 上に移動
  | 'down'     // 3: 下に移動
  | 'rot90'    // 4: 90度反時計回り
  | 'rot180'   // 5: 180度回転
  | 'flipH'    // 6: 上下フリップ
  | 'flipV';   // 7: 左右フリップ

/** BAS保存形式 */
export type BasSaveFormat = 'asc' | 'bin';

/** TRANSFER操作のパラメータ */
export interface TransferParams {
  start: number;
  end: number;
  target: number;
}

/** ファイル操作のパラメータ */
export interface FileParams {
  format: FileFormat;
  start: number;
  end: number;
  basLoadMode?: 'start' | 'original';
  reduceMode?: ColorReduceMode;
  basFormat?: BasSaveFormat;
}

/** マウス座標（ドット座標） */
export interface MouseDotPosition {
  dotX: number;
  dotY: number;
}

/**
 * Discriminated Union型の入力イベント
 * 各イベントタイプに固有のデータ構造を持つ
 */
export type InputEvent =
  | { type: 'cursor-move'; data: { direction: Direction; fast: boolean } }
  | { type: 'draw-dot'; data: { color: X1Color } }
  | { type: 'color-select'; data: { color: X1Color } }
  | { type: 'toggle-draw' }
  | { type: 'toggle-grid' }
  | { type: 'mode-change' }
  | { type: 'direction-change' }
  | { type: 'edit-chr'; data: { charCode: number } }
  | { type: 'set-chr'; data: { charCode: number } }
  | { type: 'load-chr'; data: { source: 'rom' | 'ram'; charCode: number } }
  | { type: 'rotation'; data: { rotationType: RotationType } }
  | { type: 'transfer'; data: { transfer: TransferParams } }
  | { type: 'clear' }
  | { type: 'color-change'; data: { colorMap: number[] } }
  | { type: 'toggle-input-mode' }
  | { type: 'mouse-draw'; data: { mousePos: MouseDotPosition } }
  | { type: 'file-save'; data: { file: FileParams } }
  | { type: 'file-load'; data: { file: FileParams } }
  | { type: 'toggle-width' }
  | { type: 'load-font' }
  | { type: 'home' }
  | { type: 'cancel' };

/** 入力イベントのタイプ一覧（型推論用） */
export type InputEventType = InputEvent['type'];

/** 入力イベントコールバック */
export type InputEventCallback = (event: InputEvent) => void;
