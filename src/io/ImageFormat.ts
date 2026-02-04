/**
 * 画像形式（PNG等）の保存・読み込み
 * 128x128ピクセル = 16x16文字 = 256文字のPCGデータ
 */

import { PCGData } from '../core/PCGData';
import { X1_PALETTE } from '../core/constants';
import { X1Color } from '../core/types';
import { reduceColors, isExactX1Colors, ColorReduceMode } from '../core/ColorReducer';

/**
 * 画像形式の保存・読み込みユーティリティ
 */
export class ImageFormat {
  /**
   * PNG形式で保存（全256文字を128x128画像として）
   * @param pcgData PCGデータ
   * @returns Promise<Blob>
   */
  static async savePng(pcgData: PCGData): Promise<Blob> {
    // 128x128のオフスクリーンキャンバスを作成
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // 黒で塗りつぶし
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 128);

    // 256文字を描画
    for (let charCode = 0; charCode < 256; charCode++) {
      const charX = (charCode % 16) * 8;
      const charY = Math.floor(charCode / 16) * 8;

      for (let py = 0; py < 8; py++) {
        for (let px = 0; px < 8; px++) {
          const color = pcgData.getPixel(charCode, px, py);
          if (color !== 0) {
            const [r, g, b] = X1_PALETTE[color];
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(charX + px, charY + py, 1, 1);
          }
        }
      }
    }

    // PNGとしてBlobを返す
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PNG blob'));
        }
      }, 'image/png');
    });
  }

  /**
   * 画像形式で読み込み
   * @param file 画像ファイル
   * @param pcgData 書き込み先のPCGData
   * @param reduceMode 減色モード
   * @returns 読み込んだ文字数（常に256）
   */
  static async loadImage(file: File, pcgData: PCGData, reduceMode: ColorReduceMode): Promise<number> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          // 128x128以外のサイズは警告（ただし処理は続行）
          if (img.width !== 128 || img.height !== 128) {
            console.warn(`Image size is ${img.width}x${img.height}, expected 128x128`);
          }

          // 画像をキャンバスに描画してピクセルデータを取得
          const canvas = document.createElement('canvas');
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, 128, 128);
          const imageData = ctx.getImageData(0, 0, 128, 128);

          // 減色モードに応じて処理
          let colorData: X1Color[][];
          if (reduceMode === 'none' && isExactX1Colors(imageData)) {
            // X1の8色のみで構成されている場合はそのまま変換
            colorData = reduceColors(imageData, 'reduce');
          } else if (reduceMode === 'none') {
            // 8色以外が含まれているが'none'が指定された場合は'reduce'にフォールバック
            console.log('[ImageFormat] Non-X1 colors detected, using reduce mode');
            colorData = reduceColors(imageData, 'reduce');
          } else {
            colorData = reduceColors(imageData, reduceMode);
          }

          // 256文字を読み込み
          for (let charCode = 0; charCode < 256; charCode++) {
            const charX = (charCode % 16) * 8;
            const charY = Math.floor(charCode / 16) * 8;

            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                const color = colorData[charY + py][charX + px];
                pcgData.setPixel(charCode, px, py, color);
              }
            }
          }

          // 画像URLを解放
          URL.revokeObjectURL(img.src);

          resolve(256);
        } catch (e) {
          URL.revokeObjectURL(img.src);
          reject(e);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * デフォルトのファイル名を取得
   */
  static getDefaultFileName(): string {
    return 'pcg.png';
  }
}

// ColorReducerから型を再エクスポート
export type { ColorReduceMode };
