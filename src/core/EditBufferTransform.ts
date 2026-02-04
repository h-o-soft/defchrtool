/**
 * 編集バッファ変換ユーティリティ
 * 回転、フリップ、移動の処理を行う
 */

import { PCGData } from './PCGData';
import { EditMode, X1Color } from './types';
import { getEditArea, getCursorCharPos, EditArea } from './EditAreaCalculator';
import { RotationType } from '../input/InputEventTypes';

/**
 * 編集バッファ変換クラス
 */
export class EditBufferTransform {
  /**
   * 変換を適用
   * @param editBuffer 編集バッファ
   * @param editMode 編集モード
   * @param cursorX カーソルX座標（0-15）
   * @param cursorY カーソルY座標（0-15）
   * @param transformType 変換タイプ
   * @returns 変換が成功したかどうか
   */
  static apply(
    editBuffer: PCGData,
    editMode: EditMode,
    cursorX: number,
    cursorY: number,
    transformType: RotationType
  ): boolean {
    const { charX, charY } = getCursorCharPos(cursorX, cursorY);

    // 90度/180度回転はタテ2Chr.やヨコ2Chr.では無効
    if ((transformType === 'rot90' || transformType === 'rot180') &&
        (editMode === EditMode.VERTICAL || editMode === EditMode.HORIZONTAL)) {
      return false;
    }

    const area = getEditArea(editMode, charX, charY);

    // 対象エリアのピクセルデータを取得
    const pixels = EditBufferTransform.getAreaPixels(editBuffer, area);

    // 変換を適用
    const transformed = EditBufferTransform.applyTransformation(pixels, area.width, area.height, transformType);

    // 結果を書き戻す
    EditBufferTransform.setAreaPixels(editBuffer, area, transformed);

    return true;
  }

  /**
   * 指定エリアのピクセルを取得
   */
  private static getAreaPixels(editBuffer: PCGData, area: EditArea): X1Color[][] {
    const { width, height, charCodes } = area;
    const pixels: X1Color[][] = [];

    for (let y = 0; y < height; y++) {
      pixels[y] = [];
      for (let x = 0; x < width; x++) {
        const charIdx = Math.floor(x / 8) + Math.floor(y / 8) * (width > 8 ? 2 : 1);
        const charCode = charCodes[charIdx] || charCodes[0];
        const localX = x % 8;
        const localY = y % 8;
        pixels[y][x] = editBuffer.getPixel(charCode, localX, localY);
      }
    }
    return pixels;
  }

  /**
   * ピクセルを指定エリアに書き戻す
   */
  private static setAreaPixels(editBuffer: PCGData, area: EditArea, pixels: X1Color[][]): void {
    const { width, height, charCodes } = area;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const charIdx = Math.floor(x / 8) + Math.floor(y / 8) * (width > 8 ? 2 : 1);
        const charCode = charCodes[charIdx] || charCodes[0];
        const localX = x % 8;
        const localY = y % 8;
        editBuffer.setPixel(charCode, localX, localY, pixels[y][x]);
      }
    }
  }

  /**
   * 変換を適用
   */
  private static applyTransformation(
    pixels: X1Color[][],
    width: number,
    height: number,
    type: RotationType
  ): X1Color[][] {
    const result: X1Color[][] = [];

    switch (type) {
      case 'right':
        // 左に移動（左端が右端に折り返し）
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[y][(x + 1) % width];
          }
        }
        break;

      case 'left':
        // 右に移動（右端が左端に折り返し）
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[y][(x - 1 + width) % width];
          }
        }
        break;

      case 'up':
        // 上に移動（上端が下端に折り返し）
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[(y + 1) % height][x];
          }
        }
        break;

      case 'down':
        // 下に移動（下端が上端に折り返し）
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[(y - 1 + height) % height][x];
          }
        }
        break;

      case 'rot90':
        // 90度反時計回り: (x,y) -> (y, width-1-x)
        for (let y = 0; y < width; y++) {
          result[y] = [];
          for (let x = 0; x < height; x++) {
            result[y][x] = pixels[x][width - 1 - y];
          }
        }
        break;

      case 'rot180':
        // 180度: (x,y) -> (width-1-x, height-1-y)
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[height - 1 - y][width - 1 - x];
          }
        }
        break;

      case 'flipH':
        // 上下フリップ: (x,y) -> (x, height-1-y)
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[height - 1 - y][x];
          }
        }
        break;

      case 'flipV':
        // 左右フリップ: (x,y) -> (width-1-x, y)
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[y][width - 1 - x];
          }
        }
        break;
    }

    return result;
  }

  /**
   * 変換タイプの表示名を取得
   */
  static getTransformName(type: RotationType): string {
    const names: Record<RotationType, string> = {
      'right': 'Move Right',
      'left': 'Move Left',
      'up': 'Move Up',
      'down': 'Move Down',
      'rot90': 'Rotate 90°',
      'rot180': 'Rotate 180°',
      'flipH': 'Flip H',
      'flipV': 'Flip V'
    };
    return names[type];
  }
}
