/**
 * 編集エリア計算ユーティリティ
 * 編集モードとカーソル位置から対象エリアを計算する
 */

import { EditMode } from './types';

/** 編集エリアの情報 */
export interface EditArea {
  startX: number;
  startY: number;
  width: number;
  height: number;
  charCodes: number[];
}

/**
 * 編集モードとカーソル位置から対象エリアを取得
 * @param editMode 編集モード
 * @param charX カーソル位置の文字X座標（0-1）
 * @param charY カーソル位置の文字Y座標（0-1）
 */
export function getEditArea(editMode: EditMode, charX: number, charY: number): EditArea {
  switch (editMode) {
    case EditMode.SEPARATE:
      // 1文字のみ
      return {
        startX: charX * 8,
        startY: charY * 8,
        width: 8,
        height: 8,
        charCodes: [charX + charY * 16]
      };

    case EditMode.VERTICAL:
      // 縦2文字
      return {
        startX: charX * 8,
        startY: 0,
        width: 8,
        height: 16,
        charCodes: [charX, charX + 16]
      };

    case EditMode.HORIZONTAL:
      // 横2文字
      return {
        startX: 0,
        startY: charY * 8,
        width: 16,
        height: 8,
        charCodes: [charY * 16, charY * 16 + 1]
      };

    case EditMode.ALL:
    default:
      // 4文字すべて
      return {
        startX: 0,
        startY: 0,
        width: 16,
        height: 16,
        charCodes: [0, 1, 16, 17]
      };
  }
}

/**
 * カーソル位置から文字座標を計算
 * @param cursorX ドット座標X（0-15）
 * @param cursorY ドット座標Y（0-15）
 */
export function getCursorCharPos(cursorX: number, cursorY: number): { charX: number; charY: number } {
  return {
    charX: Math.floor(cursorX / 8),
    charY: Math.floor(cursorY / 8)
  };
}
