/**
 * X1カラーのキャッシュ
 * RGB文字列の生成を事前に行い、描画時のオーバーヘッドを削減
 */

import { X1_COLOR_RGB, X1Color } from './types';

/** キャッシュされた色文字列（CSS形式） */
const COLOR_STRINGS: string[] = [];

// 初期化時に8色分のRGB文字列を生成
for (let i = 0; i < 8; i++) {
  const [r, g, b] = X1_COLOR_RGB[i as X1Color];
  COLOR_STRINGS[i] = `rgb(${r},${g},${b})`;
}

/**
 * X1カラーコードからCSS色文字列を取得
 * @param color X1カラーコード (0-7)
 * @returns CSS色文字列 (例: "rgb(255,255,255)")
 */
export function getColorString(color: X1Color): string {
  return COLOR_STRINGS[color];
}

/** 黒色の文字列（頻繁に使用されるため個別にエクスポート） */
export const BLACK_STRING = COLOR_STRINGS[0];
