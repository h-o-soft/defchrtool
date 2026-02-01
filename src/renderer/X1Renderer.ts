/**
 * X1フォントレンダラー
 * X1互換フォントを読み込み、文字を描画する
 */

import {
  FONT_WIDTH,
  FONT_HEIGHT,
  X1_COLOR_RGB,
  X1Color,
  X1_COLORS
} from '../core/types';
import { CanvasManager } from './CanvasManager';

export class X1Renderer {
  private canvasManager: CanvasManager;

  /** フォント画像 */
  private fontImage: HTMLImageElement | null = null;

  /** フォントがロード済みか */
  private fontLoaded: boolean = false;

  /** フォントデータ（256文字 x 8行 x 8ピクセル） */
  private fontData: Uint8Array | null = null;

  constructor(canvasManager: CanvasManager) {
    this.canvasManager = canvasManager;
  }

  /**
   * X1フォントを読み込む
   */
  async loadFont(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.fontImage = img;
        this.extractFontData();
        this.fontLoaded = true;
        console.log('[X1Renderer] Font loaded successfully');
        resolve();
      };
      img.onerror = () => {
        reject(new Error(`Failed to load font: ${url}`));
      };
      img.src = url;
    });
  }

  /**
   * フォント画像からビットマップデータを抽出
   */
  private extractFontData(): void {
    if (!this.fontImage) return;

    // 一時Canvasでフォント画像を読み込み
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.fontImage.width;
    tempCanvas.height = this.fontImage.height;
    const ctx = tempCanvas.getContext('2d')!;
    ctx.drawImage(this.fontImage, 0, 0);

    // フォント画像は16x16のグリッド（256文字）を想定
    const charsPerRow = 16;
    // Note: 16行 x 16列 = 256文字

    this.fontData = new Uint8Array(256 * 8);

    for (let charCode = 0; charCode < 256; charCode++) {
      const charX = (charCode % charsPerRow) * FONT_WIDTH;
      const charY = Math.floor(charCode / charsPerRow) * FONT_HEIGHT;

      const imageData = ctx.getImageData(charX, charY, FONT_WIDTH, FONT_HEIGHT);

      for (let row = 0; row < FONT_HEIGHT; row++) {
        let rowByte = 0;
        for (let col = 0; col < FONT_WIDTH; col++) {
          const pixelIndex = (row * FONT_WIDTH + col) * 4;
          // R値が128未満なら文字部分（黒ドット=描画対象）
          // X1フォント画像は白地に黒文字形式
          if (imageData.data[pixelIndex] < 128) {
            rowByte |= (0x80 >> col);
          }
        }
        this.fontData[charCode * 8 + row] = rowByte;
      }
    }

    // 罫線文字と矢印文字を生成
    // this.initializeSpecialChars();
  }

  // NOTE: 以下のメソッドはフォント画像に罫線・矢印文字が含まれているため不要
  // フォント画像のデータをそのまま使用する
  /*
  private initializeSpecialChars(): void {
    if (!this.fontData) return;

    // ─ 横線 (0x90)
    this.setCharData(X1_BOX_CHARS.HORIZONTAL, [
      0b00000000,
      0b00000000,
      0b00000000,
      0b11111111,
      0b11111111,
      0b00000000,
      0b00000000,
      0b00000000
    ]);

    // │ 縦線 (0x91)
    this.setCharData(X1_BOX_CHARS.VERTICAL, [
      0b00011000,
      0b00011000,
      0b00011000,
      0b00011000,
      0b00011000,
      0b00011000,
      0b00011000,
      0b00011000
    ]);

    // ┐ 右上角 (0x98) - 上から線が来て左下に曲がる
    this.setCharData(X1_BOX_CHARS.TOP_RIGHT, [
      0b00000000,
      0b00000000,
      0b00000000,
      0b11111000,
      0b11111000,
      0b00011000,
      0b00011000,
      0b00011000
    ]);

    // ┘ 右下角 (0x99) - 下から線が来て左上に曲がる
    this.setCharData(X1_BOX_CHARS.BOTTOM_RIGHT, [
      0b00011000,
      0b00011000,
      0b00011000,
      0b11111000,
      0b11111000,
      0b00000000,
      0b00000000,
      0b00000000
    ]);

    // └ 左下角 (0x9A) - 下から線が来て右上に曲がる
    this.setCharData(X1_BOX_CHARS.BOTTOM_LEFT, [
      0b00011000,
      0b00011000,
      0b00011000,
      0b00011111,
      0b00011111,
      0b00000000,
      0b00000000,
      0b00000000
    ]);

    // ┌ 左上角 (0x9B) - 上から線が来て右下に曲がる
    this.setCharData(X1_BOX_CHARS.TOP_LEFT, [
      0b00000000,
      0b00000000,
      0b00000000,
      0b00011111,
      0b00011111,
      0b00011000,
      0b00011000,
      0b00011000
    ]);

    // ┼ 十字 (0x96)
    this.setCharData(X1_BOX_CHARS.CROSS, [
      0b00011000,
      0b00011000,
      0b00011000,
      0b11111111,
      0b11111111,
      0b00011000,
      0b00011000,
      0b00011000
    ]);

    // → 右矢印 (0x1C)
    this.setCharData(X1_ARROW_CHARS.RIGHT, [
      0b00000000,
      0b00000100,
      0b00000110,
      0b11111111,
      0b11111111,
      0b00000110,
      0b00000100,
      0b00000000
    ]);

    // ← 左矢印 (0x1D)
    this.setCharData(X1_ARROW_CHARS.LEFT, [
      0b00000000,
      0b00100000,
      0b01100000,
      0b11111111,
      0b11111111,
      0b01100000,
      0b00100000,
      0b00000000
    ]);

    // ↑ 上矢印 (0x1E)
    this.setCharData(X1_ARROW_CHARS.UP, [
      0b00011000,
      0b00111100,
      0b01111110,
      0b00011000,
      0b00011000,
      0b00011000,
      0b00011000,
      0b00000000
    ]);

    // ↓ 下矢印 (0x1F)
    this.setCharData(X1_ARROW_CHARS.DOWN, [
      0b00000000,
      0b00011000,
      0b00011000,
      0b00011000,
      0b00011000,
      0b01111110,
      0b00111100,
      0b00011000
    ]);

    // ● 塗りつぶし丸 (0xE0) - 編集エリアのドット表示用
    this.setCharData(0xE0, [
      0b00111100,
      0b01111110,
      0b11111111,
      0b11111111,
      0b11111111,
      0b11111111,
      0b01111110,
      0b00111100
    ]);
  }

  private setCharData(charCode: number, pattern: number[]): void {
    if (!this.fontData || pattern.length !== 8) return;
    const offset = charCode * 8;
    for (let i = 0; i < 8; i++) {
      this.fontData[offset + i] = pattern[i];
    }
  }
  */

  /**
   * フォントがロード済みか確認
   */
  isFontLoaded(): boolean {
    return this.fontLoaded;
  }

  /**
   * フォントデータ（8バイト）を取得
   * @param charCode キャラクターコード（0-255）
   * @returns 8バイトのビットマップデータ（各行1バイト）
   */
  getFontData(charCode: number): Uint8Array {
    const result = new Uint8Array(8);
    if (!this.fontData) return result;

    const offset = (charCode & 0xFF) * 8;
    for (let i = 0; i < 8; i++) {
      result[i] = this.fontData[offset + i];
    }
    return result;
  }

  /**
   * 1文字を描画
   */
  drawChar(
    x: number,
    y: number,
    charCode: number,
    fgColor: X1Color = X1_COLORS.WHITE,
    bgColor: X1Color = X1_COLORS.BLACK
  ): void {
    if (!this.fontData) return;

    const ctx = this.canvasManager.getBackContext();
    const [fgR, fgG, fgB] = X1_COLOR_RGB[fgColor];
    const [bgR, bgG, bgB] = X1_COLOR_RGB[bgColor];

    const imageData = ctx.getImageData(x, y, FONT_WIDTH, FONT_HEIGHT);

    for (let row = 0; row < FONT_HEIGHT; row++) {
      const rowByte = this.fontData[(charCode & 0xFF) * 8 + row];

      for (let col = 0; col < FONT_WIDTH; col++) {
        const pixelIndex = (row * FONT_WIDTH + col) * 4;
        const isSet = (rowByte & (0x80 >> col)) !== 0;

        if (isSet) {
          imageData.data[pixelIndex] = fgR;
          imageData.data[pixelIndex + 1] = fgG;
          imageData.data[pixelIndex + 2] = fgB;
        } else {
          imageData.data[pixelIndex] = bgR;
          imageData.data[pixelIndex + 1] = bgG;
          imageData.data[pixelIndex + 2] = bgB;
        }
        imageData.data[pixelIndex + 3] = 255; // Alpha
      }
    }

    ctx.putImageData(imageData, x, y);
  }

  /**
   * 文字列を描画
   */
  drawText(
    x: number,
    y: number,
    text: string,
    fgColor: X1Color = X1_COLORS.WHITE,
    bgColor: X1Color = X1_COLORS.BLACK
  ): void {
    for (let i = 0; i < text.length; i++) {
      // ASCII文字のみ対応
      const charCode = text.charCodeAt(i);
      this.drawChar(x + i * FONT_WIDTH, y, charCode, fgColor, bgColor);
    }
  }

  /**
   * PCGデータから1文字を描画（単色モード - 後方互換用）
   */
  drawPCGChar(
    x: number,
    y: number,
    pcgData: Uint8Array,
    fgColor: X1Color = X1_COLORS.WHITE,
    bgColor: X1Color = X1_COLORS.BLACK
  ): void {
    if (pcgData.length !== 8) return;

    const ctx = this.canvasManager.getBackContext();
    const [fgR, fgG, fgB] = X1_COLOR_RGB[fgColor];
    const [bgR, bgG, bgB] = X1_COLOR_RGB[bgColor];

    const imageData = ctx.getImageData(x, y, FONT_WIDTH, FONT_HEIGHT);

    for (let row = 0; row < FONT_HEIGHT; row++) {
      const rowByte = pcgData[row];

      for (let col = 0; col < FONT_WIDTH; col++) {
        const pixelIndex = (row * FONT_WIDTH + col) * 4;
        const isSet = (rowByte & (0x80 >> col)) !== 0;

        if (isSet) {
          imageData.data[pixelIndex] = fgR;
          imageData.data[pixelIndex + 1] = fgG;
          imageData.data[pixelIndex + 2] = fgB;
        } else {
          imageData.data[pixelIndex] = bgR;
          imageData.data[pixelIndex + 1] = bgG;
          imageData.data[pixelIndex + 2] = bgB;
        }
        imageData.data[pixelIndex + 3] = 255;
      }
    }

    ctx.putImageData(imageData, x, y);
  }

  /**
   * PCGデータから1文字を描画（8色モード - 24バイトデータ）
   * @param x X座標
   * @param y Y座標
   * @param pcgData 24バイトのPCGデータ（B[8], R[8], G[8]）
   * @param transparent 背景を透明にするか（デフォルト: false）
   */
  drawPCGChar8Color(
    x: number,
    y: number,
    pcgData: Uint8Array,
    transparent: boolean = false
  ): void {
    if (pcgData.length !== 24) return;

    const ctx = this.canvasManager.getBackContext();
    const imageData = ctx.getImageData(x, y, FONT_WIDTH, FONT_HEIGHT);

    for (let row = 0; row < FONT_HEIGHT; row++) {
      const bRow = pcgData[row];           // Bプレーン
      const rRow = pcgData[8 + row];       // Rプレーン
      const gRow = pcgData[16 + row];      // Gプレーン

      for (let col = 0; col < FONT_WIDTH; col++) {
        const pixelIndex = (row * FONT_WIDTH + col) * 4;
        const mask = 0x80 >> col;

        // 各プレーンからビットを取得して色を合成
        const b = (bRow & mask) !== 0 ? 1 : 0;
        const r = (rRow & mask) !== 0 ? 1 : 0;
        const g = (gRow & mask) !== 0 ? 1 : 0;
        const color = (b | (r << 1) | (g << 2)) as X1Color;

        if (transparent && color === X1_COLORS.BLACK) {
          // 透明の場合は何もしない（既存のピクセルを維持）
          continue;
        }

        const [colorR, colorG, colorB] = X1_COLOR_RGB[color];
        imageData.data[pixelIndex] = colorR;
        imageData.data[pixelIndex + 1] = colorG;
        imageData.data[pixelIndex + 2] = colorB;
        imageData.data[pixelIndex + 3] = 255;
      }
    }

    ctx.putImageData(imageData, x, y);
  }

  /**
   * PCGDataオブジェクトから1文字を描画（8色）
   * @param x X座標
   * @param y Y座標
   * @param pcgDataObj PCGDataオブジェクト
   * @param charCode キャラクターコード
   * @param transparent 背景を透明にするか
   */
  drawPCGCharFromData(
    x: number,
    y: number,
    pcgDataObj: { getPixel: (charCode: number, x: number, y: number) => X1Color },
    charCode: number,
    transparent: boolean = false
  ): void {
    const ctx = this.canvasManager.getBackContext();
    const imageData = ctx.getImageData(x, y, FONT_WIDTH, FONT_HEIGHT);

    for (let row = 0; row < FONT_HEIGHT; row++) {
      for (let col = 0; col < FONT_WIDTH; col++) {
        const pixelIndex = (row * FONT_WIDTH + col) * 4;
        const color = pcgDataObj.getPixel(charCode, col, row);

        if (transparent && color === X1_COLORS.BLACK) {
          continue;
        }

        const [colorR, colorG, colorB] = X1_COLOR_RGB[color];
        imageData.data[pixelIndex] = colorR;
        imageData.data[pixelIndex + 1] = colorG;
        imageData.data[pixelIndex + 2] = colorB;
        imageData.data[pixelIndex + 3] = 255;
      }
    }

    ctx.putImageData(imageData, x, y);
  }

  /**
   * 画面をクリア
   */
  clear(): void {
    this.canvasManager.clear('#000000');
  }

  /**
   * バックバッファをフリップ
   */
  flip(): void {
    this.canvasManager.flip();
  }
}
