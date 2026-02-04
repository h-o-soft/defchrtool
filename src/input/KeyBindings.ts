/**
 * キーバインディング定義
 * キーコードからアクションへのマッピングをデータ駆動化
 */

import { Direction, X1Color } from '../core/types';
import { RotationType } from './InputEventTypes';

/** 修飾キーの状態 */
export interface Modifiers {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

/** キーアクションの種類 */
export type KeyAction =
  | { action: 'cursor-move'; direction: Direction; fast: boolean }
  | { action: 'draw-color'; color: X1Color }
  | { action: 'toggle-draw' }
  | { action: 'home' }
  | { action: 'mode-change' }
  | { action: 'edit-chr' }
  | { action: 'color-change' }
  | { action: 'set-chr' }
  | { action: 'direction-change' }
  | { action: 'toggle-grid' }
  | { action: 'rotation' }
  | { action: 'transfer' }
  | { action: 'programming' }
  | { action: 'toggle-input-mode' }
  | { action: 'toggle-width' }
  | { action: 'load-font' }
  | { action: 'cancel' }
  | { action: 'clear' };

/** キーバインディングエントリ */
interface KeyBindingEntry {
  codes: string[];
  action: KeyAction;
  requireCtrl?: boolean;
  requireShift?: boolean;
  allowRepeat?: boolean;
}

/**
 * 基本キーバインディング定義
 * 注: カーソル移動と数字キーは動的に処理するため含まない
 */
const KEY_BINDINGS: KeyBindingEntry[] = [
  // 機能キー
  { codes: ['Space'], action: { action: 'toggle-draw' } },
  { codes: ['Home'], action: { action: 'home' } },
  { codes: ['KeyM'], action: { action: 'mode-change' } },
  { codes: ['KeyE'], action: { action: 'edit-chr' } },
  { codes: ['KeyC'], action: { action: 'color-change' } },
  { codes: ['KeyS'], action: { action: 'set-chr' } },
  { codes: ['KeyD'], action: { action: 'direction-change' } },
  { codes: ['KeyG'], action: { action: 'toggle-grid' } },
  { codes: ['KeyR'], action: { action: 'rotation' } },
  { codes: ['KeyT'], action: { action: 'transfer' } },
  { codes: ['KeyP'], action: { action: 'programming' } },
  { codes: ['KeyK'], action: { action: 'toggle-input-mode' } },
  { codes: ['KeyW'], action: { action: 'toggle-width' } },
  { codes: ['KeyL'], action: { action: 'load-font' } },
  { codes: ['Escape'], action: { action: 'cancel' } },

  // Ctrl+L: CLR
  { codes: ['KeyL'], action: { action: 'clear' }, requireCtrl: true },
];

/** カーソル移動キーの定義 */
const CURSOR_KEYS: Record<string, Direction> = {
  'ArrowUp': Direction.UP,
  'ArrowDown': Direction.DOWN,
  'ArrowLeft': Direction.LEFT,
  'ArrowRight': Direction.RIGHT,
};

/** 数字キーから色へのマッピング */
const COLOR_KEYS: Record<string, X1Color> = {
  'Digit0': 0 as X1Color,
  'Numpad0': 0 as X1Color,
  'Digit1': 1 as X1Color,
  'Numpad1': 1 as X1Color,
  'Digit2': 2 as X1Color,
  'Numpad2': 2 as X1Color,
  'Digit3': 3 as X1Color,
  'Numpad3': 3 as X1Color,
  'Digit4': 4 as X1Color,
  'Numpad4': 4 as X1Color,
  'Digit5': 5 as X1Color,
  'Numpad5': 5 as X1Color,
  'Digit6': 6 as X1Color,
  'Numpad6': 6 as X1Color,
  'Digit7': 7 as X1Color,
  'Numpad7': 7 as X1Color,
};

/** リピートを許可するキー */
const ALLOW_REPEAT_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * キーコードと修飾キーからアクションを取得
 * @param code キーコード（event.code）
 * @param modifiers 修飾キーの状態
 * @returns キーアクション、またはnull（マッチしない場合）
 */
export function getActionFromKeyCode(code: string, modifiers: Modifiers): KeyAction | null {
  // Ctrl+キーの処理（他より優先）
  if (modifiers.ctrl) {
    const ctrlBinding = KEY_BINDINGS.find(
      b => b.requireCtrl && b.codes.includes(code)
    );
    if (ctrlBinding) {
      return ctrlBinding.action;
    }
  }

  // カーソル移動キー
  if (code in CURSOR_KEYS) {
    return {
      action: 'cursor-move',
      direction: CURSOR_KEYS[code],
      fast: modifiers.shift
    };
  }

  // 数字キー（色選択/描画）
  if (code in COLOR_KEYS) {
    return {
      action: 'draw-color',
      color: COLOR_KEYS[code]
    };
  }

  // その他のキーバインディング
  const binding = KEY_BINDINGS.find(
    b => !b.requireCtrl && b.codes.includes(code)
  );
  if (binding) {
    return binding.action;
  }

  return null;
}

/**
 * キーがリピートを許可されているかチェック
 */
export function isRepeatAllowed(code: string): boolean {
  return ALLOW_REPEAT_CODES.has(code);
}

/**
 * ROTATIONの番号からタイプを取得
 */
export function getRotationTypeFromNumber(num: number): RotationType | null {
  const rotationTypes: RotationType[] = [
    'right', 'left', 'up', 'down', 'rot90', 'rot180', 'flipH', 'flipV'
  ];
  if (num >= 0 && num <= 7) {
    return rotationTypes[num];
  }
  return null;
}
