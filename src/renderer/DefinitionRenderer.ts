/**
 * 定義エリアレンダラー
 * 256文字のPCG一覧を表示する（16x16グリッド）
 */

import { PCGData } from '../core/PCGData';
import { CanvasManager } from './CanvasManager';
import {
  FONT_WIDTH,
  FONT_HEIGHT,
  X1_COLOR_RGB,
  X1_COLORS
} from '../core/types';

/** 1文字の表示サイズ */
const CHAR_DISPLAY_SIZE = 8;

/** グリッド全体のサイズ（16x16文字） */
const GRID_CHARS = 16;
const GRID_SIZE = GRID_CHARS * CHAR_DISPLAY_SIZE; // 128px

export class DefinitionRenderer {
  private canvasManager: CanvasManager;
  private pcgData: PCGData;

  /** 描画開始位置 */
  private offsetX: number = 320;
  private offsetY: number = 32;

  /** 選択中のキャラクターコード */
  private selectedCharCode: number = 0;

  constructor(canvasManager: CanvasManager, pcgData: PCGData) {
    this.canvasManager = canvasManager;
    this.pcgData = pcgData;
  }

  /**
   * 描画開始位置を設定
   */
  setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  /**
   * 選択中のキャラクターを設定
   */
  setSelectedChar(charCode: number): void {
    this.selectedCharCode = charCode & 0xFF;
  }

  /**
   * 256文字の一覧を描画
   */
  render(): void {
    const ctx = this.canvasManager.getBackContext();

    // 背景（黒）
    ctx.fillStyle = '#000000';
    ctx.fillRect(this.offsetX, this.offsetY, GRID_SIZE, GRID_SIZE);

    // 256文字を描画
    for (let charCode = 0; charCode < 256; charCode++) {
      const gridX = charCode % GRID_CHARS;
      const gridY = Math.floor(charCode / GRID_CHARS);

      const x = this.offsetX + gridX * CHAR_DISPLAY_SIZE;
      const y = this.offsetY + gridY * CHAR_DISPLAY_SIZE;

      this.drawCharacter(ctx, x, y, charCode);
    }

    // 選択中のキャラクターをハイライト
    this.drawSelection(ctx);

    // 外枠
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.offsetX - 1, this.offsetY - 1, GRID_SIZE + 2, GRID_SIZE + 2);
  }

  /**
   * 1文字を描画（8色対応）
   */
  private drawCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, charCode: number): void {
    for (let py = 0; py < FONT_HEIGHT; py++) {
      for (let px = 0; px < FONT_WIDTH; px++) {
        const color = this.pcgData.getPixel(charCode, px, py);

        // 黒以外のピクセルを描画
        if (color !== X1_COLORS.BLACK) {
          const [r, g, b] = X1_COLOR_RGB[color];
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x + px, y + py, 1, 1);
        }
      }
    }
  }

  /**
   * 選択枠を描画
   */
  private drawSelection(ctx: CanvasRenderingContext2D): void {
    const gridX = this.selectedCharCode % GRID_CHARS;
    const gridY = Math.floor(this.selectedCharCode / GRID_CHARS);

    const x = this.offsetX + gridX * CHAR_DISPLAY_SIZE;
    const y = this.offsetY + gridY * CHAR_DISPLAY_SIZE;

    // 選択枠（シアン）
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, CHAR_DISPLAY_SIZE + 1, CHAR_DISPLAY_SIZE + 1);
  }

  /**
   * 特定のキャラクターのみ再描画
   */
  renderCharacter(charCode: number): void {
    const ctx = this.canvasManager.getBackContext();

    const gridX = charCode % GRID_CHARS;
    const gridY = Math.floor(charCode / GRID_CHARS);

    const x = this.offsetX + gridX * CHAR_DISPLAY_SIZE;
    const y = this.offsetY + gridY * CHAR_DISPLAY_SIZE;

    // 背景クリア
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, CHAR_DISPLAY_SIZE, CHAR_DISPLAY_SIZE);

    // 再描画
    this.drawCharacter(ctx, x, y, charCode);

    // 選択中なら枠も再描画
    if (charCode === this.selectedCharCode) {
      this.drawSelection(ctx);
    }
  }

  /**
   * 画面座標からキャラクターコードを取得
   * @param screenX 画面X座標
   * @param screenY 画面Y座標
   * @returns キャラクターコード（範囲外の場合は-1）
   */
  getCharCodeFromPosition(screenX: number, screenY: number): number {
    const localX = screenX - this.offsetX;
    const localY = screenY - this.offsetY;

    if (localX < 0 || localX >= GRID_SIZE || localY < 0 || localY >= GRID_SIZE) {
      return -1;
    }

    const gridX = Math.floor(localX / CHAR_DISPLAY_SIZE);
    const gridY = Math.floor(localY / CHAR_DISPLAY_SIZE);

    return gridY * GRID_CHARS + gridX;
  }

  /**
   * 表示領域の情報を取得
   */
  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.offsetX,
      y: this.offsetY,
      width: GRID_SIZE,
      height: GRID_SIZE
    };
  }
}
